import React, { useState } from 'react'

export default function MessageInput({ onSend }) {
  const [text, setText] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(e)
    }
  }

  return (
    <form onSubmit={submit} style={s.form}>
      <input
        style={s.input}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        autoFocus
      />
      <button style={{ ...s.button, opacity: text.trim() ? 1 : 0.5 }} type="submit">Send</button>
    </form>
  )
}

const s = {
  form: { display: 'flex', padding: '1rem', borderTop: '1px solid #e8e8e8', gap: '8px', background: 'white' },
  input: { flex: 1, padding: '10px 16px', border: '1px solid #e0e0e0', borderRadius: '24px', fontSize: '14px', outline: 'none' },
  button: { padding: '10px 22px', background: '#0084ff', color: 'white', border: 'none', borderRadius: '24px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }
}
