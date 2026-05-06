import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import { getSocket, disconnectSocket } from '../socket'
import api from '../api'

export default function Chat({ user, onLogout }) {
  const [conversations, setConversations] = useState([])
  const [active, setActive] = useState(null)

  useEffect(() => {
    loadConversations()
    const socket = getSocket()

    // fired when another user adds us to a direct or group conversation
    socket.on('new_conversation', (conv) => {
      console.log('[Chat] new_conversation received — conversationId:', conv.id)
      setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
      socket.emit('join_conversation', { conversationId: conv.id })
    })

    return () => {
      socket.off('new_conversation')
      disconnectSocket()
    }
  }, [])

  const loadConversations = async () => {
    const { data } = await api.get('/conversations')
    setConversations(data)
  }

  const handleNewConversation = (conv) => {
    setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
    setActive(conv)
  }

  const handleLastMessage = (conversationId, content) => {
    setConversations(prev =>
      prev
        .map(c => c.id === conversationId ? { ...c, last_message: content, last_message_at: new Date().toISOString() } : c)
        .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0))
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        user={user}
        conversations={conversations}
        activeId={active?.id}
        onSelect={setActive}
        onNewConversation={handleNewConversation}
        onLogout={onLogout}
      />
      {active
        ? <ChatWindow key={active.id} conversation={active} user={user} onMessage={handleLastMessage} />
        : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '15px' }}>Select a conversation to start chatting</div>
      }
    </div>
  )
}
