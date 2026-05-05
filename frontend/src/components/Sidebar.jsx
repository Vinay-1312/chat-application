import React, { useState } from 'react'
import NewConversationModal from './NewConversationModal'

export default function Sidebar({ user, conversations, activeId, onSelect, onNewConversation, onLogout }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div style={s.sidebar}>
      <div style={s.header}>
        <span style={s.username}>{user.username}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={s.iconBtn} onClick={() => setShowModal(true)} title="New conversation">+</button>
          <button style={s.iconBtn} onClick={onLogout} title="Logout">↩</button>
        </div>
      </div>

      <div style={s.list}>
        {conversations.length === 0 && (
          <div style={s.empty}>No conversations yet. Hit + to start one.</div>
        )}
        {conversations.map(conv => {
          const title = conv.type === 'group' ? conv.name : conv.other_username
          return (
            <div
              key={conv.id}
              style={{ ...s.item, ...(activeId === conv.id ? s.itemActive : {}) }}
              onClick={() => onSelect(conv)}
            >
              <div style={s.avatar}>{(title || '?')[0].toUpperCase()}</div>
              <div style={s.itemBody}>
                <div style={s.itemTitle}>{title}</div>
                <div style={s.itemPreview}>{conv.last_message || 'No messages yet'}</div>
              </div>
              {conv.type === 'group' && <span style={s.badge}>G</span>}
            </div>
          )
        })}
      </div>

      {showModal && (
        <NewConversationModal
          onClose={() => setShowModal(false)}
          onCreated={conv => { onNewConversation(conv); setShowModal(false) }}
        />
      )}
    </div>
  )
}

const s = {
  sidebar: { width: '280px', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', background: '#fafafa' },
  header: { padding: '1rem', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' },
  username: { fontWeight: '600', fontSize: '15px' },
  iconBtn: { background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '15px', color: '#444' },
  list: { flex: 1, overflowY: 'auto' },
  empty: { padding: '2rem 1rem', textAlign: 'center', color: '#aaa', fontSize: '13px' },
  item: { display: 'flex', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', gap: '10px', borderBottom: '1px solid #f0f0f0' },
  itemActive: { background: '#e8f0fe' },
  avatar: { width: '38px', height: '38px', borderRadius: '50%', background: '#0084ff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '15px', flexShrink: 0 },
  itemBody: { flex: 1, overflow: 'hidden' },
  itemTitle: { fontWeight: '500', fontSize: '14px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemPreview: { fontSize: '12px', color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  badge: { fontSize: '10px', background: '#e8f0fe', color: '#0084ff', padding: '2px 5px', borderRadius: '4px', fontWeight: '600', flexShrink: 0 }
}
