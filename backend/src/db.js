const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: 5432,
  database: process.env.DB_NAME || 'chatdb',
  user: process.env.DB_USER || 'chat',
  password: process.env.DB_PASSWORD || 'chatpass'
})

pool.on('connect', () => console.log('[DB] New client connected to PostgreSQL pool'))
pool.on('error', (err) => console.error('[DB] Unexpected error on idle client:', err.message))

console.log(`[DB] PostgreSQL pool created — host=${process.env.DB_HOST || 'postgres'} db=${process.env.DB_NAME || 'chatdb'}`)

module.exports = pool
