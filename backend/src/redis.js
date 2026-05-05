const Redis = require('ioredis')

// pub and sub must be separate clients —
// a client in subscribe mode cannot issue other commands
const pub = new Redis({ host: process.env.REDIS_HOST || 'redis', port: 6379 })
const sub = new Redis({ host: process.env.REDIS_HOST || 'redis', port: 6379 })

module.exports = { pub, sub }
