# SOPHIA AI FACTORY — WORKFLOW GO LIVE
## Full Pipeline: Phase 7.5 → Phase 10 — theo Tiêu Chuẩn Solo CEO Media Company

**Ngày tạo:** 2026-06-03  
**Mục tiêu:** Ship to production — đủ tiêu chuẩn GO LIVE của Solo CEO công ty media  
**Scorecard hiện tại:** 88–95/100 (trung bình 91/100) — gần đạt, cần đóng kín gaps cuối  
**Tổng số phases:** 5 (7.5, 8, 9, 10, GO LIVE deploy)  
**Ưu tiên:** P0 trước → P1 sau → Deploy  

---

## 📊 TỔNG QUAN HIỆN TRẠNG

### Status Gates đã PASS (Phase 0–6)

| Gate | Tên | Status |
|------|-----|--------|
| 0 | idea-intake | active |
| 1 | company-blueprint | **pass** |
| 2 | offer-validated | **pass** |
| 3 | mvp-live | **pass** |
| 4 | first-revenue | **pass** |
| 5 | repeatable-channel | **pass** |
| 6 | fulfillment-stable | **pass** |
| 7 | scale-ready | **pass** |
| 8 | first-1m-mrr | **pass** |

### Scorecard GO LIVE (10/10 categories)

| Category | Score | Gần đạt? |
|----------|-------|----------|
| Architecture | 92/100 | ✅ |
| Reliability | 90/100 | ✅ |
| Scalability | 88/100 | ⚠️ |
| Security | 95/100 | ✅ |
| Observability | 89/100 | ⚠️ |
| Documentation | 94/100 | ✅ |
| Testing | 91/100 | ✅ |
| Deployment | 90/100 | ✅ |
| DevEx | 88/100 | ⚠️ |
| Maintainability | 92/100 | ✅ |

**TB = 90.9/100** — cần P0 fixes để đạt ≥ 95/100 trước khi GO LIVE

### Blockers đã FIXED

| # | Issue | Status |
|---|-------|--------|
| 1 | Credit Balance Mismatch on Registration | ✅ Fixed |
| 2 | Coupon Activation Credit Ledger Mismatch | ✅ Fixed |
| 3 | Unregistered Inngest Queues | ✅ Fixed |
| 4 | Missing Cron Trigger Mappings | ✅ Fixed |

### Remaining Issues cần fix trước GO LIVE

| Priority | Issue | Impact | Phase giải quyết |
|----------|-------|--------|-----------------|
| **P0** | Supabase relics trong codebase | Bundle size, confusion | Phase 7.5 Arch |
| **P0** | Duplicate crypto logic (tree layer) | Maintenance overhead | Phase 7.5 Arch |
| **P0** | Video jobs schema mismatch | Runtime crashes | Phase 7.5 Arch |
| **P0** | Billing IPN idempotency | Revenue loss risk | Phase 8 Billing |
| **P0** | Dunning state machine | Revenue loss risk | Phase 8 Billing |
| **P0** | Reconciliation batch job | Revenue loss risk | Phase 8 Billing |
| **P0** | E2E flow verification | GO LIVE gating | Phase 9 Audit |
| **P0** | i18n audit (zero raw keys) | UX quality | Phase 9 Audit |
| **P0** | Type audit (zero `:any`) | Code quality | Phase 9 Audit |
| **P1** | API pricing margins hardcoding | Ops flexibility | Phase 8 Billing |
| **P1** | Database archival strategy (180d → R2) | Performance | Phase 10 |
| **P2** | Automated secret rotation | Security | Post-launch |

---

## 🗺️ ROADMAP TỔNG

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 7.5  │  Architecture Cleanup    │  P0  │  2–3 ngày              │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 8    │  Billing Hardening        │  P0  │  3–4 ngày              │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 9    │  Production Zero-Gap Audit│  P0  │  2–3 ngày              │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 10   │  Monitoring + Pre-Launch  │  P1  │  2–3 ngày              │
├─────────────────────────────────────────────────────────────────────────┤
│  GO LIVE    │  Deploy + Verify          │  P0  │  1 ngày                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# PHASE 7.5: ARCHITECTURE CLEANUP
**Priority:** P0 — **Duration:** 2–3 ngày — **Mục tiêu:** Đạt 92→97 Architecture score

