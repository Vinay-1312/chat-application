const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { setupSocket } = require('./socket')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: '*' },
  path: '/socket.io'
})

app.use(cors())
app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/users', require('./routes/users'))
app.use('/api/conversations', require('./routes/conversations'))
app.use('/api/messages', require('./routes/messages'))

setupSocket(io)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Chat service running on port ${PORT}`))
