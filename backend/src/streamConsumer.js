const Redis = require('ioredis')
const db = require('./db')
const { pub } = require('./redis')

// Stream name = {topic.prefix}.{schema}.{table} from Debezium config
const STREAM = 'chatdb.public.messages'
// One consumer group across all nodes — only one node processes each event
const GROUP = 'chat-room-publisher'
// Each node is a distinct consumer inside the group
const CONSUMER = `node-${process.env.PORT || 3000}`
const BATCH_SIZE = 10
const BLOCK_MS = 2000  // block up to 2s waiting for new entries before looping

// Separate Redis client — pub/sub client can't run XREADGROUP
const streamClient = new Redis({ host: process.env.REDIS_HOST || 'redis', port: 6379 })

streamClient.on('connect', () => console.log(`[STREAM] Consumer "${CONSUMER}" connected to Redis`))
streamClient.on('error', (err) => console.error('[STREAM] Redis error:', err.message))

async function ensureConsumerGroup() {
  try {
    // MKSTREAM: create the stream key if Debezium hasn't written yet
    await streamClient.xgroup('CREATE', STREAM, GROUP, '0', 'MKSTREAM')
    console.log(`[STREAM] Consumer group "${GROUP}" created on stream "${STREAM}"`)
  } catch (err) {
    if (err.message.includes('BUSYGROUP')) {
      console.log(`[STREAM] Consumer group "${GROUP}" already exists — resuming`)
    } else {
      throw err
    }
  }
}

async function processEvents() {
  // '>' = only fetch entries not yet delivered to any consumer in this group
  const results = await streamClient.xreadgroup(
    'GROUP', GROUP, CONSUMER,
    'COUNT', BATCH_SIZE,
    'BLOCK', BLOCK_MS,
    'STREAMS', STREAM, '>'
  )

  if (!results) return  // BLOCK timeout, no new events — loop again

  for (const [, entries] of results) {
    for (const [entryId, fields] of entries) {
      await handleEntry(entryId, fields)
    }
  }
}

async function handleEntry(entryId, fields) {
  try {
    // ioredis returns stream entry fields as flat array: ["key","v","value","v"]
    const fieldMap = {}
    for (let i = 0; i < fields.length; i += 2) fieldMap[fields[i]] = fields[i + 1]

    const envelope = JSON.parse(fieldMap.value)
    // with schemas disabled, payload IS the top-level object
    const payload = envelope.payload ?? envelope

    if (payload.op !== 'c') {
      // only handle INSERT (op='c'). skip UPDATE ('u'), DELETE ('d'), snapshot ('r')
      await streamClient.xack(STREAM, GROUP, entryId)
      return
    }

    const row = payload.after
    console.log(`[STREAM] INSERT event — messageId=${row.id} conversationId=${row.conversation_id}`)

    // sender_username is not stored in messages table — look it up
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [row.sender_id])
    const senderUsername = userResult.rows[0]?.username ?? 'unknown'

    const message = {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      sender_username: senderUsername,
      content: row.content,
      created_at: row.created_at
    }

    await pub.publish(`room:${row.conversation_id}`, JSON.stringify(message))
    console.log(`[STREAM] Published to Redis channel="room:${row.conversation_id}"`)

    // ACK — tells Redis this entry was successfully processed
    await streamClient.xack(STREAM, GROUP, entryId)
  } catch (err) {
    console.error(`[STREAM] Failed to handle entryId=${entryId}:`, err.message)
    // intentionally NOT acking — Redis will redeliver on next XREADGROUP call
  }
}

async function startStreamConsumer() {
  await ensureConsumerGroup()
  console.log(`[STREAM] Consumer "${CONSUMER}" listening on stream "${STREAM}"`)

  const loop = async () => {
    try {
      await processEvents()
    } catch (err) {
      console.error('[STREAM] Unexpected loop error:', err.message)
    }
    // setImmediate yields to the event loop between iterations
    setImmediate(loop)
  }
  loop()
}

module.exports = { startStreamConsumer }