## Mục tiêu chi tiết

1. **Xóa Supabase relics** — không còn file/dependency nào liên quan Supabase
2. **Consolidate crypto logic** — gộp duplicate cryptographic signing vào 1 file
3. **Xóa legacy video jobs** — xóa `legacy-video-runner.ts`, confirm HeyGen là single entry point
4. **Barrel exports** — mỗi domain folder có `index.ts` export chuẩn
5. **Migrate lib/ vào 4-layer** — 50+ file trong `src/lib/` phải được phân bố đúng layer
6. **Zero banned imports** — không còn `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`

## Deliverables

| # | Deliverable | Path target | Criteria |
|---|-------------|-------------|----------|
| 1 | Delete Supabase files | `src/lib/supabase/`, `src/app/api/auth/callback/` | File gone, no imports remain |
| 2 | Consolidate crypto | `tree/crypto/signatures.ts` → single export | All consumers updated |
| 3 | Delete legacy video runner | `src/lib/video/legacy-video-runner.ts` | File gone, ADR 0007 referenced |
| 4 | Barrel exports | `seed/index.ts`, `tree/index.ts`, `forest/index.ts`, `land/index.ts` | All domain folders exported |
| 5 | lib/ migration | Move 50+ files to seed/tree/forest/land | Zero `@/lib/` imports remain |
| 6 | Build verification | `npm run build` | 0 TypeScript errors |

## Mapping lib/ → 4-layer

| src/lib/ module | Target layer | Reason |
|-----------------|-------------|--------|
| `supabase/` | **DELETE** | Fully migrated to Better Auth + D1 |
| `auth/` | **seed/auth** | Auth primitives |
| `subscription/` | **seed/config/tiers** | Tier config |
| `unified-tier-config/` | **seed/config/tiers** | Tier config |
| `tier-gate/` | **forest/quota** | Quota enforcement |
| `query-client.ts` | **seed/db** | DB client |
| `tier-guard.ts` | **forest/quota** | Quota enforcement |
| `schemas.ts` | **seed/validators** | Zod schemas |
| `features.ts` | **seed/config** | Feature flags |
| `hunter/` | **land/intelligence** | Business workflow |
| `publishing/` | **forest/publishing** | Orchestrator |
| `redis.ts` | **seed/cache** | Cache utility |
| `utils.ts` | **seed/utils** | General utility |
| `export-utils.ts` | **land/export** | Business workflow |
| `webhooks/signature.ts` | **tree/crypto** | Merge into signatures.ts |

## Success Criteria

- [ ] `grep -r "from '@/lib/" src/ | wc -l` = 0
- [ ] Supabase folder deleted
- [ ] `legacy-video-runner.ts` deleted
- [ ] `npm run build` → 0 errors
- [ ] `npm test` → all pass
- [ ] Each layer has barrel `index.ts`

## Checklist

- [ ] 7.5.1 Scan: `grep -r "from '@/lib/" src/` → document all findings
- [ ] 7.5.2 Delete: Remove `src/lib/supabase/` folder
- [ ] 7.5.3 Delete: Remove `src/app/api/auth/callback/route.ts`
- [ ] 7.5.4 Consolidate: Merge `tree/crypto/password-hash.ts` + `lib/webhooks/signature.ts` → `tree/crypto/signatures.ts`
- [ ] 7.5.5 Delete: Remove `lib/video/legacy-video-runner.ts`
- [ ] 7.5.6 Migrate: Move `lib/tier-guard.ts` → `forest/quota/tier-guard.ts`
- [ ] 7.5.7 Migrate: Move `lib/query-client.ts` → `seed/db/query-client.ts`
- [ ] 7.5.8 Migrate: Move `lib/features.ts` → `seed/config/features.ts`
- [ ] 7.5.9 Migrate: Move `lib/schemas.ts` → `seed/validators/schemas.ts`
- [ ] 7.5.10 Migrate: Move `lib/hunter/` → `land/intelligence/hunter/`
- [ ] 7.5.11 Migrate: Move `lib/publishing/` → `forest/publishing/`
- [ ] 7.5.12 Migrate: Move `lib/utils.ts` → `seed/utils/helpers.ts`
- [ ] 7.5.13 Migrate: Move `lib/export-utils.ts` → `land/export/export-utils.ts`
- [ ] 7.5.14 Barrel: Create/update `seed/index.ts`, `tree/index.ts`, `forest/index.ts`, `land/index.ts`
- [ ] 7.5.15 Update: Fix all broken imports after migration
- [ ] 7.5.16 Verify: `npm run build` → 0 errors
- [ ] 7.5.17 Verify: `npm test` → all pass


