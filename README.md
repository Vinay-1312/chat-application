# Chat Application

A horizontally scalable real-time chat application built as a system design exercise. Supports direct messages and group conversations across multiple backend nodes.

## Architecture

```
Browser
  │
  ▼
Envoy (port 10000)          ← reverse proxy + load balancer
  │  Ring hash on x-user-id header (same user always hits same node)
  ├── Node 1 (Express + Socket.IO)
  ├── Node 2 (Express + Socket.IO)
  └── Node 3 (Express + Socket.IO)
       │
       ├── PostgreSQL          ← persistent storage
       ├── Redis Pub/Sub       ← cross-node event delivery
       └── Redis Streams       ← Debezium CDC pipeline
            ▲
         Debezium              ← reads Postgres WAL, writes to Redis Stream
```

## Message Flow

1. Client sends `send_message` over WebSocket to its node
2. Node writes the message to PostgreSQL
3. Debezium detects the INSERT via WAL (logical replication) and writes to a Redis Stream
4. Each node's stream consumer reads from the stream using a consumer group (exactly-once delivery)
5. Consumer publishes to `room:<conversationId>` Redis Pub/Sub channel
6. Every node subscribed to that channel delivers the message to its locally connected sockets

## Key Design Decisions

**Why Ring Hash load balancing?**
Socket.IO connections are stateful — a user must always reach the same node to maintain their WebSocket. Envoy hashes on the `x-user-id` header to guarantee this.

**Why Redis Pub/Sub for cross-node delivery?**
When a message arrives at Node 1, users in that conversation may be connected to Node 2 or 3. Publishing to a Redis channel lets all nodes fan out to their local sockets without Node 1 needing to know where everyone is.

**Why Debezium instead of publishing directly from the socket handler?**
Writing to the DB and publishing to Redis are two separate operations — a node crash between them loses the message. Debezium reads from the Postgres Write-Ahead Log, so the message is only published after it is durably committed.

**Why Redis Streams instead of Pub/Sub for the Debezium pipeline?**
Pub/Sub is fire-and-forget. Streams persist messages and support consumer groups, so if a node is down when Debezium publishes, it catches up when it restarts. The consumer group also ensures exactly one node processes each message.

## Features

- Real-time messaging (WebSocket via Socket.IO)
- Direct messages and group conversations
- Online presence for direct message contacts
- Multi-tab support (one user, multiple browser tabs)
- Messages persist across reconnects

## Online Presence

Presence is tracked per-user in Redis (`presence:<userId>` key with a 30s TTL).

- **On connect (first tab):** key is set, DM partners are notified via `user_online` event
- **Server heartbeat (every 20s):** TTL is refreshed for all connected users on that node
- **On disconnect (last tab):** key is deleted, DM partners notified via `user_offline`
- **Snapshot (every 30s):** each connected client receives a fresh `presence_snapshot` to correct any drift caused by node crashes (where `user_offline` was never published)

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express + Socket.IO |
| Database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7 |
| CDC | Debezium Server 2.7 |
| Load Balancer | Envoy Proxy |
| Containers | Docker Compose |

## Running Locally

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API / WebSocket | http://localhost:10000 |
| Envoy admin | http://localhost:9901 |

## Database Schema

```
users           — id, username, password_hash
conversations   — id, type (direct/group), name
members         — conversation_id, user_id
messages        — id, conversation_id, sender_id, content, created_at
outbox_events   — used for publishing non-message events (e.g. new_conversation)
```
