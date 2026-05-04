# Sophia AI Factory

Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4.
Cloudflare Workers deployment via GitHub Actions.

## Production

```
PROD_URL="https://sophia.agencyos.network"
GITHUB_REPO="longtho638-jpg/sophia-ai-factory"
```

## Deploy Verification (MANDATORY for git-manager / any agent reporting GREEN)

**MUST READ:** `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

Hard rules:
- Workflow `Tests & Deploy` có 2 jobs — TẤT CẢ phải success (không chỉ check `gh run list -L 1`)
- Verify deploy SHA via `curl -s https://sophia.agencyos.network/api/version` — phải khớp `git rev-parse HEAD | cut -c1-8`
- HTTP 200 KHÔNG đủ — có thể là deploy CŨ. Phải SHA match.
- Báo cáo "Vercel auto-deployed" = SAI 100% (project là Cloudflare Workers, không có vercel.json)

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

## ⚠️ GitHub Actions BLOCKED (since 2026-05-03)

**Status:** Account `longtho638-jpg` has Actions disabled at user level.
- Repo perms `enabled: true` ✅
- Workflow `Tests & Deploy` `active` ✅
- BUT: `gh workflow run` returns HTTP 422: *"Actions has been disabled for this user"*
- `gh run list` returns 0 results — pushes do NOT trigger CI

**Diagnosis path:**
- Token has `gist, read:org, repo, workflow` scopes
- billing API needs `user` scope (not granted) → cannot inspect billing programmatically
- Most likely cause: free-tier minutes exhausted OR account flagged for abuse review
- Resolution requires user action: check https://github.com/settings/billing or contact support

**Workaround (in use until resolved):**

Manual deploy via wrangler — exception per `~/.claude/rules/binh-phap-cicd.md` (CI account-blocked, not broken):

```bash
cd apps/sophia-ai-factory
npm run deploy:full   # builds OpenNext, injects SHA, wrangler deploy
# then verify SHA match per sophia-deploy-verify.md
```

**For D1 migrations** (CI normally applies):
```bash
npx wrangler d1 execute sophia-raas-db --file=migrations/<NNNN>.sql --remote
```

**Recent successful manual deploys:** `d84f3a6e` (2026-05-03), `e53c7dd2`, `aafd1ba4`.