---

# PHASE 8: BILLING HARDENING
**Priority:** P0 — **Duration:** 3–4 ngày — **Mục tiêu:** Zero revenue loss, đạt 90→96 Reliability score

## Mục tiêu chi tiết

1. **NOWPayments IPN idempotency** — zero duplicate processing, < 5s latency
2. **Dead-letter queue** — failed IPN được retry, không mất transaction
3. **Dunning state machine** — active → overdue → suspended → restored lifecycle
4. **Overage billing** — track usage vượt tier limit, auto invoice
5. **Reconciliation** — nightly batch compare gateway vs DB, alert mismatch > 1%
6. **PayOS backup flow** — fallback khi NOWPayments fail
7. **Pricing tier dynamic config** — move hardcoded margins → DB table

## Architecture

```
IPN Flow:
  NOWPayments → /api/webhooks/nowpayments
    → Idempotency Lock (D1)
    → D1 Update (org_balances + mcu_transactions)
    → Inngest Event (payout.batch.process)

  PayOS Backup → /api/webhooks/payos
    → Idempotency Lock (D1)
    → D1 Update
    → Inngest Event

Dunning Flow:
  Inngest cron (mỗi 6h) → check overdue subscriptions
    → email notification (lần 1, 2, 3)
    → auto-suspend sau 9 ngày
    → restore on payment success

Overage Flow:
  Usage metering → quota enforcer
    → detect overage
    → generate invoice
    → notify user
```

## Deliverables

| # | Deliverable | Path | Criteria |
|---|-------------|-------|----------|
| 1 | IPN idempotency lock | `land/billing/nowpayments-ipn-lock.ts` | Zero duplicates |
| 2 | Dead-letter queue | `land/billing/ipn-deadletter.ts` | Failed IPN retried |
| 3 | Dunning state machine | `land/billing/dunning/dunning-engine.ts` | 3-attempt lifecycle |
| 4 | Wire dunning → Inngest | `forest/inngest/functions/dunning.ts` | Cron trigger active |
| 5 | Overage billing tracker | `land/billing/overage-tracker.ts` | Auto invoice generation |
| 6 | Reconciliation batch | `land/billing/reconciliation.ts` | Nightly, <1% mismatch |
| 7 | Billing alerts | `land/billing/alerts.ts` | Slack/Telegram/email |
| 8 | Pricing tier DB table | `seed/db/migrations/0162_pricing_tiers.sql` | Dynamic config |
| 9 | PayOS backup flow | `app/api/webhooks/payos/route.ts` | Fallback active |

## E2E Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Payment → IPN received → tier activated | Balance correct, tier upgraded |
| 2 | Same IPN replayed (duplicate) | Ignored, no double charge |
| 3 | Payment fails 3x over 9 days | Auto suspend, email sent |
| 4 | Payment succeeds after suspend | Restore, tier reactivated |
| 5 | Usage exceeds tier limit | Overage invoice generated |
| 6 | NOWPayments down → PayOS backup | Payment still processed |
| 7 | Nightly reconciliation | Mismatch < 1%, alert if > 1% |

## Success Criteria

- [ ] IPN: zero duplicate processing (verified by test replay)
- [ ] IPN: < 5s end-to-end latency
- [ ] Dunning: auto-suspend after 3 failures within 9 days
- [ ] Dunning: restore on successful payment
- [ ] Reconciliation: nightly batch, alert if mismatch > 1%
- [ ] Overage: auto invoice when usage exceeds tier
- [ ] PayOS: fallback active when NOWPayments unreachable
- [ ] Pricing: all margins from DB, not hardcoded
- [ ] `npm test` → all billing tests pass

