-- Migration 0483: Add Better Auth twoFactorEnabled column to the user table.
--
-- Better Auth 1.6.29 writes `twoFactorEnabled` on every user insert. Without
-- this column the insert fails with "table user has no column named
-- twoFactorEnabled", which surfaces to the customer as a generic signup error.
--
-- Kept as a single statement with no DROP or RENAME so the pre-flight guard
-- has nothing to reject and cannot silently discard this column. The table
-- name stays unquoted because the ADD COLUMN guard probes
-- pragma_table_info('user'), which matches nothing when quoted.

ALTER TABLE user ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0;
