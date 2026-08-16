-- WHATSAPP_TEMPLATES — template registry (BYOK phone_number_id + WA_TOKEN)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  provider_id INTEGER,                  -- NULL until upgrade to multi-provider tracking
  phone_number_id TEXT NOT NULL,
  wa_token     TEXT NOT NULL,           -- encrypted at rest by D1 app-level policy
  waba_id      TEXT,
  business_id  TEXT,
  is_default   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user
  ON whatsapp_templates(user_id);

-- WHATSAPP_MESSAGE_LOG — per-account send/react delivery log
CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id      INTEGER NOT NULL REFERENCES whatsapp_templates(id),
  user_id          INTEGER NOT NULL REFERENCES users(id),
  provider_id      INTEGER,            -- platform identity (meta_page_id / wa_number)
  recipient        TEXT NOT NULL,      -- wa:{E.164} | ig:{PSID} | fb:{PSID}
  channel          TEXT NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  extern_message_id TEXT,
  kind             TEXT NOT NULL CHECK (kind IN ('send','react','template','media')),
  sub_type         TEXT,               -- button_reply, list_reply, sticker, image, video, etc.
  text_preview     TEXT,
  caption          TEXT,
  payload          TEXT,
  client_status    TEXT NOT NULL DEFAULT ('received'),
  error_code       TEXT,
  error_message    TEXT,
  error_category   TEXT,               -- AUTH_FAILURE | RATE_LIMIT | SERVER_ERROR | VALIDATION
  retry_count      INTEGER NOT NULL DEFAULT 0,
  send_meta        TEXT,               -- raw wa/meta response for auditing
  sent_at          INTEGER,
  delivered_at     INTEGER,
  read_at          INTEGER,
  failed_at        INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_log_user
  ON whatsapp_message_log(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_msg_log_template
  ON whatsapp_message_log(template_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_msg_log_channel
  ON whatsapp_message_log(channel);