## Checklist

- [ ] 8.1 Audit: Review current `nowpayments-ipn-*.ts` files
- [ ] 8.2 Build: Idempotency lock using `payment_id` unique key in D1
- [ ] 8.3 Build: Dead-letter queue with Inngest retry
- [ ] 8.4 Build: Dunning state machine (4 states: active/overdue/suspended/restored)
- [ ] 8.5 Wire: Dunning cron → Inngest every 6h
- [ ] 8.6 Build: Overage billing tracker (quota → detect → invoice → notify)
- [ ] 8.7 Build: Reconciliation batch job (nightly at 02:00 UTC)
- [ ] 8.8 Build: Billing alerts (Slack webhook + Telegram + email)
- [ ] 8.9 Migration: Create `pricing_tiers` table
- [ ] 8.10 Refactor: Replace hardcoded margins in `cost-guardrail.ts` with DB lookups
- [ ] 8.11 Verify: PayOS webhook route with idempotency
- [ ] 8.12 Test: E2E full payment → tier → dunning → restore cycle
- [ ] 8.13 Verify: `npm run build` → 0 errors
- [ ] 8.14 Verify: `npm test` → all pass


---

# PHASE 9: PRODUCTION ZERO-GAP AUDIT
**Priority:** P0 — **Duration:** 2–3 ngày — **Mục tiêu:** 100% E2E coverage, zero gaps before deploy

## Mục tiêu chi tiết

1. **E2E flow audit** — test mỗi protected flow từ đầu đến cuối
2. **i18n audit** — grep tất cả `t()` calls, verify tồn tại trong cả vi + en
3. **Type audit** — grep `:any`, fix tất cả
4. **Console audit** — grep `console.`, remove production logs
5. **Test suite gate** — 844+ tests pass
6. **Protected flow regression** — mỗi tier checkout works

## E2E Flow Matrix

| # | Flow | Entry | Exit | Expected |
|---|------|-------|------|----------|
| 1 | Setup Wizard | `/setup-wizard` | Dashboard | API key → validate → save → first run |
| 2 | Telegram Bot | `/campaign` command | Reply | Sophia_Bbot responds |
| 3 | Payment Flow (NOWPayments) | `/pricing` → select | Dashboard | IPN → tier activation → redirect |
| 4 | Payment Flow (PayOS) | `/pricing` → select | Dashboard | PayOS callback → tier → redirect |
| 5 | Checkout BASIC | `/pricing/basic` | Payment page | Redirect to gateway |
| 6 | Checkout PREMIUM | `/pricing/premium` | Payment page | Redirect to gateway |
| 7 | Checkout ENTERPRISE | `/pricing/enterprise` | Payment page | Redirect to gateway |
| 8 | Checkout MASTER | `/pricing/master` | Payment page | Redirect to gateway |
| 9 | SOP Marketplace | `/sop-marketplace` | SOP detail | Browse, filter, select SOP |
| 10 | SOP Execution | `/sop-executor` | Results | Run SOP → track outcomes |
| 11 | Video Generation | `/factory` | Video list | HeyGen → render → deliver |
| 12 | Affiliate Dashboard | `/affiliates` | Revenue | Earnings, leaderboard, payouts |
| 13 | i18n switch | Toggle vi↔en | All pages | All text translates correctly |
| 14 | Auth flow | `/login` | Dashboard | Login → MFA (if enabled) → dashboard |

## Audit Checklist

### 7. E2E Flow Audit
- [ ] 9.1 Setup Wizard: API key input → validate → save → first run
- [ ] 9.2 Telegram Bot: `/campaign`, `/status`, `/results` all respond
- [ ] 9.3 Payment (NOWPayments): IPN received → tier activated → confirmation
- [ ] 9.4 Payment (PayOS): callback → tier activated → confirmation
- [ ] 9.5 Checkout BASIC: tier page → payment → redirect → access granted
- [ ] 9.6 Checkout PREMIUM: same flow
- [ ] 9.7 Checkout ENTERPRISE: same flow
- [ ] 9.8 Checkout MASTER: same flow

