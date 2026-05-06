const router = require('express').Router()
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

router.get('/:conversationId', authMiddleware, async (req, res) => {
  const { before, limit = 50 } = req.query
  console.log(`[ROUTE:messages] Fetch history — conversationId=${req.params.conversationId} user="${req.user.username}" limit=${limit}${before ? ` before=${before}` : ''}`)
  try {
    const member = await db.query(
      'SELECT 1 FROM members WHERE conversation_id = $1 AND user_id = $2',
      [req.params.conversationId, req.user.id]
    )
    if (!member.rows.length) {
      console.warn(`[ROUTE:messages] Access denied — user="${req.user.username}" is not a member of conversationId=${req.params.conversationId}`)
      return res.status(403).json({ error: 'Not a member' })
    }

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
    console.log(`[ROUTE:messages] Returning ${result.rows.length} message(s) for conversationId=${req.params.conversationId}`)
    res.json(result.rows.reverse())
  } catch (err) {
    console.error('[ROUTE:messages] Fetch error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
