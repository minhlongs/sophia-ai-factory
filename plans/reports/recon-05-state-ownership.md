# RECON-05: State / Data Ownership Audit

**Scope:** Section 8 — Inventory all important state in Sophia AI Factory, determine source of truth per datum, identify duplicated / legacy / migration-debt state, race-condition risk, and eventual-consistency risk.

**Method:** Read-only scan of source + migrations + bindings. No code executed.

---

## 1. State Stores — Inventory

| Store | Binding / Location | Purpose | Source of Truth? |
|---|---|---|---|
| Cloudflare D1 `sophia-raas-db` | `wrangler.toml:52-56` (binding `DB`) | Primary relational state — users, subscriptions, billing, video jobs, missions, quota, audit logs, referrals, SOPs, marketplace | **YES — canonical** |
| Cloudflare D1 `sophia-tag-cache` | `wrangler.toml:63-66` (binding `NEXT_TAG_CACHE_D1`) | Next.js `revalidateTag` cache (ISR tag invalidation) | **YES — for tag cache only** |
| Cloudflare R2 `sophia-ai-factory-opennext-cache` | `wrangler.toml:38-40` (binding `NEXT_INC_CACHE_R2_BUCKET`) | OpenNext build cache | Derived (rebuildable) |
| Cloudflare R2 `sophia-videos` | `wrangler.toml:44-46` (binding `VIDEO_BUCKET`) | Generated video assets | **YES — video binary store** |
| Cloudflare R2 `sophia-backups` | `wrangler.toml:48-49` (binding `BACKUPS_BUCKET`) | D1 snapshot backups | Derived (from D1) |
| Cloudflare KV `EXPERIMENT_KV` | `wrangler.toml:122-125` | PostHog feature flags + A/B variant cache (60s TTL) | **YES — for feature flags** |
| Cloudflare KV `KV_KV` | `wrangler.toml:127-129` | General-purpose KV (quota cache, session cache, rate-limit counters) | **YES — for ephemeral caches** |
| Upstash Redis | `src/land/redis.ts:1`, `src/tree/clients/upstash-redis-client.ts:1`, `src/seed/cache/redis.ts:1`, `src/seed/utils/redis-client.ts:9`, `src/seed/redis.ts:7` | Session store, quota cache, rate-limit counters, LLM response cache | **YES — for session/rate-limit** (but see §4) |
| Inngest Cloud | `src/seed/inngest/client.ts` | Job queue state (video generation, fulfillment, dunning, retry) | **YES — for job queue** |
| NOWPayments Cloud | `src/land/payments/nowpayments-ipn-handlers.ts`, `src/land/billing/overage-topup.ts:49` | Payment invoice state, IPN delivery | **YES — for payment confirmation** |
| Supabase | `src/tree/database/supabase-types.ts` (type-only) | OAuth callbacks, legacy shared flows | Type-only — no runtime client |
| Filesystem (OpenNext build) | `.open-next/` | Build artifacts, worker bundle | Derived (rebuildable) |

---

## 2. Source-of-Truth Map — By Domain

### 2.1 User State
| Datum | Source of Truth | Location |
|---|---|---|
| User identity (id, email, name) | Better Auth `user` table (singular) | `migrations/0003-better-auth.sql` |
| User tier / plan | `subscriptions.plan` + `organizations.plan` | `src/seed/db/get-user-tier.ts` |
| Tier enum mapping | `DB_TIER_MAPPING` in `src/seed/config/tiers/tier-configs.ts:149-156` | |
| MCU credit balance | `user_credits` table (top-up credits) + `user_mcu_balance` table (monthly allocation) | `src/land/billing/overage-topup.ts:231-238`, `src/tree/mcu/credits-repo.ts:35` |
| Wallet balance | `user_wallets` table | `migrations/0023` (referenced in wrangler cron `wallet-rebuild`) |
| Onboarding status | `user_profiles.onboarding_completed_at` | `migrations/0004-user-profiles.sql` |
| BYOK API keys | `user_api_keys` table | `migrations/0011-user-api-keys.sql` |

