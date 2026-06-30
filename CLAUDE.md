# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Identity

This is **Sophia AI Factory** — a Next.js 16 App Router SaaS platform for AI video generation, deployed to Cloudflare Workers via CF-direct doctrine. Work in `apps/sophia-ai-factory/`.

---

## Commands

All commands run from `apps/sophia-ai-factory/`:

```bash
npm run dev              # Next.js dev server on :3000
npm run build            # Production build (0 TypeScript errors required)
npm run lint             # ESLint (src/**)
npm run type-check       # TypeScript compiler check (--noEmit)
npm test                 # Vitest (runs pretest i18n:validate)
npm run test:watch       # Vitest watch mode
npx vitest run <path>    # Run specific test file or pattern
npm run test:coverage    # Coverage report (html, json-summary, text)
npm run test:e2e         # Playwright E2E (requires NEXT_PUBLIC_MOCK_AI_SERVICES=true)
npm run verify           # Full verification script (build, tests, secrets audit)
npm run deploy:full      # CF-direct deploy with SHA verification (MANDATORY)
npm run deploy:verify    # Run sophia-doctor.mjs health checks
npm run ci               # CI gate (typecheck, lint, test, secrets, audit)
```

---

## Architecture (4-Layer Model)

Code organization in `src/` follows strict layer boundaries:

| Layer | Purpose | Import Path | Example |
|-------|---------|-------------|---------|
| **seed** | Foundational primitives (auth, DB, config, types) | `@/seed/...` | `@/seed/auth/better-auth-session` |
| **tree** | Domain-specific reusable logic | `@/tree/...` | `@/tree/byok/`, `@/tree/telegram/` |
| **forest** | Infrastructure orchestrators | `@/forest/...` | `@/forest/inngest/`, `@/forest/quota/` |
| **land** | Business workflows | `@/land/...` | `@/land/billing/`, `@/land/payouts/` |

**Import rules:**
- `seed` → importable by ALL layers (foundational)
- `tree` → imports `seed` only
- `forest` → imports `seed`, `tree` (+ may CALL `land` for orchestration)
- `land` → imports `seed`, `tree`, `forest`

**Forbidden:** `seed` → `tree/forest/land`; `tree` → `forest/land`; `land` → `forest` (circular).

See `.claude/rules/sophia-layer-architecture.md` for full details.

---

## Canonical Import Paths (POST-2026-04-14 CONSOLIDATION)

These are the **single sources of truth**. Old paths are deleted; do not create new ones.

| Concern | Import |
|---|---|
| Auth session | `import { getCurrentUser } from '@/seed/auth/better-auth-session'` |
| DB client (sync) | `import { createServerClient } from '@/seed/db/client'` (DO NOT await) |
| Tier lookup | `import { getUserTier } from '@/seed/db/get-user-tier'` |
| Tier config | `import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers'` |

**BANNED imports:** `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.

---

## Protected Flows (DO NOT BREAK)

1. **Setup Wizard** — BYOK API key onboarding (OpenRouter, ElevenLabs, D-ID)
2. **Telegram Bot** — @Sophia_Bbot commands (`/campaign`, `/status`, `/results`)
3. **Payment Flow** — NOWPayments IPN webhook → tier activation

Any change touching these requires explicit validation.

---

## Deployment Contract (CF-Direct Doctrine)

**Effective:** 2026-05-03. GitHub Actions is disabled by design.

Production deploy flow:

```bash
# Step 0: Push first (deploy-with-sha.sh rejects unpushed commits)
git push origin main

# Step 1: Build + deploy from app package
cd apps/sophia-ai-factory
npm run deploy:full

# Step 2: Verify SHA match (NOT just HTTP 200)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"  # must match
```

**Green report requires:**
- `npm run deploy:full` exit 0
- `/api/version` `shortSha` matches local commit
- HTTP 200 on production URL
- Any new D1 migrations applied via `bash scripts/apply-migrations.sh`

Full verification spec: `.claude/rules/sophia-deploy-verify.md`.

---

## Product Doctrine (No-Code / No-Tech)

Sophia serves non-technical CEOs. Implications:

- **Customer self-input everything** (BYOK): API keys, payment providers, affiliate networks — all via Setup Wizard.
- **Operator manages PLATFORM ONLY**: No third-party cron registrations, no operator observability tokens, no operator-side credentials required for production.

If a feature requires operator-provided third-party credentials to be "complete", it is **out of scope** until made self-configuring or moved to customer side.

Full doctrine: `.claude/rules/sophia-no-tech-doctrine.md`.

---

## Quality Gates

- `npm run build` → 0 TypeScript errors
- `npm test` → all tests pass (6694+ tests)
- Zero `:any` types in production code
- Zero `console.log`/`console.warn`/`console.error` — use logger utility
- Zod validation on all API inputs
- Server Actions for data mutations (preferred over API routes)
- Tier enum values: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase only)

---

## Database

- **Primary:** Cloudflare D1 via `createServerClient()` (synchronous, do not `await`)
- **Secondary:** Supabase only for specific exceptions (OAuth callbacks, legacy shared flows)
- Migrations live in `apps/sophia-ai-factory/migrations/`. Apply via `scripts/apply-migrations.sh`.

---

## i18n

Bilingual Vietnamese + English required for all customer-facing content. Uses `next-intl` with locale segment `[locale]`.

---

## Key Files to Read

Before substantive work, read in order:

1. `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`
2. `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
3. `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`
4. `apps/sophia-ai-factory/.claude/rules/sophia-handover-rules.md`
5. `apps/sophia-ai-factory/.claude/rules/cross-layer-orchestration.md`
6. `docs/code-standards.md`
7. `docs/deployment-guide.md`
8. `docs/testing.md`

---

## Notes

- **Root package.json** is tooling only. Always run commands from `apps/sophia-ai-factory/`.
- `src/lib/` exists for compatibility; new primitives belong in `seed/`, `tree/`, `forest/`, or `land/`.
- Inngest owns long-running workflows (video generation, multi-step processes). Do not run these in request path.
- NOWPayments is primary payment provider; PayOS is Vietnam domestic backup. Polar.sh and PayPal are banned for Sophia billing.
