import React, { useState } from 'react'
import api from '../api'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post(`/auth/${mode}`, { username, password })
      onLogin(data.user, data.token)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h2 style={{ marginBottom: '1.5rem' }}>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
        <form onSubmit={submit}>
          <input
            style={s.input}
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <p style={s.error}>{error}</p>}
          <button style={s.button} type="submit">
            {mode === 'login' ? 'Sign In' : 'Register'}
          </button>
        </form>
        <p style={s.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span style={s.link} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Sign In'}
          </span>
        </p>
      </div>
    </div>
  )
}

const s = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' },
  card: { background: 'white', padding: '2rem', borderRadius: '8px', width: '320px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' },
  input: { display: 'block', width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' },
  button: { width: '100%', padding: '0.75rem', background: '#0084ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  error: { color: '#e53935', fontSize: '13px', marginBottom: '0.75rem' },
  toggle: { textAlign: 'center', marginTop: '1rem', fontSize: '13px', color: '#666' },
  link: { color: '#0084ff', cursor: 'pointer', fontWeight: '500' }
}
