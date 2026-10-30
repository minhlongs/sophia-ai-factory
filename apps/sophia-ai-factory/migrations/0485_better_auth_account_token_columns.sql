-- Migration 0485: Add Better Auth token lifecycle columns to the account table.
--
-- Better Auth v1.6+ validates and selects `idToken`, `accessTokenExpiresAt`,
-- and `refreshTokenExpiresAt` on `account` across `/api/auth/*` routes.
-- `0003-better-auth.sql` created `account` without these three columns, which
-- caused `/api/auth/get-session`, `/api/auth/sign-in/email`, and
-- `/api/auth/sign-up/email` to fail with HTTP 500 in production.
--
-- Table names remain unquoted and each statement stays on a single line so
-- `guard_add_column` in `scripts/apply-migrations.sh` can inspect
-- `pragma_table_info('account')` accurately.

ALTER TABLE account ADD COLUMN idToken TEXT;
ALTER TABLE account ADD COLUMN accessTokenExpiresAt TEXT;
ALTER TABLE account ADD COLUMN refreshTokenExpiresAt TEXT;
