const router = require('express').Router()
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query
  try {
    const result = await db.query(
      'SELECT id, username FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 10',
      [`%${q}%`, req.user.id]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
