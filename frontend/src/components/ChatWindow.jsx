import React, { useState, useEffect, useRef } from 'react'
import api from '../api'
import { getSocket } from '../socket'
import MessageInput from './MessageInput'

export default function ChatWindow({ conversation, user, onMessage }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const socket = getSocket()
    socket.on('message', handleIncoming)

    // wait for server to finish room setup before joining new conversations
    if (socket.connected) {
      socket.emit('join_conversation', { conversationId: conversation.id })
    } else {
      socket.once('ready', () => socket.emit('join_conversation', { conversationId: conversation.id }))
    }

    return () => socket.off('message', handleIncoming)
  }, [conversation.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/messages/${conversation.id}`)
      setMessages(data)
    } finally {
      setLoading(false)
    }
  }

  const handleIncoming = (msg) => {
    if (msg.conversation_id !== conversation.id) return
    setMessages(prev => [...prev, msg])
    onMessage(conversation.id, msg.content)
  }

  const sendMessage = (content) => {
    getSocket().emit('send_message', { conversationId: conversation.id, content })
  }

  const title = conversation.type === 'group' ? conversation.name : conversation.other_username

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.avatar}>{(title || '?')[0].toUpperCase()}</div>
        <div>
          <div style={s.title}>{title}</div>
          <div style={s.subtitle}>{conversation.type === 'group' ? 'Group chat' : 'Direct message'}</div>
        </div>
      </div>

      <div style={s.messages}>
        {loading
          ? <div style={s.loading}>Loading messages...</div>
          : messages.length === 0
            ? <div style={s.loading}>No messages yet. Say hi!</div>
            : messages.map(msg => {
                const mine = msg.sender_id === user.id
                return (
                  <div key={msg.id} style={{ ...s.row, ...(mine ? s.myRow : s.theirRow) }}>
                    {!mine && conversation.type === 'group' && (
                      <div style={s.senderName}>{msg.sender_username}</div>
                    )}
                    <div style={{ ...s.bubble, ...(mine ? s.myBubble : s.theirBubble) }}>
                      {msg.content}
                    </div>
                    <div style={s.time}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })
        }
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} />
    </div>
  )
}

const s = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', background: 'white' },
  header: { padding: '1rem', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: '12px' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', background: '#0084ff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '16px', flexShrink: 0 },
  title: { fontWeight: '600', fontSize: '15px' },
  subtitle: { fontSize: '12px', color: '#999' },
  messages: { flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '2px', background: '#f9f9f9' },
  loading: { textAlign: 'center', color: '#aaa', marginTop: '3rem', fontSize: '14px' },
  row: { display: 'flex', flexDirection: 'column', maxWidth: '65%', marginBottom: '6px' },
  myRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { fontSize: '11px', color: '#888', marginBottom: '3px', paddingLeft: '4px' },
  bubble: { padding: '9px 14px', borderRadius: '18px', fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word' },
  myBubble: { background: '#0084ff', color: 'white', borderBottomRightRadius: '4px' },
  theirBubble: { background: 'white', color: '#222', border: '1px solid #e8e8e8', borderBottomLeftRadius: '4px' },
  time: { fontSize: '10px', color: '#bbb', marginTop: '3px', padding: '0 4px' }
}
