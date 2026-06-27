-- Memory Consolidation: Conversation Summaries Table
-- Migration: 0201-memory-consolidation.sql
--
-- Adds conversation_summaries table for storing compressed conversation
-- summaries used by the context manager to stay within token budgets.
--
-- D1-compatible: no IF NOT EXISTS in CREATE TABLE (D1 requires clean CREATE).

CREATE TABLE conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    summary_text TEXT NOT NULL DEFAULT '',
    message_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s') * 1000),
    expires_at INTEGER
);

-- Index: retrieve summaries for a user, ordered by creation time
CREATE INDEX idx_conversation_summaries_user_id
    ON conversation_summaries (user_id, created_at);

-- Index: retrieve a specific summary by conversation + user
CREATE INDEX idx_conversation_summaries_conversation_user
    ON conversation_summaries (conversation_id, user_id);

-- Index: cleanup expired summaries efficiently
CREATE INDEX idx_conversation_summaries_expires_at
    ON conversation_summaries (expires_at)
    WHERE expires_at IS NOT NULL;
