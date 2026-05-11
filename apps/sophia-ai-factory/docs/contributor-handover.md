# Contributor Handover — Sophia AI Factory

> Companion to the non-tech `HANDOFF.md`. This doc is for developers picking up the codebase.
> Goal: new contributor opens first PR within 5 days using only this + linked runbooks.

---

## 1. Stack at a glance

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Server Components default |
| Language | TypeScript strict | Zero `:any` in production code |
| Runtime | Cloudflare Workers via OpenNext | `npm run deploy:full` |
| Database | Cloudflare D1 (`sophia-raas-db`) | Binding `DB`. Sync `createServerClient()` |
| Cache | R2 + KV | `NEXT_INC_CACHE_R2_BUCKET`, `EXPERIMENT_KV` |
| Auth | Better Auth | `getCurrentUser()` from `@/seed/auth/better-auth-session` |
| Tier config | `@/config/tiers` | Single source. Tiers: `BASIC / PREMIUM / ENTERPRISE / MASTER` |
| Crypto payments | NOWPayments USDT (TRC20/ERC20) | IPN webhook → tier activation |
| Vietnam fallback | PayOS | Bank transfer rail |
| Fiat affiliate payouts | Stripe Connect Express | Phase 03 — see `payout-operations-runbook.md` |
| BANNED | Polar.sh, PayPal | Polar rejected this product; PayPal removed |
| Jobs | Inngest | `forest/inngest/` |
| Email | Outbox + drip cron | `forest/outbox/`, `forest/email/` |
| Tests | Vitest | 1800+ tests; `npm test` |
| Production URL | https://sophia.agencyos.network | `/api/version` exposes SHA |

---

## 2. Code organization — 4-layer architecture

See `.claude/rules/sophia-layer-architecture.md` (authoritative). Quick map:

```
seed/   foundational primitives (types, config, db client, auth base, logger)
tree/   domain-specific reusable (BYOK, handover, audit, telegram)
forest/ infra orchestrators (Inngest jobs, RAAS gateway, usage metering, quota)
land/   business workflows (billing, payouts, affiliates, promo, refunds)
```

**Import direction rule:** seed → tree → forest → land. Reverse imports forbidden. Only legal cross-layer: forest may call land for orchestration (see `cross-layer-orchestration.md`).

**Canonical imports** (post-consolidation 2026-04-14):
```ts
import { getCurrentUser } from '@/seed/auth/better-auth-session'      // OR '@/lib/better-auth-session' (both work)
import { getUserTier } from '@/lib/db/get-user-tier'
import { createServerClient } from '@/lib/db/client'                  // SYNC — no await
import { TIER_CONFIGS, TIER_CONFIG } from '@/config/tiers'
```

