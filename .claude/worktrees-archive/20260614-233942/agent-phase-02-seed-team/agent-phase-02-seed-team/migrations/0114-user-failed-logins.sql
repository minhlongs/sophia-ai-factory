-- F01: Per-account failed-login rate limit (ASVS V2.2.2)
-- Adds lockout tracking columns to the Better Auth "user" table.

ALTER TABLE "user" ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN locked_until INTEGER; -- unix ms timestamp, NULL = not locked

CREATE INDEX idx_user_locked_until ON "user"(locked_until) WHERE locked_until IS NOT NULL;