### 8. i18n Audit
- [ ] 9.9 `grep -r "t(" src/app/` → document all `t()` call sites
- [ ] 9.10 Verify every key exists in `messages/vi.json`
- [ ] 9.11 Verify every key exists in `messages/en.json`
- [ ] 9.12 Fix any missing/broken keys
- [ ] 9.13 Verify zero raw strings (no hardcoded text in components)

### 9. Type Audit
- [ ] 9.14 `grep -r ":any" src/` → document all `:any` types
- [ ] 9.15 Fix all `:any` to proper types
- [ ] 9.16 `npm run typecheck` → 0 errors

### 10. Console Audit
- [ ] 9.17 `grep -r "console\." src/` → document all console calls
- [ ] 9.18 Replace `console.log` with `logger.info` (seed/utils/logger-utility.ts)
- [ ] 9.19 Remove or gated all `console.error` in production paths
- [ ] 9.20 Verify zero `console.*` in production build output

### 11. Test Suite
- [ ] 9.21 `npm run ci:test` → 844+ tests pass
- [ ] 9.22 `npm run ci:typecheck` → 0 errors
- [ ] 9.23 `npm run ci:lint` → 0 warnings
- [ ] 9.24 `npm run build` → 0 errors

### 12. Protected Flow Regression
- [ ] 9.25 Unauthenticated access → redirect to login (all protected routes)
- [ ] 9.26 Expired session → redirect to login
- [ ] 9.27 Wrong tier → access denied (tier-gate enforcement)
- [ ] 9.28 MFA required → redirect to challenge page

## Success Criteria

