# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Identity

**Sophia AI Factory** — Next.js 16 App Router SaaS for AI video generation (faceless YouTube + affiliate empires). Deployed to Cloudflare Workers via CF-direct doctrine. Non-technical CEO customers, BYOK (bring your own AI keys).

---

## Financial Code Patterns

Battle-tested patterns for ALL financial/money code:
- **Atomic Lock**: `INSERT ... ON CONFLICT DO NOTHING` (D1 has no transactions). Check `meta.changes` for ownership.
- **Result<T,E>**: Never `throw` in financial code. Return `success(data)` / `failure({ code, message })`.
- **Event ID formats**: `nowpayments_{id}_{status}`, `clickbank_{receipt}_{type}`, `topup_{id}_{status}`, `refund_{purchase_id}`
- **Stale lock recovery**: After 5 min, treat unprocessed locks as stale — mark processed and retry.
- **Circuit breaker**: Every external HTTP call uses `shouldAllowRequest` / `recordSuccess` / `recordFailure` from `@/seed/security/circuit-breaker`. HALF_OPEN probe failure → immediately re-open. AUTH_FAILURE → immediate open (no cooldown).

---

## Canonical Import Paths (POST-2026-04-14 CONSOLIDATION)

Single sources of truth. Old paths deleted; do not create new ones.

| Concern | Import |
|---------|--------|
| Auth session | `import { getCurrentUser } from '@/seed/auth/better-auth-session'` |
| DB client (sync) | `import { createServerClient } from '@/seed/db/client'` (DO NOT await) |
| Tier lookup | `import { getUserTier } from '@/seed/db/get-user-tier'` |
| Tier config | `import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers'` |
| Tier pricing | `import { TOPUP_PRICE_PER_MCU } from '@/seed/config/tiers/tier-configs'` |
| Result type | `import { success, failure, type Result } from '@/seed/types/result'` |
| Overage billing ops | `import { markEventsAsBillable } from '@/seed/db/overage-billing-ops'` |
| Circuit breaker | `import { recordFailure, recordSuccess, shouldAllowRequest } from '@/seed/security/circuit-breaker'` |
| Failure classification | `import { classifyError, classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind'` |
| Quota cache ops | `import { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops'` |
| Inngest client | `import { inngest } from '@/seed/inngest/client'` |
| Locale-aware Link | `import { Link } from '@/navigation'` (named export) |

**BANNED imports:** `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.

---

## Request Flow

```
Client Request
  → Middleware (CSRF, CORS, MFA, auth guard, CSP nonce, locale redirect)
    → API Route / Server Component / App Router Page
      → (optional) Inngest job for long-running workflows
        → D1 database (synchronous, no await)
