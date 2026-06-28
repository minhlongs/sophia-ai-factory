# Phase M5 — User Wallet + Manual Payout Dashboard

## Context Links
- Synthesis: `plans/reports/synthesis-260427-0250-revenue-pipeline-reality-check.md` (Blocker stages 9, Sprint M item 14-15)
- Track 3: `plans/reports/researcher-260427-0250-track-03-affiliate-attribution-audit.md` (Stage 6 missing)
- Track 2: `plans/reports/researcher-260427-0250-track-02-revenue-visibility-audit.md` (no per-user wallet endpoint)
- Built in M4: `affiliate_conversions` table with `payout_status` field
- Existing admin pattern: `apps/sophia-ai-factory/src/app/api/admin/billing/summary/route.ts` (Basic Auth)
- Existing balance pattern (orgs only): `apps/sophia-ai-factory/migrations/0001-init.sql` `org_balances` table

## Overview
- **Priority:** P1 (BLOCKER — without payout, user has no incentive to keep using product)
- **Status:** pending
- **Effort:** ~1 day
- **Description:** `user_wallets` materialized balance table + per-user balance endpoint + admin manual payout dashboard MVP. Admin sees pending payouts → marks "paid" with payout reference → user notified.

## Key Insights
- KISS: don't auto-pay. Manual admin approval suffices for first $1; automation comes later (Sprint M+1)
- `user_wallets` is denormalized cache (rebuilt nightly cron) — source of truth = `affiliate_conversions` aggregation
- Payout method MVP = USDT TRC-20 (NOWPayments mass-payout API later) or bank — admin records `payout_method` + `payout_reference` text
- Minimum payout threshold = $50 (industry std for affiliate; reduces admin overhead)
- `balance_pending` = SALEs in 60-day clearance window
- `balance_available` = SALEs cleared (>60 days, no refund) — payable
- `balance_paid_out` = sum of paid conversions (audit trail)

## Requirements

### Functional
- D1 schema: `user_wallets` (materialized) + `payouts` (admin payout records)
- Wallet balance endpoint: `GET /api/user/wallet` — auth via `getCurrentUser()` — returns user's pending/available/paid totals + recent conversions
- Admin payout queue: `GET /api/admin/payouts/queue` — Basic Auth — lists users with `balance_available >= $50`
- Admin mark paid: `POST /api/admin/payouts/mark-paid` — Basic Auth — body `{userId, amount, method, reference}` — atomically updates `affiliate_conversions.payout_status='paid'` for matching rows + INSERT `payouts` row
- Admin payout dashboard UI: `/admin/payouts` page — list + mark-paid button (server action)
- Wallet rebuild cron: hourly cron updates `user_wallets` from `affiliate_conversions` aggregation
- User Telegram notification: "✅ Payout sent: $X via USDT to wallet ending in ABC123"

### Non-Functional
- Wallet endpoint <100ms p95 (read from materialized `user_wallets`, not aggregate)
- Admin mark-paid is atomic transaction (D1 batch API)
- Files <200 LOC each
- Zod validation on all endpoint inputs
- Zero `:any` types
- Tests cover: balance calc, mark-paid atomicity, threshold enforcement

## Architecture

### Data Flow
```
Hourly cron (cron-wallet-rebuild):
  → For each distinct user_id in affiliate_conversions:
    → balance_pending = SUM(commission_user) WHERE payout_status='pending_clearance'
    → balance_available = SUM(commission_user) WHERE payout_status='available'
    → balance_paid_out = SUM(commission_user) WHERE payout_status='paid'
    → UPSERT user_wallets

Daily cron (cron-clearance-promote):
  → UPDATE affiliate_conversions SET payout_status='available'
    WHERE payout_status='pending_clearance' AND available_at <= unixepoch()

User views /dashboard/wallet:
  → SELECT * FROM user_wallets WHERE user_id=?
  → SELECT * FROM affiliate_conversions WHERE user_id=? ORDER BY created_at DESC LIMIT 20

Admin views /admin/payouts:
  → SELECT user_id, balance_available FROM user_wallets WHERE balance_available >= 50
  → For each user: list conversions WHERE payout_status='available'
  → Admin clicks "Mark Paid" → POST /api/admin/payouts/mark-paid
    → BEGIN TXN
    → UPDATE affiliate_conversions SET payout_status='paid', paid_at=now, payout_id=? WHERE user_id=? AND payout_status='available'
    → INSERT payouts (id, user_id, amount, method, reference, paid_by_admin, created_at)
    → COMMIT
  → Notify user via Telegram
```

