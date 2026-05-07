const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { setupSocket } = require('./socket')
const { startStreamConsumer } = require('./streamConsumer')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: '*' },
  path: '/socket.io'
})

app.use(cors())
app.use(express.json())

// Log every incoming HTTP request
app.use((req, _res, next) => {
  console.log(`[SERVER] ${req.method} ${req.path}`)
  next()
})

app.use('/api/auth', require('./routes/auth'))
app.use('/api/users', require('./routes/users'))
app.use('/api/conversations', require('./routes/conversations'))
app.use('/api/messages', require('./routes/messages'))

console.log('[SERVER] Initializing Socket.io handler')
setupSocket(io)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`[SERVER] Chat service running on port ${PORT}`)
  startStreamConsumer().catch(err => console.error('[SERVER] Stream consumer failed to start:', err.message))
})
