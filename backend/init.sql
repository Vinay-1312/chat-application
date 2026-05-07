CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);

-- Debezium uses this publication to know which tables to stream
CREATE PUBLICATION debezium_pub FOR TABLE messages;

CREATE TABLE IF NOT EXISTS outbox_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

-- partial index: only unpublished rows — keeps the worker query fast
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(created_at)
  WHERE published_at IS NULL;
