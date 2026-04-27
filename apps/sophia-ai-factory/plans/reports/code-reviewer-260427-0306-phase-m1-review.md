# Code Review — Sprint M Phase M1 (Revenue Pipeline Unblocker)

Reviewed: 4 files (2 SQL migrations, 1 shell, 1 TS handler)
Date: 2026-04-27 03:06
Reviewer: code-reviewer

## Score: 7.5/10 — REJECT auto-merge (1 critical pre-existing schema mismatch surfaced; 1 high)

Threshold for auto-approve was 9.5+ with 0 critical/high. Migrations themselves are clean SQLite; refactor is functionally correct. But the M1 changes EXPOSE an existing bug that becomes blocking once you actually rely on the new D1-only handler in production (no Supabase fallback anymore). Address Critical-1 before declaring "revenue pipeline unblocked."

---

## Critical (1)

### C1. `user_profiles` schema is missing `subscription_tier` AND `telegram_chat_id` columns
- **Evidence:**
  - `migrations/0004-user-profiles.sql:1-12` — only defines `id, user_id, settings, api_keys, created_at, updated_at`
  - No subsequent `ALTER TABLE user_profiles ADD COLUMN ...` exists in `migrations/*.sql` (grep returned 0 hits)
  - Handler depends on both: `telegram-bot-campaign-handlers.ts:76` selects `subscription_tier`, line 77 filters `.eq('telegram_chat_id', chatId)`
  - Same pattern used by `campaign-handler.ts:70`, `status-handler.ts:31`, `results-handler.ts:19`, `email-handler.ts:60`, etc.
  - `src/app/api/debug/migrate/route.ts:33-41` is the ONLY place that creates a fuller `user_profiles` (with `subscription_tier`, `display_name`, `avatar_url`) — temp debug endpoint; `telegram_chat_id` STILL absent
- **Impact:** In production D1, every `/campaign`, `/status`, `/results`, `/email` call returns `error: no such column` from SQLite. Handler returns "Account not linked" or "Failed to create campaign" — silent failure for the user, real failure for revenue path.
- **Fix (REQUIRED before M1 ship):** Add migration `0020-user-profiles-extend.sql`:
  ```sql
  ALTER TABLE user_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
  ALTER TABLE user_profiles ADD COLUMN telegram_chat_id TEXT;
  CREATE INDEX IF NOT EXISTS idx_user_profiles_telegram_chat_id ON user_profiles(telegram_chat_id);
  CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);
  ```
  Then run `npx wrangler d1 execute sophia-raas-db --remote --file=migrations/0020-user-profiles-extend.sql`.

## High (2)

### H1. Test coverage doesn't actually exercise the modified file
- `telegram-bot.test.ts:1-9` imports from `./telegram-command-handlers`, NOT `./telegram-bot-campaign-handlers` (the file you changed). The "8/8 pass" claim is for an unrelated facade. Same code paths exist in BOTH (campaign-handler.ts vs telegram-bot-campaign-handlers.ts) — duplication risk.
- **Action:** Either (a) consolidate to a single handler file (DRY violation today) or (b) add `telegram-bot-campaign-handlers.test.ts` covering the new D1 row types + tier mapping.

### H2. Tier mapping doesn't honor D1 storage convention
- `mapSubscriptionToTier` accepts lowercase values (`'pro' | 'premium' | 'enterprise' | 'master' | 'basic' | 'free'`), but per project rule (Sophia CLAUDE.md "Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER (uppercase only)") and `debug/migrate/route.ts:36` (`subscription_tier TEXT DEFAULT 'BASIC'`), the D1 column is/should-be uppercase. Current switch will fall through to `BASIC` for an `'ENTERPRISE'` row.
- **Fix:** `switch (subTier?.toLowerCase()) { ... }` OR keep uppercase-only branches. Pick one and align with NOWPayments IPN writer.

## Medium (3)

### M1. `is_revoked` boolean ↔ INTEGER coercion not verified in client layer
- Migration uses INTEGER 0/1 (correct for SQLite). `raas-license-crud.ts:39` writes `is_revoked: false` (boolean). `raas-permission-checker.ts:31,52` reads as `existingLicense.is_revoked` truthy check. SQLite/D1 stores `false` as INTEGER 0 silently, but the typed return type `RaasLicense` declares `boolean`. Reader does `if (existingLicense.is_revoked)` — `0` is falsy in JS so this works in practice, but `license.is_revoked` flowing into `LicenseSummary.isRevoked` will leak `0/1` into JSON responses (not `true/false`).
- **Action:** Either coerce in `getLicenses` mapper (`isRevoked: !!license.is_revoked`) or add `getter` in row mapper. Not blocking, but client UIs comparing `=== true` will silently misbehave.