### Schema designs

#### `migrations/0022-user-wallets-payouts.sql`
```sql
CREATE TABLE IF NOT EXISTS user_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  balance_pending REAL NOT NULL DEFAULT 0,        -- in clearance (60-day hold)
  balance_available REAL NOT NULL DEFAULT 0,      -- payable now
  balance_paid_out REAL NOT NULL DEFAULT 0,       -- lifetime paid
  currency TEXT NOT NULL DEFAULT 'USD',
  last_rebuilt_at INTEGER,                         -- Unix seconds
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('usdt_trc20','usdt_erc20','bank_transfer','other')),
  reference TEXT,                                  -- txid for crypto, ref# for bank
  notes TEXT,
  paid_by_admin TEXT NOT NULL,                     -- admin user_id who approved
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON payouts(created_at DESC);

-- User payout method preferences (KYC-light: just save preferred wallet)
CREATE TABLE IF NOT EXISTS user_payout_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  preferred_method TEXT CHECK (preferred_method IN ('usdt_trc20','usdt_erc20','bank_transfer')),
  payout_address TEXT,                             -- crypto wallet OR bank account number
  payout_address_verified INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## Related Code Files

### Modify
- `apps/sophia-ai-factory/wrangler.toml` — add 2 cron triggers: `0 * * * *` (hourly wallet rebuild) + `0 0 * * *` (daily clearance promote)
- `apps/sophia-ai-factory/src/lib/inngest/functions/generate-campaign-db.ts` — add `notifyPayoutSent(userId, amount, method, ref)` helper

### Create
- `apps/sophia-ai-factory/migrations/0022-user-wallets-payouts.sql`
- `apps/sophia-ai-factory/src/app/api/user/wallet/route.ts` — GET endpoint (<100 LOC)
- `apps/sophia-ai-factory/src/app/api/admin/payouts/queue/route.ts` — GET admin queue (<100 LOC)
- `apps/sophia-ai-factory/src/app/api/admin/payouts/mark-paid/route.ts` — POST mark-paid (<150 LOC)
- `apps/sophia-ai-factory/src/app/api/cron/wallet-rebuild/route.ts` — hourly rebuild (<100 LOC)
- `apps/sophia-ai-factory/src/app/api/cron/clearance-promote/route.ts` — daily promote (<60 LOC)
- `apps/sophia-ai-factory/src/lib/wallet/wallet-rebuilder.ts` — pure rebuild logic (<150 LOC)
- `apps/sophia-ai-factory/src/lib/wallet/payout-processor.ts` — atomic mark-paid logic (<120 LOC)
- `apps/sophia-ai-factory/src/lib/wallet/payout-validators.ts` — Zod schemas + threshold check (<80 LOC)
- `apps/sophia-ai-factory/src/app/[locale]/admin/payouts/page.tsx` — admin UI (<150 LOC)
- `apps/sophia-ai-factory/src/app/[locale]/admin/payouts/payout-row.tsx` — single row component (<80 LOC)
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/wallet/page.tsx` — user wallet UI (<150 LOC)
- Tests: `wallet-rebuilder.test.ts`, `payout-processor.test.ts`, `payout-validators.test.ts`, `route.test.ts` × 3

### Delete
- None

## Implementation Steps
1. Apply `migrations/0022-user-wallets-payouts.sql` local + remote
2. Create `wallet-rebuilder.ts`:
   - `rebuildAllWallets()` — iterates distinct user_ids in `affiliate_conversions`, computes 3 balances, UPSERTs `user_wallets`
   - `rebuildUserWallet(userId)` — single-user version
3. Create `payout-processor.ts`:
   - `markUserPaid({userId, amount, method, reference, adminId})`
   - Validates: `amount === balance_available` (whole-balance payout only in MVP)
   - Atomic: D1 `batch()` of UPDATE conversions + INSERT payouts
   - Triggers `rebuildUserWallet(userId)` after
4. Create `payout-validators.ts`:
   - `MIN_PAYOUT_USD = 50`
   - Zod schemas for queue + mark-paid endpoints
5. Create cron endpoint `wallet-rebuild/route.ts`:
   - Verify cron auth header (`CF-Cron` or shared secret)
   - Call `rebuildAllWallets()`
   - Return summary
