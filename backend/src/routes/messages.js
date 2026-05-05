const router = require('express').Router()
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

router.get('/:conversationId', authMiddleware, async (req, res) => {
  const { before, limit = 50 } = req.query
  try {
    const member = await db.query(
      'SELECT 1 FROM members WHERE conversation_id = $1 AND user_id = $2',
      [req.params.conversationId, req.user.id]
    )
    if (!member.rows.length) return res.status(403).json({ error: 'Not a member' })

    let query, params
    if (before) {
      query = `
        SELECT m.id, m.content, m.created_at, u.id AS sender_id, u.username AS sender_username
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1 AND m.created_at < $2
        ORDER BY m.created_at DESC LIMIT $3
      `
      params = [req.params.conversationId, before, limit]
    } else {
      query = `
        SELECT m.id, m.content, m.created_at, u.id AS sender_id, u.username AS sender_username
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at DESC LIMIT $2
      `
      params = [req.params.conversationId, limit]
    }

    const result = await db.query(query, params)
    res.json(result.rows.reverse())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