### M2. `raas_audit_logs` writer never produces `content_hash`/`previous_log_hash`/`hash_chain_valid`, but reader expects them
- Writer: `audit-logging-service.ts:66-79` does NOT compute or insert hash chain fields.
- Reader: `cron-report-runner-data-fetcher.ts:38,47` SELECTs `content_hash, hash_chain_valid` and uses fallbacks `?? true / || 'N/A'`. Migration 0019 omits these columns entirely, so SQLite raises `no such column` on every compliance report run — caught silently by the surrounding try/catch (line 25).
- **Action:** Either (a) extend 0019 with `content_hash TEXT, previous_log_hash TEXT, hash_chain_valid INTEGER DEFAULT 1` + future writer wiring, or (b) update `cron-report-runner-data-fetcher.ts` to drop those SELECT columns (preferred for KISS — hash chain isn't implemented yet).

### M3. `campaigns.script_content` vs writer semantics
- Migration declares `script_content TEXT` (JSON-encoded). Writer in `generate-campaign-db.ts:17` writes `script_content` as a string. Older Supabase consumers and `debug/migrate/route.ts:26` use column name `script` (no `_content`). Confirm no analytics/dashboard query reads `campaigns.script` — quick grep should be done at deploy time.
- Migration also has no `platforms` column, but `campaigns.ts:15-26` reads `formData.getAll("platforms")` — looks like only used for tier-gate, not persisted. OK.

## Low (3)

- L1. `telegram-bot-campaign-handlers.ts:104-108` casts insert payload via `as unknown as Record<string, unknown>` — works but loses type safety. The local `CampaignD1Row` interface should be the actual insert type; use a `CampaignInsert` variant without `created_at`/`updated_at`.
- L2. `telegram-bot-campaign-handlers.ts:132,177,224` swallow errors with bare `catch {}`. Replace with `catch (e) { logger.error('handleCampaign failed', toError(e)) }` for production observability (project standard logger is in `@/lib/utils/logger-utility`).
- L3. `m1-set-secrets.sh:21-30` lists 8 secrets but task mentioned "8 CF Secrets"; the array has 8 entries — matches. No issue. Script otherwise clean: `set -e`, safe `dirname` cd, no echo of values, prompts via `wrangler secret put` stdin.

## Edge Cases Found (Scout)

- D1 `crypto.randomUUID()` (handler line 89) works in Workers runtime, but parallel inserts in a hot path could collide with the column DEFAULT `lower(hex(randomblob(16)))`. Not a real risk (UUID v4 collision space) — informational.
- Migration 0019 partial index `WHERE is_revoked = 0` requires SQLite 3.32+; D1 ships 3.44+ — supported.
- `crypto.randomUUID()` is a 36-char string with hyphens; Better Auth users.id is 32-char hex (no hyphens). FK `user_id REFERENCES users(id)` accepts any TEXT — D1 doesn't enforce FK by default (PRAGMA foreign_keys=OFF); shape mismatch won't fail INSERT but joins might confuse future debugging. Document or align ID format.

## Positive Observations

- Migrations use `IF NOT EXISTS` consistently — re-runnable.
- No PostgreSQL constructs leaked: zero `uuid`/`gen_random_uuid()`/`timestamptz`/`jsonb`/`RLS`/triggers found.
- CHECK constraints on `status`, `progress`, `tier`, `action` — defensive.
- All FK targets exist (`users(id)` from `0001-init.sql:6`, `raas_licenses(id)` from same file 0019).
- Indexes match dashboard query patterns (`idx_campaigns_user_id`, `idx_campaigns_status`, `idx_campaigns_created_at DESC`, license `idx_raas_licenses_active` partial index for active filter).
- Shell script is paranoid by design (no echoing values, ctrl+D pattern, post-run verify hint).
- Refactor preserves zero `:any` discipline — local interfaces over Supabase generated types.
- Sensible MASTER tier mapping addition (was missing in old switch).

## Recommended Actions (priority order)

1. **BLOCK MERGE** until C1 fixed — add `0020-user-profiles-extend.sql` with `subscription_tier` + `telegram_chat_id` + indexes.
2. Add real test for `telegram-bot-campaign-handlers.ts` (H1).
3. Decide tier-string casing convention and align mapper + DB writer (H2).
4. Drop `content_hash`/`hash_chain_valid` SELECTs from compliance reader OR add columns + writer (M2).
5. Coerce `is_revoked` to boolean in license mapper (M1).
6. Replace bare `catch {}` with structured logging (L2).
7. After fixes, re-run `npm test` and add a smoke E2E: `/campaign test → /status → completes` against dev D1.

## Metrics

- TS errors introduced by diff: 0 (per fullstack-developer report)
- New `:any` types: 0
- Lines added: 75, removed: 35 (handler) + 36 + 53 (migrations) + 41 (script)
- Test deltas: 0 new tests for the modified file (gap)
- Migration safety: idempotent ✅, FK targets valid ✅, partial-index requires SQLite 3.32+ ✅ supported

## Unresolved Questions

1. Is `user_profiles.subscription_tier` populated by NOWPayments IPN writer (which file?) or stored elsewhere (e.g., `users.subscription_tier`, `raas_licenses.tier`)? Need writer file:line so we know if C1 fix is "add column" or "switch handler to read from licenses".
2. The duplicate handler files (`telegram-bot-campaign-handlers.ts` vs `handlers/campaign-handler.ts`) — is one slated for deletion? Risk of fixing one and forgetting the other is high.
3. `script_content` (migration) vs `script` (debug route) — which is canonical? If both writers exist, suggest dropping the debug route after M1 ships.