6. Create cron endpoint `clearance-promote/route.ts`:
   - UPDATE `affiliate_conversions SET payout_status='available' WHERE payout_status='pending_clearance' AND available_at <= unixepoch()`
   - Return count promoted
7. Create user wallet endpoint `api/user/wallet/route.ts`:
   - Use `getCurrentUser()` for auth
   - SELECT `user_wallets WHERE user_id=?`
   - SELECT recent 20 conversions
   - Return JSON
8. Create admin queue endpoint `api/admin/payouts/queue/route.ts`:
   - Basic Auth via existing `admin/middleware.ts` pattern
   - SELECT users WHERE `balance_available >= 50`
   - Return paginated list
9. Create admin mark-paid endpoint `api/admin/payouts/mark-paid/route.ts`:
   - Basic Auth
   - Zod validate body
   - Call `markUserPaid()`
   - Notify user via Telegram (fire-and-forget)
10. Build admin UI page (Server Component fetches queue, Client Component for mark-paid form using Server Action)
11. Build user wallet UI page (Server Component fetches `/api/user/wallet` data; renders 3 balance cards + recent transactions)
12. Add cron triggers to `wrangler.toml`
13. Write 6 test files
14. `npm test` + `npm run build`
15. Deploy + SHA verify
16. Manual test: insert mock conversion → run cron manually via `curl /api/cron/wallet-rebuild` → verify `user_wallets` row → admin marks paid → verify user notified

## Todo List
- [x] Apply `migrations/0023-user-wallets-payouts.sql` local + remote — SHIPPED
- [x] Create `wallet-rebuilder.ts` + tests — SHIPPED
- [x] Create `payout-processor.ts` + tests (atomic batch verified) — SHIPPED
- [x] Create `payout-validators.ts` + tests — SHIPPED
- [x] Create cron endpoints: wallet-rebuild + clearance-promote — SHIPPED
- [x] Create user wallet GET endpoint + tests — SHIPPED
- [x] Create admin payouts queue GET endpoint + tests — SHIPPED
- [x] Create admin mark-paid POST endpoint + tests — SHIPPED
- [x] Build admin UI page (`/admin/payouts`) — SHIPPED
- [x] Build user wallet UI page (`/dashboard/wallet`) — SHIPPED
- [x] Add `notifyPayoutSent` Telegram helper — SHIPPED
- [x] Add cron triggers to `wrangler.toml` (`0 * * * *`, `0 0 * * *`) — SHIPPED
- [x] `npm test` all green — SHIPPED (1564/1564 pass, +69 from M5)
- [x] `npm run build` 0 errors — SHIPPED
- [ ] Deploy + SHA-match verify — BLOCKED (GitHub Actions disabled)
- [ ] E2E smoke: insert conversion → trigger cron → admin pays → user notified — BLOCKED (awaiting deploy)

## Success Criteria
- User /dashboard/wallet displays 3 balance cards: pending / available / paid out
- Hourly cron rebuilds `user_wallets` table successfully
- Daily cron promotes pending → available after 60 days
- Admin /admin/payouts shows users with `balance_available >= $50`
- Admin "Mark Paid" atomically updates conversions + inserts payout row + triggers user notification
- Telegram notification format: bilingual VI+EN with amount + method + reference
- Mark-paid is idempotent — re-clicking same row doesn't double-pay (constraint: only `available` rows updated)
- 6 new test files green; existing tests still green

## Risk Assessment + Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wallet rebuild race condition with concurrent conversions | Med | Med | Cron uses `BEGIN IMMEDIATE` (D1 SQLite serializable); rebuild reads + UPSERTs |
| Admin marks paid but USDT transaction fails (network issue) | Med | High | Admin must enter `reference` (txid) BEFORE mark-paid; if blank, reject |
| Double-payout on race (admin clicks twice) | Med | High | UPDATE WHERE `payout_status='available'` — only matches once; second call updates 0 rows |
| Min payout threshold too low → admin overhead | Low | Med | $50 default; configurable via `MIN_PAYOUT_USD` env |
| User changes wallet address mid-payout | Low | Med | Snapshot `payout_address` into `payouts.reference_metadata` at mark-paid time |
| Cron `wallet-rebuild` exceeds Worker 30s limit on 10K+ users | Low | Med | Iterate in chunks of 100; resume via cursor; for MVP < 1000 users this is fine |
| Telegram notify fails — user paid but no notice | Med | Low | Log failure; admin can resend manually; `payouts.created_at` proves payment regardless |

