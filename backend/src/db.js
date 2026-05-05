const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: 5432,
  database: process.env.DB_NAME || 'chatdb',
  user: process.env.DB_USER || 'chat',
  password: process.env.DB_PASSWORD || 'chatpass'
})

module.exports = pool
