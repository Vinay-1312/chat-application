const jwt = require('jsonwebtoken')
const db = require('../db')
const { pub, sub } = require('../redis')
const { JWT_SECRET } = require('../middleware/auth')

// channel → Set of socket ids on this node subscribed to that room
const roomSockets = new Map()
// socket id → socket object
const socketMap = new Map()
// user id → Set of socket ids (one user can have multiple tabs open)
const userSockets = new Map()

// execute when a message is published to a channel this node is subscribed to
sub.on('message', (channel, data) => {
  // user:<userId> — targeted event for a specific user connected to this node
  if (channel.startsWith('user:')) {
    const userId = channel.slice(5)
    const socketIds = userSockets.get(userId)
    if (!socketIds) return
    const { event, payload } = JSON.parse(data)
    console.log(`[SOCKET] Redis user-event "${event}" on channel="${channel}" — delivering to ${socketIds.size} local socket(s)`)
    socketIds.forEach(socketId => {
      const socket = socketMap.get(socketId)
      if (socket) socket.emit(event, payload)
    })
    return
  }

  // room:<convId> — fanout message to everyone in a conversation
  const sockets = roomSockets.get(channel)
  if (!sockets) return
  const message = JSON.parse(data)
  console.log(`[SOCKET] Redis message received on channel="${channel}" — broadcasting to ${sockets.size} local socket(s)`)
  sockets.forEach(socketId => {
    const socket = socketMap.get(socketId)
    if (socket) socket.emit('message', message)
  })
})

function joinRoom(socket, channel) {
  if (!roomSockets.has(channel)) {
    roomSockets.set(channel, new Set())
    sub.subscribe(channel)
    console.log(`[SOCKET] First local subscriber — subscribed to Redis channel="${channel}"`)
  }
  roomSockets.get(channel).add(socket.id)
  console.log(`[SOCKET] Socket ${socket.id} joined channel="${channel}" (total in room: ${roomSockets.get(channel).size})`)
}

function leaveRoom(socket, channel) {
  const sockets = roomSockets.get(channel)
  if (!sockets) return
  sockets.delete(socket.id)
  console.log(`[SOCKET] Socket ${socket.id} left channel="${channel}" (remaining: ${sockets.size})`)
  if (sockets.size === 0) {
    roomSockets.delete(channel)
    sub.unsubscribe(channel)
    console.log(`[SOCKET] No more local subscribers — unsubscribed from Redis channel="${channel}"`)
  }
}

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      console.warn('[SOCKET] Connection rejected — no token in handshake')
      return next(new Error('No token'))
    }
    try {
      socket.user = jwt.verify(token, JWT_SECRET)
      console.log(`[SOCKET] Token verified for user="${socket.user.username}" (${socket.user.id})`)
      next()
    } catch {
      console.warn('[SOCKET] Connection rejected — invalid token')
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    socketMap.set(socket.id, socket)
    if (!userSockets.has(socket.user.id)) userSockets.set(socket.user.id, new Set())
    userSockets.get(socket.user.id).add(socket.id)
    sub.subscribe(`user:${socket.user.id}`)
    console.log(`[SOCKET] Client connected — socketId=${socket.id} user="${socket.user.username}" (total connected: ${socketMap.size})`)

    // Auto-join all rooms this user belongs to, then tell the client it's ready
    try {
      const result = await db.query(
        'SELECT conversation_id FROM members WHERE user_id = $1',
        [socket.user.id]
      )
      console.log(`[SOCKET] Auto-joining ${result.rows.length} room(s) for user="${socket.user.username}"`)
      result.rows.forEach(row => joinRoom(socket, `room:${row.conversation_id}`))
      socket.emit('ready')
      console.log(`[SOCKET] Emitted "ready" to socketId=${socket.id}`)
    } catch (err) {
      console.error('[SOCKET] Failed to load user rooms on connect:', err.message)
      socket.emit('ready')  // still unblock the client even if room setup fails
    }

    socket.on('send_message', async ({ conversationId, content }) => {
      console.log(`[SOCKET] send_message — user="${socket.user.username}" -> conversationId=${conversationId} content="${content.slice(0, 60)}"`)
      try {
        const member = await db.query(
          'SELECT 1 FROM members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.user.id]
        )
        if (!member.rows.length) {
          console.warn(`[SOCKET] send_message rejected — user="${socket.user.username}" is not a member of conversationId=${conversationId}`)
          return
        }

        const result = await db.query(
          'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
          [conversationId, socket.user.id, content]
        )
        // Debezium reads this INSERT from Postgres WAL and publishes to Redis Stream.
        // streamConsumer.js picks it up and calls pub.publish() — no direct publish here.
        console.log(`[SOCKET] Message saved to DB — messageId=${result.rows[0].id}, Debezium will publish to Redis`)
      } catch (err) {
        console.error('[SOCKET] send_message error:', err.message)
      }
    })

    // Called when user creates a new conversation mid-session
    socket.on('join_conversation', ({ conversationId }) => {
      console.log(`[SOCKET] join_conversation — user="${socket.user.username}" joining conversationId=${conversationId}`)
      joinRoom(socket, `room:${conversationId}`)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Client disconnected — socketId=${socket.id} user="${socket.user.username}" reason="${reason}" (total connected: ${socketMap.size - 1})`)
      socketMap.delete(socket.id)

      // remove from userSockets; unsubscribe personal channel when last tab closes
      const userSocketSet = userSockets.get(socket.user.id)
      if (userSocketSet) {
        userSocketSet.delete(socket.id)
        if (userSocketSet.size === 0) {
          userSockets.delete(socket.user.id)
          sub.unsubscribe(`user:${socket.user.id}`)
          console.log(`[SOCKET] All tabs closed for user="${socket.user.username}" — unsubscribed from personal channel`)
        }
      }

      const channels = [...roomSockets.keys()]
      channels.forEach(channel => {
        const sockets = roomSockets.get(channel)
        if (sockets && sockets.has(socket.id)) leaveRoom(socket, channel)
      })
    })
  })
}

module.exports = { setupSocket }