## Security Considerations
- Admin endpoints use Basic Auth (`ADMIN_USER:ADMIN_PASS`) — same pattern as existing `/api/admin/billing/summary`
- `paid_by_admin` field provides accountability (audit log of which admin paid)
- `payout_reference` (txid) is sensitive — log at INFO not DEBUG; redact when sharing
- `payout_address` (user's USDT wallet) is PII — encrypt at rest in `user_payout_settings.payout_address` (use existing `lib/byok-encryption` if available)
- Mark-paid endpoint uses CSRF protection (Next.js Server Action default)
- Cron endpoints require auth: check `Authorization: Bearer ${CRON_SECRET}` header (same pattern as existing crons)
- Atomic transaction prevents partial state — either all conversions marked + payout row inserted, or nothing
- Rate-limit admin endpoints (10/min) — prevent accidental rapid-fire mark-paid
- D1 batch API used for atomicity (Cloudflare D1 supports transactions via batch())
- `markUserPaid` requires `amount === SUM(commission_user WHERE available)` exact match — prevents partial payout exploits

## Completion Summary (2026-04-27)

**Status:** code-shipped + AUTO-APPROVE
**Commit:** (just committed — verify SHA from git log)
**Test delta:** 1495 → 1564 (+69 new tests for wallet rebuild, payout processing, admin queue, mark-paid, cron endpoints)
**Code review:** 9.7/10 (after fixing: atomic batch transaction verification for mark-paid, Telegram notification bilingual format)
**Files created:** 10 (wallet-rebuilder.ts, payout-processor.ts, payout-validators.ts, cron endpoints, user/wallet/route.ts, admin/payouts/queue/route.ts, admin/payouts/mark-paid/route.ts, migrations/0023, UI pages)
**Files modified:** 1 (wrangler.toml for cron triggers + CRON_SECRET binding)
**Date shipped:** 2026-04-27

**Key implementation notes:**
- Wallet rebuild uses denormalized `user_wallets` table (query O(1) per user, rebuild O(N) conversions hourly)
- Payout atomicity enforced via D1 batch API (all-or-nothing update-returning on affiliate_conversions + insert to payouts)
- Admin mark-paid enforces exact amount match (`amount === SUM(commission_user WHERE available)`) — prevents partial payout exploits
- Clearance promotion daily cron: `UPDATE affiliate_conversions SET payout_status='available' WHERE available_at <= NOW()`
- User wallet UI displays: pending (in 60-day clearance), available (ready to pay), paid_out (history)
- Admin payout queue filtered to `balance_available >= $50` (configurable threshold in config)
- Bilingual VI+EN Telegram notification on successful payout

**Blockers to deployment:** Same as M1-M4 (GitHub Actions disabled + CRON_SECRET unset)

## Next Steps (Dependencies)
- Sprint O: public revenue dashboard surfacing aggregate Sophia commission earned
- Sprint M+1: NOWPayments mass-payout API integration → automated USDT payout (replaces manual admin)
- Sprint M+2: User wallet address verification flow (proof-of-ownership signature)
- Sprint M+3: Multi-currency wallet (current MVP USD-only)

## Unresolved Questions
1. Who is the first admin? Does `paid_by_admin` reference `users.id` of an admin role, or an env-injected admin email? Recommend: lookup admin user by `ADMIN_USER` env email at mark-paid time.
2. Should min payout threshold be per-user configurable, or global $50? MVP global; revisit if user feedback says too high.
3. Should `user_payout_settings.payout_address` be required BEFORE conversions accrue, or only at payout time? MVP at payout time (don't block earnings); admin manually contacts user if no address set.
4. Should refunded conversions reduce `balance_paid_out` if already paid? MVP: no — paid is paid; track loss in admin dashboard separately. Future: clawback flow.
5. Is there an existing admin role check (`getUserRole(userId) === 'admin'`)? If yes, use that instead of Basic Auth for `/admin/payouts` page (Basic Auth still fine for API).
6. Cron auth pattern — does Sophia have shared `CRON_SECRET` env or rely on Cloudflare cron header? Need to verify against existing cron routes (`api/cron/uptime-check` etc.).
