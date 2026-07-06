-- =====================================================================
-- Arattai Chat — Cassandra DDL (per Arattai_Database_Design.docx §3)
-- Run: cqlsh -f cassandra.cql
--
-- Design doc §3.5 offers two layouts: 12 tables (4 per chat type) or the
-- simpler 4-table layout where the chat type is encoded in the id prefix
-- (dm:{u1}:{u2}, g:{group_id}, sg:{subgroup_id}). The backend DAOs use
-- prefixed ids, so this schema uses the 4-table layout.
-- =====================================================================

CREATE KEYSPACE IF NOT EXISTS arattai
    WITH replication = {
        'class'              : 'SimpleStrategy',
        'replication_factor' : 1
    }
    AND durable_writes = true;

USE arattai;

-- ── 3.1 messages_by_chat — the actual messages ────────────────────────
--
-- Partition key : chat_id    — all messages of one chat sit in one partition
-- Clustering    : message_id DESC — TimeUUID gives time ordering for free
--
-- Read path: SELECT * FROM messages_by_chat WHERE chat_id = ? LIMIT 50
-- Scroll up: ... AND message_id < last_seen_id

CREATE TABLE IF NOT EXISTS messages_by_chat (
    chat_id             text,
    message_id          timeuuid,
    sender_id           bigint,
    content             text,
    message_type        text,       -- text / image / video / file
    media_url           text,       -- link if it is media
    reply_to_message_id timeuuid,   -- set when this message replies to another
    edited              boolean,
    deleted             boolean,
    created_at          timestamp,
    PRIMARY KEY ((chat_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
  AND comment = 'All messages for a given chat, ordered newest-first';

-- ── 3.2 conversations_by_user — the inbox list ────────────────────────
--
-- Partition key : user_id — one query returns the user's whole inbox
-- Clustering    : chat_id — NOT last_message_time: clustering keys cannot
--                 be updated, so every new message would need delete+insert.
--                 Sorting by last_message_at happens in Java after fetch.
-- One row per (user, chat); every new message upserts the row for each member.

CREATE TABLE IF NOT EXISTS conversations_by_user (
    user_id           bigint,
    chat_id           text,
    chat_name         text,       -- display name (group name / other user)
    other_user_id     bigint,     -- the other person, for 1-to-1 chats
    last_message      text,       -- preview text shown in the list
    last_message_type text,       -- text / image etc
    last_sender_id    bigint,     -- to render "You: hi" when it is our own
    last_message_at   timestamp,  -- for sorting the list in the app
    unread_count      int,        -- live counter lives in Redis; snapshot here
    is_pinned         boolean,
    is_muted          boolean,
    PRIMARY KEY ((user_id), chat_id)
) WITH comment = 'Inbox: one row per (user, chat), upserted on every message';

-- ── 3.3 read_state — till where the user has read ─────────────────────
--
-- One row per (chat, user), NOT one row per message: everything after
-- last_read_id is unread. Updated only when the user opens the chat.
-- Also powers the seen / double-tick feature.

CREATE TABLE IF NOT EXISTS read_state (
    chat_id      text,
    user_id      bigint,
    last_read_id timeuuid,
    last_read_at timestamp,
    PRIMARY KEY ((chat_id), user_id)
) WITH comment = 'Tracks the last message each user has read in each chat';

-- ── 3.4 message_dedup — no duplicate messages on client retry ─────────
--
-- Client generates client_msg_id before sending; retries reuse it.
-- PersistConsumer checks here first (LWT insert) and skips duplicates.
-- TTL 24h — only needed during the retry window.

CREATE TABLE IF NOT EXISTS message_dedup (
    chat_id       text,
    client_msg_id text,
    message_id    timeuuid,
    sender_id     bigint,
    created_at    timestamp,
    PRIMARY KEY ((chat_id), client_msg_id)
) WITH default_time_to_live = 86400
  AND comment = 'Maps client-side idempotency key to server message_id';