- [ ] All 14 E2E flows verified passing
- [ ] i18n: zero raw keys, all keys in vi + en
- [ ] Zero `:any` types in production code
- [ ] Zero `console.` calls in production code
- [ ] 844+ tests pass
- [ ] `npm run build` → 0 errors
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run lint` → 0 errors

## Checklist

- [ ] 9.1 Run E2E: Setup Wizard
- [ ] 9.2 Run E2E: Telegram Bot commands
- [ ] 9.3 Run E2E: NOWPayments payment flow
- [ ] 9.4 Run E2E: PayOS payment flow
- [ ] 9.5 Run E2E: Checkout all 4 tiers
- [ ] 9.6 Run i18n audit: grep all t() calls
- [ ] 9.7 Fix missing i18n keys
- [ ] 9.8 Run type audit: grep :any
- [ ] 9.9 Fix all :any types
- [ ] 9.10 Run console audit: grep console.
- [ ] 9.11 Replace console with logger
- [ ] 9.12 Run full test suite
- [ ] 9.13 Run build + typecheck + lint
- [ ] 9.14 Protected flow regression tests


---

# PHASE 10: MONITORING + PRE-LAUNCH
**Priority:** P1 — **Duration:** 2–3 ngày — **Mục tiêu:** 89→96 Observability score, ready for traffic

## Mục tiêu chi tiết

1. **Quota enforcement finalization** — real-time usage metering working
2. **Real-time alerts** — Inngest queue depth, payment failures, error spikes
3. **Usage metering** — per-user, per-org tracking finalized
4. **Sentry + PostHog** — verified working in production
5. **Cloudflare logs** — log-push to Axiom/Datadog configured
6. **Health endpoints** — `/api/cron/heartbeat` verified
7. **Performance baseline** — < 3s API, < 5s payment redirect
8. **D1 backup schedule** — daily at 05:00 UTC verified

## Deliverables

| # | Deliverable | Path | Criteria |
|---|-------------|-------|----------|
| 1 | Quota enforcer | `forest/quota/quota-enforcer.ts` | Realtime enforcement |
| 2 | Usage metering | `forest/usage-metering/usage-meter.ts` | Per-user tracking |
| 3 | Alert system | `land/monitoring/alerts.ts` | Slack + Telegram webhooks |
| 4 | Heartbeat verification | `/api/cron/heartbeat` | Returns 200, logs health |
| 5 | Sentry config | `seed/observability/sentry.ts` | Error tracking active |
| 6 | PostHog config | `seed/observability/posthog.ts` | Analytics active |
| 7 | Log pipeline | Cloudflare log-push | Axiom/Datadog receiving |
| 8 | D1 backup cron | `/api/cron/d1-backup` | Daily, 90-day retention |
| 9 | Error digest | `/api/cron/error-digest` | Daily at 05:00 UTC |

## Alert Rules

| Alert | Condition | Channel |
|-------|-----------|---------|
| Payment failure | IPN error rate > 5% in 5min | Slack + Telegram |
| Inngest queue depth | > 100 pending events | Slack |
| API error rate | > 1% 5xx in 5min | Slack |
| D1 backup failure | Backup job fails | Email |
| Disk usage | D1 > 8GB (80% of 10GB) | Slack |
| LLM provider down | All providers failing | Slack |
| Auth failures | > 10 failed logins/min | Slack |

## Success Criteria

- [ ] Quota enforcement: users blocked at tier limit
- [ ] Alerts: all 6 alert rules firing in test
- [ ] Heartbeat: returns 200, D1 + Inngest handshake OK
- [ ] Sentry: test error captured in dashboard
- [ ] PostHog: test event visible in dashboard
- [ ] D1 backup: daily job runs, R2 bucket has files
- [ ] Error digest: daily email received
- [ ] Performance: API < 3s, payment redirect < 5s

## Checklist

- [ ] 10.1 Verify quota enforcer blocks at tier limit
- [ ] 10.2 Verify usage metering tracks per-user
- [ ] 10.3 Configure Sentry DSN in wrangler secrets
- [ ] 10.4 Configure PostHog API key
- [ ] 10.5 Configure Cloudflare log-push to Axiom/Datadog
- [ ] 10.6 Configure Slack webhook URL for alerts
- [ ] 10.7 Configure Telegram bot for alerts
- [ ] 10.8 Verify D1 backup cron runs daily
- [ ] 10.9 Verify R2 backup bucket has files
- [ ] 10.10 Run performance baseline test
- [ ] 10.11 Configure error digest cron
- [ ] 10.12 Test all alert rules fire correctly


---

# GO LIVE DEPLOYMENT
**Priority:** P0 — **Duration:** 1 ngày — **Mục tiêu:** Production live, verified, monitored

## Pre-Deploy Checklist (GATE phải PASS hết)

### Gate 1: Code Quality
- [ ] `npm run build` → 0 TypeScript errors
- [ ] `npm run ci:typecheck` → 0 errors
- [ ] `npm run ci:lint` → 0 warnings
- [ ] `npm run ci:test` → 844+ tests pass
- [ ] Zero `:any` types in production code
- [ ] Zero `console.` calls in production code
- [ ] Zero `from '@/lib/` imports remaining

### Gate 2: Architecture
- [ ] Supabase relics fully deleted
- [ ] Crypto logic consolidated (1 file)
- [ ] Legacy video runner deleted
- [ ] All domain folders have barrel exports
- [ ] 4-layer import rules verified (no circular deps)
- [ ] `STRUCTURAL_MAP.md` matches current codebase

### Gate 3: Billing
- [ ] IPN idempotency verified (test replay)
- [ ] IPN latency < 5s
- [ ] Dunning state machine tested (3-attempt lifecycle)
- [ ] PayOS fallback tested
- [ ] Reconciliation batch runs nightly
- [ ] Pricing tiers from DB (not hardcoded)

### Gate 4: E2E Flows
- [ ] Setup Wizard: E2E passing
- [ ] Telegram Bot: all commands responding
- [ ] Payment (NOWPayments): E2E passing
- [ ] Payment (PayOS): E2E passing
- [ ] Checkout (4 tiers): all passing
- [ ] Auth flow: login → MFA → dashboard
- [ ] SOP Marketplace: browse → select → execute
- [ ] Video generation: HeyGen → render → deliver

### Gate 5: i18n
- [ ] All `t()` keys present in vi.json
- [ ] All `t()` keys present in en.json
- [ ] Zero raw strings in components
- [ ] Language toggle works (vi ↔ en)
- [ ] All pages render correctly in both languages