### 2.2 Billing State
| Datum | Source of Truth | Location |
|---|---|---|
| Subscription status | `subscriptions` table (plan, status, user_id, org_id) | `src/land/refunds/refund-processor.ts:308-311` |
| Payment events | `payment_events` table (atomic lock) | `src/land/billing/overage-topup.ts:121-126` |
| Pending top-ups | `pending_topups` table | `src/land/billing/overage-topup.ts:67-75` |
| Overage events | `overage_events` table (billable flag) | `src/seed/db/overage-billing-ops.ts` |
| Refund ledger | `refund_ledger` table | `migrations/0208_refund_events_and_ledger.sql` |
| Refund atomic lock | `refund_events` table | `src/land/refunds/refund-processor.ts:98-102` |
| Video cost tracking | `video_cost_log` + `video_jobs.cost_usd` | `src/land/video/templates/cost-ledger.ts` |
| NOWPayments invoice IDs | `NOWPAYMENTS_INVOICE_IDS` constant | `src/seed/config/tiers/tier-configs.ts:12-17` |

### 2.3 Creative / Video State
| Datum | Source of Truth | Location |
|---|---|---|
| Video job status | `video_jobs` table | `migrations/0031-video-pipeline-jobs.sql` |
| Video cost | `video_cost_log` table + `video_jobs.cost_usd` | `src/land/video/templates/cost-ledger.ts` |
| Video binary | R2 `VIDEO_BUCKET` | `wrangler.toml:44-46` |
| Video templates | `video_templates` table | `migrations/0033-video-templates.sql` |
| Publishing jobs | `publishing_jobs` table | `wrangler.toml:139-143` (Wave 17) |
| Fulfillment state | `video_fulfillment_state` table | `migrations/0040-videos-fulfillment-state.sql` |

### 2.4 Mission State
| Datum | Source of Truth | Location |
|---|---|---|
| Mission lifecycle | `missions` table (status authority) | `src/forest/inngest/functions/` |
| Mission checkpoints | `pipeline_checkpoints` table | `migrations/0202_pipeline_checkpoints.sql` |
| Mission quota | `mission_quota` table | `src/forest/quota/mission-quota.ts` |

### 2.5 Quota / Usage State
| Datum | Source of Truth | Location |
|---|---|---|
| Usage events (rolling windows) | `usage_events` table (hourly/daily/monthly) | `src/forest/quota/quota-checker-db.ts` |
| Video usage monthly | `video_usage_monthly` table | `migrations/0033-video-usage-monthly.sql` |
| Credit usage monthly | `credit_usage_monthly` table | `src/tree/usage-metering/usage-rollup-engine.ts` |
| MCU balance (top-up) | `user_credits` table | `src/land/billing/overage-topup.ts:231-238` |
| MCU balance (runtime) | `user_mcu_balance` table | `src/tree/mcu/credits-repo.ts:35` |
| MCU transactions | `mcu_transactions` table (append-only ledger) | `src/tree/mcu/credits-repo.ts:86` |
| Overage events | `overage_events` table | `src/forest/quota/quota-checker-overage.ts` |
| KV quota cache | `KV_KV` namespace | `src/seed/kv/quota-cache-ops.ts` |
| Redis quota cache | Upstash Redis | `src/tree/clients/upstash-redis-client.ts` |

**CRITICAL:** Two parallel quota systems exist:
- **System A:** `usage_events` (KV cache + rolling windows) — `quota-checker.ts`, `quota-checker-db.ts`, `quota-checker-kv-cache.ts`
- **System B:** `user_mcu_balance` (D1 ledger) — `credits-repo.ts`, `mcu_transactions`
- Reconciliation: `src/tree/usage-metering/usage-reconciliation.ts` — compares KV counter vs D1 for bypass detection

### 2.5 Provider State
| Datum | Source of Truth | Location |
|---|---|---|
| BYOK keys | `user_api_keys` table | `migrations/0011-user-api-keys.sql` |
| Circuit breaker state | `circuit_breaker_state` table | `migrations/0228_create_circuit_breaker_state.sql` |
| Provider pool config | `provider_pool` table | `src/forest/quota/provider-pool.ts` |
| LLM cache | `llm_cache` table | `migrations/0008-llm-cache.sql` |

---

## 3. DB Client Topology — Single Source of Truth

All four layers use the **same canonical DB client**:

| Layer | Import | File |
|---|---|---|
| seed | `createServerClient` from `@/seed/db/client` | `src/seed/db/client.ts:332-344` |
| tree | `createServerClient` from `@/seed/db/client` | (via re-export) |
| forest | `createServerClient` from `@/seed/db/client` | `src/land/billing/overage-topup.ts:14` |
| land | `getD1` from `@/seed/db/client` | `src/land/refunds/refund-processor.ts:20` |

