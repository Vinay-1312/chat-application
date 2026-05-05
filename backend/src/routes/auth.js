const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db')
const { JWT_SECRET } = require('../middleware/auth')

router.post('/register', async (req, res) => {
  const { username, password } = req.body
  try {
    const hash = await bcrypt.hash(password, 10)
    const result = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    )
    const user = result.rows[0]
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET)
    res.json({ token, user })
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username taken' })
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username])
    const user = result.rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET)
    res.json({ token, user: { id: user.id, username: user.username } })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
