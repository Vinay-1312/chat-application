const router = require('express').Router()
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query
  console.log(`[ROUTE:users] Search — query="${q}" by user="${req.user.username}"`)
  try {
    const result = await db.query(
      'SELECT id, username FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 10',
      [`%${q}%`, req.user.id]
    )
    console.log(`[ROUTE:users] Search returned ${result.rows.length} result(s) for query="${q}"`)
    res.json(result.rows)
  } catch (err) {
    console.error('[ROUTE:users] Search error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
