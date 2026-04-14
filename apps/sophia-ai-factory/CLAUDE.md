# Sophia AI Factory

Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4.
Cloudflare Workers deployment via GitHub Actions.

## Production

```
PROD_URL="https://sophia.agencyos.network"
GITHUB_REPO="longtho638-jpg/sophia-ai-factory"
```

## Commands

```bash
npm run dev      # Dev server :3000
npm run build    # Production build (0 errors required)
npm run lint     # ESLint
npm test         # Vitest (844+ tests)
```

## Architecture (post-consolidation 2026-04-14)

### Auth
- **Single source:** `@/lib/better-auth-session` for `getCurrentUser()`
- **Tier lookup:** `@/lib/db/get-user-tier` for `getUserTier(userId)`
- DELETED: `lib/auth.ts`, `lib/subscription.ts`, `lib/db/auth-verify.ts`, `lib/clients/`

### Database
- **Primary:** Cloudflare D1 via `createServerClient()` from `@/lib/db/client`
- `createServerClient()` is **synchronous** — do NOT `await` it
- **Supabase exceptions (keep):** OAuth callbacks (tiktok, youtube), admin invite, checkpoint persistence
- DELETED: direct `@/lib/supabase/admin` and `@/lib/supabase/server` imports (shims remain for exceptions)

### Tier Config
- **Single source:** `@/config/tiers` (barrel re-exporting from `config/tiers/`)
- Exports: `TIER_CONFIGS`, `TIER_CONFIG`, `TIER_DB_MAPPING`, `DB_TIER_MAPPING`, `UNIFIED_TIERS`
- DELETED: `lib/tier-gate.ts`, `lib/unified-tier-config.ts`

### Modularized Services
Giant files split into focused modules with barrel re-exports:
- `lib/billing/email/*` — email templates, delivery, tracking
- `lib/billing/dunning/*` — state machine, actions, admin ops
- `lib/alerts/quota/*` — rule evaluator, delivery, scheduling
- `lib/usage-metering/` — event collector, rollup engine, KV sync
- `lib/raas/*` — audit logging, permissions, invoice generation

### Payments
- **Primary:** NOWPayments (USDT crypto) — IPN webhook → tier activation
- **Backup:** PayOS (Vietnam domestic)
- **BANNED:** Polar.sh (rejected this product), PayPal

## Protected Flows (DO NOT BREAK)

1. **Setup Wizard** — API key onboarding (OpenRouter, ElevenLabs, D-ID)
2. **Telegram Bot** — @Sophia_Bbot (/campaign, /status, /results)
3. **Payment Flow** — NOWPayments IPN webhook → tier activation

## Quality Gates

- `npm run build` → 0 TypeScript errors
- `npm test` → 844+ tests pass
- Zero `:any` types in production code
- Zero `console.log` in production code
- Zod validation on all API inputs
- Server Actions for data mutations
- Tier enum: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase)

## Green Production Rule

After every `git push`, verify:
1. **CI/CD:** `gh run list -L 1` → `conclusion: success`
2. **Deploy:** `curl -sI "$PROD_URL" | head -3` → HTTP 200
3. **Report:** Build/Tests/CI/CD/Production status lines required
