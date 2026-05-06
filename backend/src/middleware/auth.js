const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    console.warn(`[AUTH] Missing token — ${req.method} ${req.path}`)
    return res.status(401).json({ error: 'No token' })
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    console.log(`[AUTH] Token valid — user="${req.user.username}" (${req.user.id}) -> ${req.method} ${req.path}`)
    next()
  } catch {
    console.warn(`[AUTH] Invalid token — ${req.method} ${req.path}`)
    res.status(401).json({ error: 'Invalid token' })
  }
}

module.exports = { authMiddleware, JWT_SECRET }