**Banned imports:** `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.

---

## 3. Deploy doctrine (CF-direct, since 2026-05-03)

GitHub Actions is **disabled by design**. The `longtho638-jpg` free-tier minutes were exhausted on 2026-05-03; the team adopted wrangler CLI as the canonical deploy path rather than restore CI.

```bash
cd apps/sophia-ai-factory
npm run deploy:full           # build + inject SHA + wrangler deploy
bash scripts/apply-migrations.sh   # only if migrations/ changed
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Must match: git rev-parse HEAD | cut -c1-8
```

**SHA match is MANDATORY.** HTTP 200 alone is not sufficient — may be a stale deploy from a prior invocation. See `.claude/rules/sophia-deploy-verify.md` for the full verify sequence (authoritative).

Workflow archived as `.github/workflows/test.yml.disabled`. Re-enable by renaming to `.yml` if Actions ever returns.

---

## 4. Architecture decisions worth knowing

| Decision | When | Why |
|---|---|---|
| **CF-direct deploy** | 2026-05-03 | GitHub Actions free-tier exhausted; wrangler CLI is faster, simpler, no CI dependency |
| **4-layer rewrite** | 2026-04-25..05-04 | Replaces flat `src/lib/*` sprawl. Direction rule enforceable via grep |
| **Polar.sh rejected** | 2026-04 | Product fit poor for Sophia; NOWPayments + PayOS cover crypto + VN. PayPal removed entirely |
| **Stripe Connect added** | 2026-05-10 | Phase 03 — unblock fiat USD affiliate payouts (US 1099 threshold drives KYC) |
| **Better Auth (not NextAuth)** | 2026-04-14 | Single source `@/lib/better-auth-session`. Older `lib/auth.ts` deleted |
| **D1 schema lives in `migrations/`** | 2026-05-10 | `src/seed/db/migrations/` is NOT walked by `apply-migrations.sh`. See `migrations/0106-revenue-split-tables.sql` header for cautionary tale |
| **Tier config consolidation** | 2026-04-14 | One source: `@/config/tiers`. `lib/tier-gate.ts`, `lib/unified-tier-config.ts` deleted |

---

## 5. Secret rotation

| Secret | Where used | Cadence | Failure mode if missing |
|---|---|---|---|
| `CRON_SECRET` | `verifyCronAuth()` all `/api/cron/*` | Quarterly | All cron requests 401 |
| `STRIPE_SECRET_KEY` | `getStripeClient()` Connect API | Annual (Stripe rolls) | Connect rail completely dead |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | webhook signature | Each Stripe rotation | All webhooks rejected |
| `NOWPAYMENTS_API_KEY` | mass payout calls | Annual | Falls back to mock mode (INVALID in prod) |
| `PAYOUT_ENC_KEY` | crypto address decryption | DO NOT rotate without re-encrypting existing rows | Cannot send USDT |
| `BETTER_AUTH_SECRET` | session signing | Annual + on suspected leak | All sessions invalidated |
| `RESEND_API_KEY` | outbox email delivery | Annual | Lifecycle emails silently fail |
| `OPENROUTER_API_KEY` (server) | server-side LLM | Per-service rotation | Internal LLM features down |

```bash
# Audit
npx wrangler secret list --name sophia-ai-factory

# Rotate one
npx wrangler secret put STRIPE_SECRET_KEY --name sophia-ai-factory
```

See `docs/secret-rotation-runbook.md` for the full quarterly procedure.

---

## 6. Common pitfalls

### Schema drift between two folders
`src/seed/db/migrations/` is **NOT** walked by `apply-migrations.sh` — only canonical `migrations/` is. If you add a SQL file in the wrong folder, prod D1 will be missing tables and code will silent-fail. (Real incident: tables `commission_ledger`, `payout_batches`, `payout_methods` were missing on remote for ~10 days. See `docs/postmortems/2026-05-10-revenue-split-tables-missing.md`.)

**Guard:** automated. `scripts/check-migration-coverage.sh` runs every `npm test` via `src/__tests__/migration-coverage-guard.test.ts`. It scans every `src/**/*.sql`, filters Postgres/Supabase files via syntax heuristic, and fails if any D1 `CREATE TABLE` lacks a canonical match in `migrations/`. Manual invocation: `bash scripts/check-migration-coverage.sh`.

### `createServerClient()` is synchronous
Do **NOT** `await` it. `await createServerClient()` returns `undefined`. Reason: it just constructs an object holding the binding.

### Cron route auth
All `/api/cron/*` endpoints require `Authorization: Bearer ${CRON_SECRET}` OR `?token=${CRON_SECRET}` OR `x-cron-secret: ${CRON_SECRET}` header. The legacy `x-cf-cron: true` bypass was removed 2026-05-02.

### Stripe webhook body
Must read **raw body via `await req.text()`** BEFORE any JSON parse — otherwise signature verification fails. See `app/api/webhooks/stripe-connect/route.ts`.

### Deploy SHA reporting tied to git HEAD
`npm run deploy:full` injects the SHA at build time from the current `git rev-parse HEAD`. If you deploy uncommitted changes, the `/api/version` will report the previous commit's SHA but the worker bundle contains your new code. Always commit first, then deploy.

### Tenant settings has two schemas
`tenant_settings` exists with two historical shapes:
- **0038 (dead — not deployed):** column `vn_pit_enabled INTEGER` per tenant
- **0085 (canonical):** `(tenant_id, namespace, value JSON)` per row

Always use the namespaced JSON form. See `src/forest/inngest/functions/conversion-to-ledger.ts` for the read pattern.

### `total_cents` vs `total_usd`
Money in DB is **always INTEGER cents** (`commission_ledger.commission_cents`, `payout_batches.total_cents`). Convert at API boundary via `fromCents()` from `@/land/payouts/commission-cents`. Direct float math = drift.

---

## 7. Day-1 setup for a new contributor

```bash
# 1. Clone + install
git clone https://github.com/longtho638-jpg/sophia-ai-factory.git
cd sophia-ai-factory/apps/sophia-ai-factory
npm install

# 2. Local env
cp .env.example .env.local  # if exists; otherwise ask current maintainer for redacted .env
# Required minimum for local dev:
#   BETTER_AUTH_SECRET, NEXT_PUBLIC_APP_URL, DATABASE_URL (or D1 binding via wrangler dev)

# 3. Boot dev server
npm run dev                  # http://localhost:3000

# 4. Verify
npm run build                # 0 TS errors required
npm test                     # 1800+ tests pass

# 5. First PR
# - Branch off main; small focused change
# - Run npm run lint + npm test before push
# - Follow conventional commits (feat:/fix:/refactor:/test:/docs:/chore:)
# - No AI references in commit messages
```

---

## 8. Where to look first when X breaks

| Symptom | First file |
|---|---|
| Webhook 500s | `app/api/webhooks/<provider>/route.ts` |
| Auth not working | `seed/auth/better-auth-session.ts` + `lib/better-auth-session.ts` |
| Payout cron silent | `land/payouts/payout-batcher.ts` + Inngest dashboard |
| Email not sending | `forest/outbox/email-outbox.ts` + Resend dashboard |
| Schema missing on D1 | `scripts/apply-migrations.sh` — is your file in canonical `migrations/`? |
| Build fails | `npm run build` output; usually `:any` type or missing import |
| Tests fail locally pass CI | N/A — CI is disabled; if it passes local it ships |
| Production stale | SHA mismatch — re-run `npm run deploy:full` |

---

## 9. Key runbooks (read at least once)

- `docs/disaster-recovery.md` — RTO/RPO + D1 / R2 / KV / Worker recovery
- `docs/payout-operations-runbook.md` — dual-rail payouts on-call playbook
- `docs/secret-rotation-runbook.md` — quarterly secret rotation procedure
- `docs/observability-runbook.md` — Sentry / logs / alert triage
- `docs/support-escalation.md` — Tier 1 self-service + Tier 2 agency
- `docs/customer-handover-runbook.md` — agency-client handover automation
- `.claude/rules/sophia-deploy-verify.md` — MANDATORY verify sequence after deploy
- `.claude/rules/sophia-layer-architecture.md` — 4-layer rules
- `../docs/postmortem-template.md` (workspace root) — incident write-up template

---

## 10. Communication conventions

- **Commits:** conventional `feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`. No AI references.
- **Plans:** kebab-case in `plans/{YYMMDD-HHMM-slug}/`. Phase files `phase-XX-name.md`.
- **Reports:** `plans/reports/{type}-{YYMMDD-HHMM}-{slug}.md`. Sacrifice grammar for concision.
- **Vietnamese-Vietnamese-English code identifiers stay English.** Comments + docs may be bilingual where customer-facing.

---

## 11. Bus factor + escalation

Currently **bus factor 1**. Mitigation in progress:

1. This document.
2. Runbooks (see §9).
3. Postmortem archive (`docs/postmortems/`).
4. Contractor hire planned at $5K MRR + 3 months — see `plans/260510-0603-sophia-gap-plan/phase-08-team-process.md`.

Until then: ALL secrets are in 1Password vault `Sophia AI Factory`. Founder rotates quarterly. If founder unreachable for 72h: contractor-on-call procedure (TBD until first hire).

---

## Unresolved

- No CI guard for "migration in canonical folder" — relies on grep discipline.
- No automated Stripe-vs-D1 payout reconciliation (drift detected only by customer complaint).
- VN PIT remittance to tax authority is accrued in `commission_ledger.withheld_cents` but no monthly export job exists.
- `recently_run` cron idempotency window is 12h; first-deploy failures could block manual retry up to 12h. No override switch.