**Finding:** No divergent DB client. `getD1()` is the async raw-D1 wrapper; `createServerClient()` is the sync query-builder wrapper. Both resolve the same `__env__.DB` binding (`src/seed/db/client.ts:206-220`). Supabase is type-only (`@/tree/database/supabase-types`) — no runtime `@supabase/supabase-js` client found in source.

---

## 4. Redis — Duplicate Client Implementations (Risk)

**Five separate Redis client implementations found:**

| File | Pattern | Notes |
|---|---|---|
| `src/land/redis.ts:1` | Direct `@upstash/redis` import | `getRedisClient()`, `SESSION_TTL = 86400` |
| `src/tree/clients/upstash-redis-client.ts:1` | Proxy singleton | `getKvClient()`, returns null if env missing |
| `src/seed/cache/redis.ts:1` | Direct import | Seed-layer cache |
| `src/seed/utils/redis-client.ts:9` | Direct import | Utility wrapper |
| `src/seed/redis.ts:7` | Dynamic `await import('@upstash/redis')` | Avoids SSR bundling |

**Risk:** Five implementations with potentially different connection configs, serialization, and error handling. If they share the same Upstash REST endpoint, they may race on shared keys (e.g., quota cache, session cache). No single canonical Redis client — this is technical debt.

**Mitigation status:** All gated on `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars. Non-production falls back to dummy client (`src/tree/clients/upstash-redis-client.ts`).

---

## 5. Migration Debt

### 5.1 Scale
- **233 migration files** in `migrations/`
- **242 unique tables** (estimated from CREATE TABLE statements)
- **Duplicate prefixes** (multiple files with same numeric prefix):

| Prefix | Files |
|---|---|
| `0004` | `0004_error_log.sql`, `0004_migrate_users_to_user.sql`, `0004-user-profiles.sql` |
| `0005` | `0005_migrate_users_to_user.sql`, `0005-signals-events.sql` |
| `0032` | `0032-seed-affiliate-catalog.sql`, `0032-voices.sql` |
| `0039` | `0039_slo_burn.sql`, `0039-videos-purchase-id.sql` |
| `0212` | `0212_create_creator_profiles.sql`, `0212_user_beta_invites.sql` |
| `0213` | `0213_create_sop_listings.sql`, `0213_user_streaks.sql` |

**Risk:** D1 applies migrations in filename order. Duplicate prefixes mean non-deterministic ordering if the migration tracking table (`d1_migrations`) is ever rebuilt. Currently safe because applied once, but a fresh D1 instance could apply them in different order.

### 5.2 Legacy State
- **`users` table (plural):** Dropped by `0004_migrate_users_to_user.sql` + `0005_migrate_users_to_user.sql`. Backfilled to `user` (singular, Better Auth). Legacy code referencing `users` would fail — no runtime references found in current source.
- **`payment_events` table:** Dropped by `0203_payment_events_dropped.sql` — but `payment_events` is still actively used in `src/land/billing/overage-topup.ts:121-126` and `src/land/refunds/refund-processor.ts:98-102`. **CONFLICT:** Migration says dropped, code says active. Either migration is wrong or code is orphaned.

---

## 6. Duplicated State

| Datum | Stored In | Risk |
|---|---|---|
| User tier | `subscriptions.plan`, `organizations.plan`, `user_profiles.tier` (if exists) | Three places — must be kept in sync. Refund processor updates both `subscriptions` and `organizations` (`refund-processor.ts:340-362`). |
| MCU balance | `user_credits.credits_remaining` (top-up) + `user_mcu_balance.credits_remaining` (monthly allocation) + KV quota cache + Redis quota cache | **CRITICAL:** Two separate D1 tables track MCU balance — `user_credits` (overage-topup.ts:231-238) and `user_mcu_balance` (credits-repo.ts:35). No documented reconciliation between them. KV/Redis are caches. |
| Video cost | `video_cost_log` (per-stage), `video_jobs.cost_usd` (running total) | Dual-write via `increment_job_cost` RPC with read-modify-write fallback (`cost-ledger.ts`). |
| Quota usage | D1 `mission_quota` / `video_usage_monthly`, KV `KV_KV`, Redis | Triple-store. KV/Redis are ephemeral caches with TTL. |

---

## 7. Race-Condition Risk

| Risk | Location | Mitigation |
|---|---|---|
| Double payment processing | `payment_events` INSERT ON CONFLICT DO NOTHING | Atomic lock — `overage-topup.ts:119-126` |
| Double refund | `refund_events` INSERT ON CONFLICT DO NOTHING | Atomic lock — `refund-processor.ts:96-102` |
| Concurrent top-up grants | `user_credits` upsert with `credits_remaining = credits_remaining + ?2` | Atomic increment — `overage-topup.ts:231-238` |
| Stale lock (crash mid-process) | `payment_events` / `refund_events` | 5-min stale lock recovery — `overage-topup.ts:143-155` |
| Concurrent video cost updates | `video_jobs.cost_usd` | RPC `increment_job_cost` with read-modify-write fallback |
| Tier update race | `subscriptions` + `organizations` | Refback processor updates both in sequence (not atomic) — `refund-processor.ts:340-362` |

---

## 8. Eventual-Consistency Risk

| Risk | Location | Impact |
|---|---|---|
| NOWPayments IPN delay | `processTopupIpn` | User pays but credits not granted until IPN arrives. 30-min invoice expiry. |
| KV quota cache staleness | `KV_KV` | Quota check may use stale cache after top-up. Invalidated on top-up but not on every job completion. |
| Redis session staleness | `src/land/redis.ts` | Session TTL 24h. No explicit invalidation on password change / logout. |
| Inngest job state | Inngest Cloud | Job status eventually consistent with D1 `video_jobs` status. |
| Tag cache D1 | `NEXT_TAG_CACHE_D1` | ISR revalidation is eventual — stale content served until tag invalidated. |

---

## 9. Inconsistent Identifiers

| Issue | Location |
|---|---|
| `user` (singular) vs `users` (plural) | Better Auth uses `user`. Legacy `users` dropped. Some migrations still reference `users`. |
| `org_id` vs `organization_id` | Mixed usage — `org_members.org_id`, `organizations.id`, `subscriptions.org_id`. |
| `user_id` vs `userId` | Snake_case in D1 columns, camelCase in TypeScript. Kysely handles mapping. |
| Event ID formats | `nowpayments_{id}_{status}`, `clickbank_{receipt}_{type}`, `topup_{id}_{status}`, `refund_{purchase_id}` — documented in `apps/sophia-ai-factory/CLAUDE.md:14-18`. |

---

## 10. Two D1 Databases — Separation of Concerns

| Database | Binding | Tables | Purpose |
|---|---|---|---|
| `sophia-raas-db` | `DB` | ~240 tables | All business state |
| `sophia-tag-cache` | `NEXT_TAG_CACHE_D1` | `cache_tags`, `cache_tag_mappings` | Next.js ISR tag cache only |

**Rationale:** `wrangler.toml:58-66` — dedicated D1 instance prevents tag-cache bloat from affecting main DB performance. Backed by migration `0108-opennext-tag-cache.sql`. Clean separation.

---

## Summary Block

```
RECON-05: State / Data Ownership — COMPLETE