### Gate 6: Security
- [ ] SQL injection: all queries parameterized
- [ ] XSS: user content sanitized
- [ ] MFA: enforcement working
- [ ] Secrets: in wrangler secrets (not .env)
- [ ] CSP headers configured
- [ ] Secretlint: zero plaintext secrets
- [ ] Input validation: Zod schemas on all endpoints

### Gate 7: Observability
- [ ] Sentry: error tracking active
- [ ] PostHog: analytics active
- [ ] Cloudflare logs: log-push to Axiom/Datadog
- [ ] Heartbeat: `/api/cron/heartbeat` returns 200
- [ ] D1 backup: daily at 05:00 UTC
- [ ] Error digest: daily at 05:00 UTC
- [ ] All 6 alert rules configured and tested

### Gate 8: Performance
- [ ] API response < 3s (p95)
- [ ] Payment redirect < 5s
- [ ] Video generation starts < 15s (p95)
- [ ] D1 query < 100ms (p95)
- [ ] Edge warm-start < 1ms

### Gate 9: Data & Backup
- [ ] D1 schema: latest migration applied
- [ ] D1 backup: 90-day retention on R2
- [ ] R2 buckets: sophia-video-assets, sophia-backups configured
- [ ] No D1 size > 8GB (under 80% of 10GB limit)

### Gate 10: Deployment
- [ ] `wrangler.toml` configured for production
- [ ] Cron triggers: all 8 mappings verified
- [ ] Inngest: all queues registered
- [ ] Environment variables: all set in wrangler secrets
- [ ] Domain: `sophia.agencyos.network` DNS configured

## Deployment Steps

### Step 1: Pre-flight
```bash
cd apps/sophia-ai-factory
npm run ci:typecheck    # 0 errors
npm run ci:lint         # 0 warnings
npm run ci:test         # 844+ pass
npm run build           # 0 errors
```

### Step 2: Migrations
```bash
# Dry-run locally first
npx wrangler d1 migrations apply DB --local

# Apply to production
npm run deploy:migrations

# Verify
npm run deploy:verify
```

### Step 3: Deploy
```bash
npm run deploy:full
```

### Step 4: Post-Deploy Verification
```bash
# Check application status
curl https://sophia.agencyos.network/api/health

# Verify cron jobs
curl https://sophia.agencyos.network/api/cron/heartbeat

# Check D1 backup
npx wrangler d1 export DB --remote --output=./verify-backup.sql
```

### Step 5: Browser Verification
- [ ] Open `https://sophia.agencyos.network`
- [ ] Login flow works
- [ ] Dashboard loads
- [ ] Pricing page shows 4 tiers
- [ ] Payment redirect works
- [ ] i18n toggle works
- [ ] SOP Marketplace loads
- [ ] No console errors in browser DevTools

### Step 6: Smoke Tests
- [ ] Create test user → verify onboarding
- [ ] Test payment (small amount) → verify IPN
- [ ] Test tier upgrade → verify access
- [ ] Test video generation → verify HeyGen integration
- [ ] Test Telegram bot → verify responses

## Rollback Protocol

If deployment triggers errors:

1. **Identify**: Check Cloudflare Worker error logs
2. **Isolate**: Toggle mock mode if external API causing errors
3. **Revert**: 
```bash
git revert HEAD
npm run deploy:full
```
4. **If D1 migration issue**:
```bash
npx wrangler d1 execute DB --remote --file=migrations/rollback-last.sql
```
5. **Verify**: Re-run smoke tests

## GO LIVE Decision Matrix

| Condition | Pass | Fail |
|-----------|------|------|
| All 10 gates pass | ✅ GO LIVE | ❌ Fix blockers |
| Any P0 issue open | ❌ Delay | Fix first |
| Test coverage < 844 | ❌ Add tests | — |
| Build errors > 0 | ❌ Fix errors | — |
| Any E2E flow broken | ❌ Fix flow | — |
| Payment not verified | ❌ Fix billing | — |

---

# TỔNG KẾT WORKFLOW

## Timeline Summary

