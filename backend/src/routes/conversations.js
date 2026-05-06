const router = require('express').Router()
const db = require('../db')
const { pub } = require('../redis')
const { authMiddleware } = require('../middleware/auth')

function notifyMembers(memberIds, conv) {
  memberIds.forEach(userId => {
    pub.publish(`user:${userId}`, JSON.stringify({ event: 'new_conversation', payload: conv }))
    console.log(`[ROUTE:conversations] Published new_conversation to user:${userId}`)
  })
}

router.get('/', authMiddleware, async (req, res) => {
  console.log(`[ROUTE:conversations] List conversations — user="${req.user.username}"`)
  try {
    const result = await db.query(`
      SELECT
        c.id, c.type, c.name, c.created_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
        (
          SELECT u.username FROM users u
          JOIN members m2 ON m2.user_id = u.id
          WHERE m2.conversation_id = c.id AND u.id != $1
          LIMIT 1
        ) AS other_username
      FROM conversations c
      JOIN members m ON m.conversation_id = c.id
      WHERE m.user_id = $1
      ORDER BY last_message_at DESC NULLS LAST
    `, [req.user.id])
    console.log(`[ROUTE:conversations] Found ${result.rows.length} conversation(s) for user="${req.user.username}"`)
    res.json(result.rows)
  } catch (err) {
    console.error('[ROUTE:conversations] List error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:id/members', authMiddleware, async (req, res) => {
  console.log(`[ROUTE:conversations] Get members — conversationId=${req.params.id} by user="${req.user.username}"`)
  try {
    const result = await db.query(`
      SELECT u.id, u.username FROM users u
      JOIN members m ON m.user_id = u.id
      WHERE m.conversation_id = $1
    `, [req.params.id])
    console.log(`[ROUTE:conversations] Found ${result.rows.length} member(s) in conversationId=${req.params.id}`)
    res.json(result.rows)
  } catch (err) {
    console.error('[ROUTE:conversations] Get members error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/direct', authMiddleware, async (req, res) => {
  const { targetUserId } = req.body
  console.log(`[ROUTE:conversations] Create direct — user="${req.user.username}" -> targetUserId=${targetUserId}`)
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(`
      SELECT c.id FROM conversations c
      JOIN members m1 ON m1.conversation_id = c.id AND m1.user_id = $1
      JOIN members m2 ON m2.conversation_id = c.id AND m2.user_id = $2
      WHERE c.type = 'direct'
    `, [req.user.id, targetUserId])

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK')
      console.log(`[ROUTE:conversations] Direct conversation already exists — id=${existing.rows[0].id}`)
      return res.json(existing.rows[0])
    }

    const conv = await client.query(
      "INSERT INTO conversations (type) VALUES ('direct') RETURNING *",
      []
    )
    await client.query(
      'INSERT INTO members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
      [conv.rows[0].id, req.user.id, targetUserId]
    )
    await client.query('COMMIT')
    console.log(`[ROUTE:conversations] Direct conversation created — id=${conv.rows[0].id}`)
    // notify the other participant (creator handles it via HTTP response)
    notifyMembers([targetUserId], conv.rows[0])
    res.json(conv.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[ROUTE:conversations] Create direct error:', err.message)
    res.status(500).json({ error: 'Server error' })
  } finally {
    client.release()
  }
})

router.post('/group', authMiddleware, async (req, res) => {
  const { name, memberIds } = req.body
  console.log(`[ROUTE:conversations] Create group — name="${name}" by user="${req.user.username}" memberIds=[${memberIds}]`)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const conv = await client.query(
      "INSERT INTO conversations (type, name) VALUES ('group', $1) RETURNING *",
      [name]
    )
    const allMembers = [...new Set([req.user.id, ...memberIds])]
    for (const userId of allMembers) {
      await client.query(
        'INSERT INTO members (conversation_id, user_id) VALUES ($1, $2)',
        [conv.rows[0].id, userId]
      )
    }
    await client.query('COMMIT')
    console.log(`[ROUTE:conversations] Group conversation created — id=${conv.rows[0].id} name="${name}" members=${allMembers.length}`)
    // notify all members except creator (creator handles it via HTTP response)
    const otherMembers = allMembers.filter(id => id !== req.user.id)
    notifyMembers(otherMembers, conv.rows[0])
    res.json(conv.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[ROUTE:conversations] Create group error:', err.message)
    res.status(500).json({ error: 'Server error' })
  } finally {
    client.release()
  }
})

module.exports = router