Stores:        2 D1 (sophia-raas-db, sophia-tag-cache)
               3 R2 (opennext-cache, sophia-videos, sophia-backups)
               2 KV (EXPERIMENT_KV, KV_KV)
               1 Upstash Redis (5 client impls — debt)
               1 Inngest Cloud
               1 NOWPayments Cloud

Source of Truth:
  User:        Better Auth `user` table
  Tier:        `subscriptions.plan` + `organizations.plan`
  Credits:     `user_credits` table (top-up) + `user_mcu_balance` table (monthly allocation) — TWO PARALLEL LEDGERS
  Billing:     `payment_events` (atomic lock)
  Video cost:  `video_cost_log` + `video_jobs.cost_usd`
  Video binary: R2 VIDEO_BUCKET
  Job queue:   Inngest Cloud

Migration Debt:
  233 files, 6 duplicate-prefix groups
  CRITICAL: 0203_payment_events_dropped.sql conflicts with active code usage

Duplicated State:
  Tier stored in 3 places (subscriptions, organizations, user_profiles)
  MCU balance in 3 places (D1 user_credits + D1 user_mcu_balance + KV/Redis caches — dual D1 ledger is debt)
  Video cost in 2 places (cost_log + jobs.cost_usd running total)

Race Risk:     Atomic locks via INSERT ON CONFLICT DO NOTHING (D1 has no txns)
               5-min stale lock recovery implemented
               Tier rollback in refund is NOT atomic (two sequential UPDATEs)

Redis Debt:    5 separate client implementations — no canonical client

Supabase:      Type-only — no runtime client in source
```
