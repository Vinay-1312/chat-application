const Redis = require('ioredis')

const REDIS_HOST = process.env.REDIS_HOST || 'redis'

// pub and sub must be separate clients —
// a client in subscribe mode cannot issue other commands
const pub = new Redis({ host: REDIS_HOST, port: 6379 })
const sub = new Redis({ host: REDIS_HOST, port: 6379 })

pub.on('connect', () => console.log(`[REDIS] Publisher connected — host=${REDIS_HOST}`))
pub.on('error', (err) => console.error('[REDIS] Publisher error:', err.message))

sub.on('connect', () => console.log(`[REDIS] Subscriber connected — host=${REDIS_HOST}`))
sub.on('error', (err) => console.error('[REDIS] Subscriber error:', err.message))
sub.on('subscribe', (channel, count) =>
  console.log(`[REDIS] Subscribed to channel="${channel}" (total active subscriptions: ${count})`)
)
sub.on('unsubscribe', (channel, count) =>
  console.log(`[REDIS] Unsubscribed from channel="${channel}" (total active subscriptions: ${count})`)
)

module.exports = { pub, sub }
