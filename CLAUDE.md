# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Identity

This is **Sophia AI Factory** — a Next.js 16 App Router SaaS platform for AI video generation, deployed to Cloudflare Workers via GitHub Actions CI/CD (`.github/workflows/deploy.yml`). Work in `apps/sophia-ai-factory/`.

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

## Deployment Contract (GitHub Actions CI/CD Doctrine)

**Canonical Pipeline:** Automated GitHub Actions (`.github/workflows/deploy.yml`).

```bash
# Step 1: Commit and push changes to main
git push origin main

# Step 2: Observe automated deployment pipeline
gh run watch || gh run list --workflow=deploy.yml

# Step 3: Verify edge deployment SHA parity
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA Live: $LIVE_SHA"  # must match bit-for-bit
```

**Green report requires:**
- GitHub Actions `deploy.yml` run complete with exit code 0.
- Stage 1 Quality Gates pass (TypeScript, ESLint, Layer Boundaries, i18n, Vitest).
- Live `/api/version` `shortSha` matches the deployed commit SHA bit-for-bit.
- Production smoke verifies `/api/health` (200), `/login` (307), and `/vi/login` (200).
- Local direct deployment (`npm run deploy:full`) is blocked without `EMERGENCY_CF_DIRECT=1`.

Full verification spec: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`.

---

## Product Doctrine (No-Code / No-Tech)

Sophia serves non-technical CEOs. Implications:

- **Customer self-input everything** (BYOK): API keys, payment providers, affiliate networks — all via Setup Wizard.
- **Operator manages PLATFORM ONLY**: No third-party cron registrations, no operator observability tokens, no operator-side credentials required for production.

If a feature requires operator-provided third-party credentials to be "complete", it is **out of scope** until made self-configuring or moved to customer side.

Full doctrine: `.claude/rules/sophia-no-tech-doctrine.md`.

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
- `src/lib/` no longer exists (deleted by commit `b5a2b3eed`); all new primitives belong in `seed/`, `tree/`, `forest/`, or `land/`.
- Inngest owns long-running workflows (video generation, multi-step processes). Do not run these in request path.
- NOWPayments is primary payment provider; PayOS is Vietnam domestic backup. Polar.sh and PayPal are banned for Sophia billing.
