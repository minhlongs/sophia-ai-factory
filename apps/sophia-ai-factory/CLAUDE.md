# Sophia AI Factory

Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4.
Cloudflare Workers deployment via wrangler CLI direct (CF-direct doctrine, effective 2026-05-03).

## Production

```
PROD_URL="https://sophia.agencyos.network"
GITHUB_REPO="longtho638-jpg/sophia-ai-factory"
```

## Deploy Verification (MANDATORY for git-manager / any agent reporting GREEN)

**MUST READ:** `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

Hard rules:
- `npm run deploy:full` là path canonical; GitHub Actions disabled, không check `gh run list`
- `E2E_TEST_USER_PASSWORD` phải có trong operator shell trước deploy
- `deploy:full` deploy trước, sau đó chạy go-live user E2E trên artifact mới live
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

## Canonical Deploy Flow (CF-direct doctrine)

```bash
# Step 1: Build + inject SHA + deploy
cd apps/sophia-ai-factory
export E2E_TEST_USER_PASSWORD='<production-e2e-user-password>'
npm run deploy:full

# Step 2: Apply any new D1 migrations (if migrations/ changed)
bash scripts/apply-migrations.sh   # or: npm run deploy:migrations

# Step 3: Verify SHA match
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Must match: git rev-parse HEAD | cut -c1-8
```

**MUST READ for full verify sequence:** `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

Hard rules:
- SHA match is MANDATORY — HTTP 200 alone is not sufficient (may be stale deploy)
- Run `npm run deploy:migrations` after any commit that adds files to `migrations/`
- Do NOT use `gh run list` as deploy check — GitHub Actions is intentionally disabled

## Green Production Rule

After every `npm run deploy:full`, verify:
1. **Deploy script:** exit code 0 (wrangler deploy + go-live user E2E + production SHA/HTTP verification passed)
2. **SHA match:** `scripts/verify-production-deploy.sh` compares cache-busted `/api/version?deployVerify=<shortSha>` with `git rev-parse HEAD | cut -c1-8`
3. **HTTP:** `curl -sI "$PROD_URL" | head -3` → HTTP 200
4. **Report:** Build/Tests/Deploy/Go-live E2E/SHA/Production status lines required

## Historical Note: GitHub Actions (disabled by design since 2026-05-03)

**Status:** Account `longtho638-jpg` had Actions disabled at user level (free-tier minutes exhausted or account review). Workflow `test.yml` archived as `.github/workflows/test.yml.disabled`.

The team evaluated this and decided to adopt CF-direct (wrangler CLI) as the permanent canonical deploy path rather than restore CI. This is faster, simpler, and removes the dependency on GitHub Actions availability.

**Proof-of-path (5 successful manual deploys before doctrine change):**
`d84f3a6e`, `e53c7dd2`, `aafd1ba4`, `0520585b`, `f418f3df`

To re-enable GitHub Actions CI in future: rename `.github/workflows/test.yml.disabled` back to `.github/workflows/test.yml`.
