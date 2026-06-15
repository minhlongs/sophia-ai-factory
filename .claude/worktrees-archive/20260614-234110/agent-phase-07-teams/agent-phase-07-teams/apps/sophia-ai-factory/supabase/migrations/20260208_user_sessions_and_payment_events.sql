-- User sessions table for Telegram bot state backup (Smart Resume)
-- Backs up Redis FSM state to Postgres on critical events

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  context_data JSONB NOT NULL DEFAULT '{}',
  last_event TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_chat_id ON user_sessions(telegram_chat_id);
CREATE INDEX idx_user_sessions_updated ON user_sessions(updated_at);

-- Payment events audit trail for Polar.sh webhook idempotency
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  polar_event_id TEXT UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_events_polar_id ON payment_events(polar_event_id);
CREATE INDEX idx_payment_events_processed ON payment_events(processed);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
