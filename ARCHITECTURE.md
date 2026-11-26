# ARCHITECTURE.md

**Updated:** 2026-11-26 (Single Source of Truth aligned with `7e607edb`)

## System Summary

Sophia AI Factory is a Next.js 16 App Router application compiled for Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`). The primary application lives in `apps/sophia-ai-factory/`.

- **Production Worker:** `sophia-ai-factory` (`wrangler.toml`) → `https://sophia-ai-factory.agencyos-openclaw.workers.dev` · D1 `sophia-raas-db`
- **Permanent Internal R&D Worker (`$0 RaaS`):** `sophia-ai-factory-pilot` (`wrangler.pilot.toml`) → `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev` · D1 `sophia-pilot-db` (910 tables, schema-synced, zero prod customer data, `PILOT_WINDOW_MODE="OPEN_INTERNAL_RD"`, `PAYMENTS_ENABLED="false"`, CF Access protected)

## 4-Layer Clean Architecture (Zero `src/lib/`)

`src/lib/` has been permanently deleted. All code strictly follows 4 layers:

| Layer | Role | Rule |
|---|---|---|
| `seed/` | Pure primitives: auth session, sync D1 client, tier config, Policy-as-Code 4-matrix compliance (`seed/compliance/`), pilot access policy | Importable by all layers; zero upper-layer imports |
| `tree/` | Domain reusable logic: BYOK encryption, D1 repositories, audit, Telegram, credentials | Imports `seed/` only |
| `forest/` | Infrastructure orchestrators & shared UI: Dashboard shell (5 core + 4 advanced nav), Inngest jobs, RaaS gateway, quota | Imports `seed/`, `tree/` |
| `land/` | Business workflows & HTTP handlers: `/api/first-value`, HeyGen BYOK client, OpenRouter TTS, affiliate reconciliation, billing | Must not import `forest/` |

## Canonical Imports

- Auth session: `import { getCurrentUser } from '@/seed/auth/better-auth-session'`
- DB client (sync, DO NOT `await`): `import { createServerClient } from '@/seed/db/client'`
- Tier lookup: `import { getUserTier } from '@/seed/db/get-user-tier'`
- Tier config: `import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers'`
- Policy Preflight: `import { runPolicyPreflight } from '@/seed/compliance/policy-preflight-engine'`

## Core Engines

1. **Craft Studio 4-Step Affiliate Workspace (`/dashboard/first-value`)**: Single-focus inline pipeline (`Setup & Offer → Script & Policy Preflight → Video MP4 & /api/r/ Shortlink → Revenue & Ops`).
2. **Policy-as-Code 4-Matrix Engine (`seed/compliance/policy-preflight-engine.ts`)**: Deterministic pre-flight sanitizer & disclosure injector across Jurisdiction (`VN/US/UK/EU/SG/GLOBAL`), Platform (`TikTok/YouTube Shorts/IG/FB Reels`), Provider (`HeyGen/D-ID/OpenRouter TTS/Browser MP4`), and Vertical (`Crypto/SaaS`).
3. **1-Key OpenRouter BYOK + Browser MP4 / HeyGen OmniRouter**: Single OpenRouter key powers scripts + TTS; Browser MP4 renders locally at `$0`; HeyGen BYOK enforces 15m auto-timeout and pre-flight moderation sanitization.
4. **Anti-Domino Guard**: `pilot-wrangler-cost-controls.test.ts` parses live `wrangler.pilot.toml` `[vars]` against `resolvePilotCostControls()` to prevent config/code drift.

## Deployment Contract (Unified)

- Canonical CI/CD: `.github/workflows/deploy.yml` on push to `main`.
- Dual-Sync Cloudflare Workers: `wrangler.toml` (Production) + `wrangler.pilot.toml` (Internal R&D Pilot, verified by `scripts/verify-pilot-wrangler-isolation.mjs --require-resolved-ids`).
- Mandatory Post-Deploy Verification: Live `/api/version` `shortSha` must match `git rev-parse --short=8 origin/main` bit-for-bit, and `/api/health` must return HTTP `200`.
