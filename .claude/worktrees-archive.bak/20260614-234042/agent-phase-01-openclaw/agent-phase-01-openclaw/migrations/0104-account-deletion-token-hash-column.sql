-- Wave 22 Phase 01 — Add hash column for account-delete confirmation tokens
-- New rows write sha256(token) here; raw token never persisted.
-- Old `confirmation_token` column kept (NOT NULL) for backward-compat read
-- path; legacy in-flight rows fall back to raw compare. Drop legacy column
-- in Wave 23 after the 7-day cooldown rows from pre-deploy expire.

ALTER TABLE account_deletion_requests
  ADD COLUMN confirmation_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_acct_del_token_hash
  ON account_deletion_requests(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;