```

**Middleware** (`src/middleware.ts`): Matches all routes except `_next`, `_worker`, `auth/callback`, `api/version`, static files. Handles CSRF token seeding, CORS preflight, MFA enforcement for sensitive routes, admin tier/role gate for `/dashboard/admin/*`.

**Auth**: Better Auth v1.6.2 with `emailAndPassword` enabled. Client: `import { authClient } from '@/seed/auth/better-auth-client'`. Server: `getCurrentUser()` from better-auth-session.

**i18n**: `next-intl` with locale segment `[locale]`, `localePrefix: 'always'`, default locale `vi` (Vietnamese). All customer-facing content must be bilingual. Messages in `messages/vi.json` and `messages/en.json`. Use `useTranslations('namespace')` in client components, `getTranslations('namespace')` in server components.

---

## Database

- **Primary**: Cloudflare D1 (SQLite) via `createServerClient()` — synchronous, do not `await`
- **Secondary**: Supabase only for OAuth callbacks, legacy shared flows
- **getD1()**: Returns raw D1 binding for direct SQL (migrations, audit logs)
- Migrations: `apps/sophia-ai-factory/migrations/`. Apply via `scripts/apply-migrations.sh`

---

## Protected Flows (DO NOT BREAK)

1. **Setup Wizard** — BYOK API key onboarding (OpenRouter, ElevenLabs, D-ID, HeyGen)
2. **Telegram Bot** — @Sophia_Bbot commands (`/campaign`, `/status`, `/results`)
3. **Payment Flow** — NOWPayments IPN webhook → tier activation

Any change touching these requires explicit validation.

---

## Deployment Contract (CF-Direct Doctrine)

**Effective:** 2026-05-03. GitHub Actions disabled by design.

```bash
# Step 0: Push first (deploy-with-sha.sh rejects unpushed commits)
git push origin main

# Step 1: Build + deploy
cd apps/sophia-ai-factory
npm run deploy:full

# Step 2: Verify SHA match (NOT just HTTP 200)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA Live: $LIVE_SHA"  # must match
```

Green report requires: deploy:full exit 0, `/api/version` shortSha matches, HTTP 200, migrations applied.

Full spec: `.claude/rules/sophia-deploy-verify.md`

---

## Product Doctrine (No-Code / No-Tech)

- **Customer self-input everything** (BYOK): API keys, payment providers, affiliate networks — all via Setup Wizard
- **Operator manages PLATFORM ONLY**: No third-party cron registrations, no operator observability tokens, no operator-side credentials required for production

If a feature requires operator-provided third-party credentials to be "complete", it is **out of scope** until made self-configuring or moved to customer side.

Full doctrine: `.claude/rules/sophia-no-tech-doctrine.md`

---

## Quality Gates

- `npm run build` → 0 TypeScript errors
- `npm test` → all tests pass (6744+ tests)
- Circuit breaker on all external HTTP calls (OpenRouter, ElevenLabs, D-ID, HeyGen, NOWPayments, ClickBank, Replicate, fal.ai)
- Per-kind error classification: AUTH_FAILURE → immediate open, RATE_LIMIT → cooldown, SERVER_ERROR → retry with backoff
- No bare try/catch for external HTTP without failure kind classification
- Zero `:any` types in production code
- Zero `console.log`/`console.warn`/`console.error` — use `@/seed/utils/logger-utility`
- Zod validation on all API inputs
- Server Actions (`'use server'`) for data mutations — preferred over API routes. Auth via `getCurrentUser()`.
- Tier enum: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase only)
- No land→forest imports (enforced by ESLint `no-restricted-imports`). Run `npm run lint` to catch.
- Deploy: working tree must be clean (`deploy-with-sha.sh` rejects dirty trees). Commit docs before deploy.

---

## Key Rules to Read Before Substantive Work

1. `.claude/rules/sophia-layer-architecture.md` — 4-layer import boundaries
2. `.claude/rules/sophia-deploy-verify.md` — deploy verification sequence
3. `.claude/rules/sophia-no-tech-doctrine.md` — BYOK + operator-only-platform
4. `.claude/rules/sophia-handover-rules.md` — client-facing quality rules
5. `.claude/rules/cross-layer-orchestration.md` — forest→land orchestration exception
6. `docs/code-standards.md` — coding standards
7. `docs/deployment-guide.md` — deployment procedures
8. `docs/testing.md` — testing guidelines

---

## Notes

- **Root package.json** is tooling only. Always run commands from `apps/sophia-ai-factory/`.
- `src/lib/` exists for compatibility; new primitives belong in `seed/`, `tree/`, `forest/`, or `land/`.
- Inngest owns long-running workflows (video generation, multi-step processes). Do not run these in request path.
- NOWPayments is primary payment provider; PayOS is Vietnam domestic backup. Polar.sh and PayPal are banned.
- `src/navigation.ts` exports `{ Link, redirect, usePathname, useRouter }` from `next-intl/navigation` — use for locale-aware navigation.
- CLEO pre-push hook requires task IDs in commit subjects. Use `git push --no-verify` only for docs/hotfixes.
- `npm run deploy:full` runs pre-deploy type-check + test gate + SHA verification automatically. Dirty working tree = rejected.
- `src/land/billing/actions/` holds `'use server'` billing portal actions (change-tier, cancel-subscription, resubscribe).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
