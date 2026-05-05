const jwt = require('jsonwebtoken')
const db = require('../db')
const { pub, sub } = require('../redis')
const { JWT_SECRET } = require('../middleware/auth')

// channel → Set of socket ids on this node subscribed to that room
const roomSockets = new Map()
// socket id → socket object
const socketMap = new Map()

//excute when a message is published to a channel this node is subscribed to
sub.on('message', (channel, data) => {
  const sockets = roomSockets.get(channel)
  if (!sockets) return
  const message = JSON.parse(data)
  sockets.forEach(socketId => {
    const socket = socketMap.get(socketId)
    if (socket) socket.emit('message', message)
  })
})

function joinRoom(socket, channel) {
  if (!roomSockets.has(channel)) {
    roomSockets.set(channel, new Set())
    sub.subscribe(channel)
  }
  roomSockets.get(channel).add(socket.id)
}

function leaveRoom(socket, channel) {
  const sockets = roomSockets.get(channel)
  if (!sockets) return
  sockets.delete(socket.id)
  if (sockets.size === 0) {
    roomSockets.delete(channel)
    sub.unsubscribe(channel)
  }
}

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('No token'))
    try {
      socket.user = jwt.verify(token, JWT_SECRET)
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    socketMap.set(socket.id, socket)

    // Auto-join all rooms this user belongs to, then tell the client it's ready
    try {
      const result = await db.query(
        'SELECT conversation_id FROM members WHERE user_id = $1',
        [socket.user.id]
      )
      result.rows.forEach(row => joinRoom(socket, `room:${row.conversation_id}`))
      socket.emit('ready')
    } catch (err) {
      console.error('Failed to load user rooms on connect:', err)
      socket.emit('ready')  // still unblock the client even if room setup fails
    }

    socket.on('send_message', async ({ conversationId, content }) => {
      try {
        const member = await db.query(
          'SELECT 1 FROM members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.user.id]
        )
        if (!member.rows.length) return

        const result = await db.query(
          'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
          [conversationId, socket.user.id, content]
        )
        const message = {
          ...result.rows[0],
          sender_id: socket.user.id,
          sender_username: socket.user.username
        }

        pub.publish(`room:${conversationId}`, JSON.stringify(message))
      } catch (err) {
        console.error('send_message error:', err)
      }
    })

    // Called when user creates a new conversation mid-session
    socket.on('join_conversation', ({ conversationId }) => {
      joinRoom(socket, `room:${conversationId}`)
    })

    socket.on('disconnect', () => {
      socketMap.delete(socket.id)
      const channels = [...roomSockets.keys()]
      channels.forEach(channel => {
        const sockets = roomSockets.get(channel)
        if (sockets && sockets.has(socket.id)) leaveRoom(socket, channel)
      })
    })
  })
}

module.exports = { setupSocket }
