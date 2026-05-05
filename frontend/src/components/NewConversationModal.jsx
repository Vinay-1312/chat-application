import React, { useState } from 'react'
import api from '../api'
import { getSocket } from '../socket'

export default function NewConversationModal({ onClose, onCreated }) {
  const [tab, setTab] = useState('direct')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')

  const searchUsers = async (q) => {
    setSearch(q)
    if (!q.trim()) return setResults([])
    const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
    setResults(data)
  }

  const toggle = (u) => {
    if (tab === 'direct') return setSelected([u])
    setSelected(prev => prev.find(s => s.id === u.id) ? prev.filter(s => s.id !== u.id) : [...prev, u])
  }

  const create = async () => {
    setError('')
    try {
      let conv
      if (tab === 'direct') {
        if (!selected.length) return setError('Select a user')
        const { data } = await api.post('/conversations/direct', { targetUserId: selected[0].id })
        conv = { ...data, other_username: selected[0].username }
      } else {
        if (!groupName.trim()) return setError('Enter a group name')
        if (selected.length < 1) return setError('Select at least one member')
        const { data } = await api.post('/conversations/group', { name: groupName.trim(), memberIds: selected.map(u => u.id) })
        conv = data
      }
      getSocket().emit('join_conversation', { conversationId: conv.id })
      onCreated(conv)
    } catch {
      setError('Something went wrong')
    }
  }

  const canCreate = tab === 'direct' ? selected.length > 0 : selected.length > 0 && groupName.trim()

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>New Conversation</h3>
          <button style={s.close} onClick={onClose}>×</button>
        </div>

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab === 'direct' ? s.activeTab : {}) }} onClick={() => { setTab('direct'); setSelected([]) }}>Direct</button>
          <button style={{ ...s.tab, ...(tab === 'group' ? s.activeTab : {}) }} onClick={() => { setTab('group'); setSelected([]) }}>Group</button>
        </div>

        {tab === 'group' && (
          <input style={s.input} placeholder="Group name" value={groupName} onChange={e => setGroupName(e.target.value)} />
        )}

        <input style={s.input} placeholder="Search users..." value={search} onChange={e => searchUsers(e.target.value)} autoFocus />

        {selected.length > 0 && (
          <div style={s.chips}>
            {selected.map(u => (
              <span key={u.id} style={s.chip}>
                {u.username}
                <span style={s.chipX} onClick={() => toggle(u)}>×</span>
              </span>
            ))}
          </div>
        )}

        <div style={s.list}>
          {results.map(u => (
            <div
              key={u.id}
              style={{ ...s.userRow, ...(selected.find(s => s.id === u.id) ? s.userSelected : {}) }}
              onClick={() => toggle(u)}
            >
              <div style={s.userAvatar}>{u.username[0].toUpperCase()}</div>
              <span style={{ fontSize: '14px' }}>{u.username}</span>
            </div>
          ))}
          {search && results.length === 0 && <div style={s.noResults}>No users found</div>}
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button style={{ ...s.createBtn, opacity: canCreate ? 1 : 0.4 }} onClick={create} disabled={!canCreate}>
          Create
        </button>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'white', borderRadius: '10px', width: '360px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '80vh', overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  close: { background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#999', lineHeight: 1 },
  tabs: { display: 'flex', gap: '8px' },
  tab: { flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white', fontSize: '14px' },
  activeTab: { background: '#0084ff', color: 'white', borderColor: '#0084ff' },
  input: { padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', outline: 'none' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: { background: '#e8f0fe', color: '#0084ff', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' },
  chipX: { cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', lineHeight: 1 },
  list: { maxHeight: '180px', overflowY: 'auto' },
  userRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer' },
  userSelected: { background: '#e8f0fe' },
  userAvatar: { width: '32px', height: '32px', borderRadius: '50%', background: '#0084ff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '13px', flexShrink: 0 },
  noResults: { padding: '1rem', textAlign: 'center', color: '#aaa', fontSize: '13px' },
  error: { color: '#e53935', fontSize: '13px' },
  createBtn: { padding: '10px', background: '#0084ff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }
}