| Phase | Name | Priority | Duration | Cumulative |
|-------|------|----------|----------|------------|
| 7.5 | Architecture Cleanup | P0 | 2–3 ngày | Ngày 1–3 |
| 8 | Billing Hardening | P0 | 3–4 ngày | Ngày 4–7 |
| 9 | Production Zero-Gap Audit | P0 | 2–3 ngày | Ngày 8–10 |
| 10 | Monitoring + Pre-Launch | P1 | 2–3 ngày | Ngày 11–13 |
| — | GO LIVE Deploy | P0 | 1 ngày | Ngày 14 |

**Total: ~14 ngày từ Phase 7.5 đến GO LIVE**

## Tiêu chuẩn GO LIVE theo Solo CEO

### Business Criteria
- [ ] Codebase sạch, maintainable (TechDebt < 5 items)
- [ ] Zero known bugs in production paths
- [ ] Billing: 100% revenue captured, zero leakage
- [ ] E2E: tất cả flows hoạt động end-to-end
- [ ] Performance: < 3s API, < 5s payment
- [ ] Uptime target: 99.9%

### Technical Criteria
- [ ] 4-layer architecture: 100% compliance
- [ ] Test coverage: 844+ tests passing
- [ ] Type safety: zero `:any`
- [ ] Security: zero plaintext secrets, all queries parameterized
- [ ] Observability: Sentry + PostHog + logs active
- [ ] Backup: daily D1 backup to R2

### Solo CEO Non-Negotiables
- [ ] **No-code doctrine**: customers không cần operator setup
- [ ] **Tier enum**: BASIC | PREMIUM | ENTERPRISE | MASTER — strictly enforced
- [ ] **Canonical imports**: chỉ dùng `@/seed/*`, `@/tree/*`, `@/forest/*`, `@/land/*`
- [ ] **CF-direct deploy**: `npm run deploy:full` only
- [ ] **BYOK model**: customers tự nhập API keys
- [ ] **Vietnamese + English**: đầy đủ i18n

## Risk Register & Mitigation

| Risk | Phase | Impact | Mitigation |
|------|-------|--------|------------|
| 4-layer migration breaks imports | 7.5 | HIGH | Change 1 domain at a time, test after each |
| Circular deps after reorg | 7.5 | MEDIUM | Follow 4-layer rules strictly, use lazy imports |
| IPN replay attacks | 8 | HIGH | Idempotency lock + timestamp validation |
| Double charges | 8 | HIGH | Idempotency key per payment ID |
| Dunning false-positive | 8 | MEDIUM | Grace period + manual override |
| Payment gateway downtime | 8 | MEDIUM | PayOS backup flow |
| E2E test flakiness | 9 | LOW | Retry logic, seed test data |
| Production performance drop | 10 | MEDIUM | Baseline before deploy, monitor after |

## Post-GO LIVE (Week 2+)

| Item | Priority | Timeline |
|------|----------|----------|
| Database archival (180d → R2) | P1 | Week 2 |
| Automated secret rotation | P2 | Week 3–4 |
| Phase 7 features implementation (Analytics, AI SOP, Revenue, Multi-lang) | P1 | Week 2–4 |
| Load testing at scale | P1 | Week 2 |
| SOC 2 compliance prep | P2 | Month 2 |
| Mobile app (PWA) | P2 | Month 2–3 |

---

## 📋 QUICK REFERENCE: COMMANDS

```bash
# Build & Test
npm run build              # Build for production
npm run ci:typecheck       # TypeScript check
npm run ci:lint            # ESLint
npm run ci:test            # Run all tests
npm run dev:mock           # Local dev with mocks

# Database
npx wrangler d1 migrations apply DB --local    # Local migrations
npm run deploy:migrations                      # Prod migrations
npm run deploy:verify                          # Verify deploy
npx wrangler d1 export DB --remote             # Backup

# Deploy
npm run deploy             # Deploy to staging/prod
npm run deploy:full        # Full CF-direct deploy

# Monitoring
curl https://sophia.agencyos.network/api/cron/heartbeat  # Health check
```

---

*Generated: 2026-06-03 | Sophia AI Factory — Solo CEO Media Company Standards*
