import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    socket = io('http://localhost:10000', {
      auth: { token },
      extraHeaders: { 'x-user-id': user.id }
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
