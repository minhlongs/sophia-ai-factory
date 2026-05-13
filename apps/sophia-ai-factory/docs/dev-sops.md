# Sophia AI Factory — Developer SOPs

> Standard Operating Procedures cho contributors. Single canonical source.
> Adapted từ mekong-cli `docs/dev-sops.md` cho stack Next.js 16 + CF Workers + Better Auth + D1.
> **Last reviewed:** 2026-05-12

---

## SOP 1: Environment Setup

```bash
# 1. Clone monorepo
git clone https://github.com/longtho638-jpg/sophia-ai-factory.git
cd sophia-ai-factory/apps/sophia-ai-factory

# 2. Install deps
npm install

# 3. Local secrets (CF Workers .dev.vars, KHÔNG commit)
cp .dev.vars.example .dev.vars
# Fill: BETTER_AUTH_SECRET, NOWPAYMENTS_*, RESEND_*, etc.

# 4. CF login (one-time)
npx wrangler login

# 5. Verify
npm run dev          # http://localhost:3000
npm test -- --run    # exits 0
```

**Acceptance:** Dev server boots :3000, tests pass.

---

## SOP 2: Test Suite Execution

```bash
npm test                 # Vitest watch mode (dev)
npm test -- --run        # CI mode (one-shot)
npm run test:coverage    # With coverage report
npm run test:e2e         # Playwright (requires NEXT_PUBLIC_MOCK_AI_SERVICES=true)
npm run test:smoke       # tsx scripts/smoke-test.ts
```

i18n validation auto-runs via `pretest` hook (validates `t('...')` keys match locales).

**Acceptance:** 1398+/1398 pass, coverage ≥ baseline.

---

## SOP 3: Add a New API Route

1. Create `src/app/api/<route>/route.ts`:
   ```ts
   import { NextRequest, NextResponse } from 'next/server';
   import { getCurrentUser } from '@/lib/better-auth-session';
   import { mySchema } from '@/seed/validators/...';

   export const dynamic = 'force-dynamic';

   export async function POST(request: NextRequest) {
     const user = await getCurrentUser();
     if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

     const body = await request.json();
     const validated = mySchema.safeParse(body);
     if (!validated.success) {
       return NextResponse.json({ error: validated.error.issues[0]?.message }, { status: 400 });
     }
     // ... handler logic
   }
   ```

2. Zod validate ALL inputs.
3. DB access via `createServerClient()` from `@/lib/db/client` (**sync, no await**).
4. Add test `src/app/api/<route>/__tests__/route.test.ts`.

**Acceptance:** `npm run build` 0 errors + new test passes.

---

## SOP 4: Modify Seed/Tree/Forest/Land Layers

Reference: `.claude/rules/sophia-layer-architecture.md`

**Import direction:** `seed ← tree ← forest ← land`
**Allowed exception:** `forest → land` (orchestration only; see `cross-layer-orchestration.md`).

**FORBIDDEN (ESLint enforces per SOP 9):**
- `src/seed/**` importing `@/forest/*` or `@/tree/*`
- `src/tree/**` importing `@/forest/*` or `@/land/*`
- `src/land/**` importing `@/forest/*` (would be circular)

**Canonical import aliases** (do NOT use deprecated paths):
| Concern | Use |
|---|---|
| Auth session | `@/lib/better-auth-session` |
| Tier lookup | `@/lib/db/get-user-tier` |
| DB client | `@/lib/db/client` (sync) |
| Tier config | `@/config/tiers` |

**Banned imports:** `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.

Add barrel `index.ts` exports for new public APIs (`<domain>/index.ts`).

---

## SOP 5: Deploy to Cloudflare Workers (CF-direct doctrine)

Reference (**MUST READ**): `.claude/rules/sophia-deploy-verify.md`

```bash
# Step 1: Build + inject SHA + wrangler deploy
cd apps/sophia-ai-factory
npm run deploy:full

# Step 2: Apply migrations if migrations/ changed
git diff --name-only HEAD~1 HEAD apps/sophia-ai-factory/migrations/ 2>/dev/null | grep -E "\.sql$"
# nếu non-empty:
bash scripts/apply-migrations.sh

# Step 3: SHA match (MANDATORY — HTTP 200 alone không đủ)
LOCAL=$(git rev-parse HEAD | cut -c1-8)
LIVE=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
[ "$LOCAL" = "$LIVE" ] && echo "✅ MATCH" || { echo "❌ STALE — re-run deploy:full"; exit 1; }

# Step 4: HTTP health
curl -sI https://sophia.agencyos.network | head -3   # HTTP/2 200
```

**Anti-patterns:**
- ❌ `gh run list` — GitHub Actions disabled 2026-05-03 (workflow archived `.disabled`)
- ❌ "Vercel auto-deployed" — project is CF Workers, no `vercel.json`
- ❌ Report GREEN without SHA match

**Production smoke runbook:** `docs/sop-ceo-production-smoke.md`

---

## SOP 6: Git Workflow

**Branch:**
- `feat/<short-name>`, `fix/<scope-issue>`, `refactor/<area>`, `docs/<topic>`

**Conventional commits:**
```
feat(billing): add NOWPayments IPN handler
fix(quota): correct video credit calculation
refactor(seed): invert tier-enforcer DI
docs: unified dev-sops.md
chore: bump next to 16.2
```

**Pre-commit (husky, SOP 9):** blocks lint errors, type errors, secrets.
**Pre-push (husky):** runs full test suite + audit.

**Solo workflow:** PR not required (CF-direct). Use `gh pr create` for reviewed work.

**Never:**
- `git add -A` (use specific paths)
- Commit `.dev.vars`, `.env*`, API keys
- `--no-verify` flag (bypass hooks)

---

## SOP 7: Debug Issues

| Surface | Command |
|---|---|
| Local app | `npm run dev` + browser devtools |
| Prod version | `curl -s https://sophia.agencyos.network/api/version` (public, returns `shortSha`) |
| Prod health | `curl -s https://sophia.agencyos.network/api/health` (auth-gated) |
| Live logs | `npx wrangler tail` (CF Workers stream) |
| D1 query | `npx wrangler d1 execute sophia-raas-db --remote --command "SELECT ..."` |
| Self-check | `npm run doctor` (runs `scripts/sophia-doctor.mjs`) |

**Supervisor agent runbook:** `docs/sophia-supervisor-agent-runbook.md`
**Load testing:** `docs/load-testing-runbook.md`
**Payout ops:** `docs/payout-operations-runbook.md`

---

## SOP 8: Project Structure Cheat Sheet

```
apps/sophia-ai-factory/
├── src/
│   ├── seed/                # ~147 files — primitives (types, config, db client, auth, logger)
│   ├── tree/                # ~162 files — domain reusable (byok, telegram, handover, audit)
│   ├── forest/              # ~362 files — infra orchestrators (inngest, raas, quota, metering)
│   ├── land/                # ~113 files — business workflows (billing, payouts, affiliates, promo)
│   ├── app/                 # Next.js App Router (routes, layouts, api/)
│   ├── lib/                 # Legacy + canonical aliases (better-auth-session, db/client, tier-gate*)
│   ├── config/tiers/        # Tier source-of-truth
│   └── components/          # UI components (shared)
├── migrations/              # D1 SQL migrations (numbered)
├── scripts/                 # deploy-with-sha.sh, apply-migrations.sh, sophia-doctor.mjs
├── docs/                    # SOPs, runbooks, architecture
├── plans/                   # Implementation plans (per ck-plan conventions)
├── public/                  # Static assets
└── wrangler.toml            # CF Workers config (DB binding, R2 cache, secrets refs)
```

**Reference:** `.claude/rules/sophia-layer-architecture.md`

---

## SOP 9: CI Gates (Local Enforcement)

GitHub Actions disabled by design 2026-05-03 (CF-direct doctrine). Gates run **locally** via npm + husky.

| Gate | Command | Trigger |
|---|---|---|
| **G1 typecheck** | `npm run type-check` | pre-commit (staged), pre-push (full) |
| **G2 lint** | `npm run lint` (`--max-warnings=0`) | pre-commit (staged via lint-staged) |
| **G3 test** | `npm test -- --run` | pre-push |
| **G4 secret scan** | `npx secretlint "**/*"` | pre-commit |
| **G5 audit** | `npm audit --audit-level=high` | pre-push |

**Unified:** `npm run ci` runs G1→G5 sequentially (use before manual deploy).

**Setup:** see Phase 2 of plan `260512-2001-mekong-sops-gap-bridge`.

**Anti-pattern:** `git commit --no-verify` skips gates — DO NOT use unless user explicitly authorizes.

---

## SOP 10: Security Checklist

**Secrets:**
- [ ] `.dev.vars` for local (NEVER commit)
- [ ] `wrangler secret put <NAME>` for production
- [ ] No hardcoded keys in source
- [ ] `git secrets` / `secretlint` pre-commit (G4)

**Type Safety:**
- [ ] No `:any` types in production code
- [ ] No `console.log` (use `logger` from `@/seed/utils/logger-utility`)
- [ ] Zod validation on every API input

**Auth:**
- [ ] Routes use `getCurrentUser()` from `@/lib/better-auth-session`
- [ ] NEVER raw JWT parsing in handlers
- [ ] Webhook auth: HMAC verification (NOWPayments IPN)

**Banned imports:**
- [ ] `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`
- [ ] `@/forest/*` or `@/tree/*` from `src/seed/**`
- [ ] `@/forest/*` from `src/land/**` (circular)

**Payment policy:**
- [ ] Primary: NOWPayments (USDT crypto)
- [ ] Backup: PayOS (Vietnam domestic)
- [ ] **BANNED:** Polar.sh (rejected this product), PayPal

**Tier enum:** `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase only).

---

## SOP 11: Emergency D1 Backup

Manual disaster-recovery procedure when scheduled backups have not run (e.g., external cron failure) or when an operator needs an immediate snapshot before risky migrations.

**When to invoke:**
- Pre-migration safety net (any `ALTER TABLE` or `DROP COLUMN` on production)
- Suspected data corruption (capture state before mitigation)
- Failed scheduled backup (Phase 4 G1 cron job missed window)
- Quarterly DR drill (see `docs/deployment-guide.md` §8)

**Prerequisites:**
- R2 bucket `sophia-backups` provisioned (created 2026-05-12 — verify via `npx wrangler r2 bucket list | grep sophia-backups`)
- `wrangler` authenticated (`npx wrangler whoami`)
- Run from `apps/sophia-ai-factory/` working directory

**Procedure:**

```bash
# Step 1 — Snapshot D1 to local sql file
cd apps/sophia-ai-factory
bash scripts/dr/d1-snapshot.sh
# Output: backups/d1-YYYY-MM-DD-HHMMSS.sql

# Step 2 — Upload to R2 sophia-backups bucket
SNAPSHOT_FILE=$(ls -1t backups/d1-*.sql | head -1)
DATE_KEY=$(date -u +%Y-%m-%d-%H%M%S)
gzip -k "$SNAPSHOT_FILE"
npx wrangler r2 object put "sophia-backups/d1/${DATE_KEY}.sql.gz" \
  --file="${SNAPSHOT_FILE}.gz" --remote

# Step 3 — Verify upload
npx wrangler r2 object get "sophia-backups/d1/${DATE_KEY}.sql.gz" \
  --file=/tmp/verify.sql.gz --remote
gunzip -t /tmp/verify.sql.gz && echo "✅ snapshot valid"

# Step 4 — Log to operator notebook
echo "$(date -u +%FT%TZ) manual snapshot ${DATE_KEY}.sql.gz reason=<why>" \
  >> docs/operator-notebook.log
```

**Restore (DR drill or recovery):**

```bash
# DRY-RUN (default — safe, no DB changes): validates snapshot + prints intended actions
bash scripts/dr/restore-from-snapshot.sh
# Or with explicit snapshot:
bash scripts/dr/restore-from-snapshot.sh --snapshot backups/d1-YYYY-MM-DD-HHMMSS.sql

# CONFIRM (executes restore — IRREVERSIBLE):
bash scripts/dr/restore-from-snapshot.sh --snapshot backups/d1-YYYY-MM-DD-HHMMSS.sql --confirm
```

⚠️ Without `--confirm`, the script ALWAYS dry-runs. Reading "Restore completed" in dry-run output means nothing actually changed.

**Verify recovery:**
1. Smoke checklist: follow `docs/sop-ceo-production-smoke.md` step by step (manual runbook for non-tech operator).
2. Programmatic smoke: `npm run test:smoke` (runs `scripts/smoke-test.ts`).
3. Confirm SHA match per `.claude/rules/sophia-deploy-verify.md`.

**Cross-refs:** RPO=24h / RTO=4h targets in `docs/deployment-guide.md` §8.

---

## SOP 12: Sentry Alert Rules

Required Sentry issue-alert configuration for production observability. Configure once in Sentry dashboard; revisit quarterly.

**Required Rules (dashboard → Alerts → Create Alert):**

| Rule | Condition | Action | Cadence |
|------|-----------|--------|---------|
| **Error-rate spike** | `event.count` > 5 per 1-min window | Email/Slack on-call | Immediate |
| **New issue first-seen** | `event.type = error AND issue.is_new = true` | Daily digest | 1×/day |
| **High-severity regression** | Any issue reopened with `level:fatal` | Email on-call + ticket | Immediate |
| **Performance degradation** | p95 transaction duration > 2s for 5min | Slack notification | Throttle 1×/hour |

**Setup checklist:**
- [ ] Confirm `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` are exported in the deploy shell env (NOT wrangler secret — these are consumed by `@sentry/cli` at deploy time, before the worker runs). Operator should keep them in `~/.sophia-deploy.env` (gitignored) sourced before `npm run deploy:full`.
- [ ] Verify after deploy: `grep -A2 'sentry-upload-sourcemaps' .open-next/ || curl -sI sentry.io` — script logs whether token was set
- [ ] Confirm source maps uploaded (see `scripts/deploy-with-sha.sh` Step 5 — Phase 1 G3)
- [ ] Dashboard owner: Sophia operator
- [ ] Recipient channels documented in operator notebook
- [ ] Tune false-positive rate after first 7 days of data

**Cross-refs:** Source map upload baked into `scripts/deploy-with-sha.sh` step 5; configuration in `src/lib/observability/sentry-options.ts`.

---

## SOP 13: Cloudflare Spend Alert

Prevent surprise bills by configuring CF notification thresholds. Dashboard-only — no API automation for billing alerts on standard plans.

**Setup checklist:**
- [ ] Dashboard → top-right account menu → **Notifications**
- [ ] Click **Add** → category **Billing**
- [ ] Choose alert type: *Subscription* (per-product spend) or *Anomaly* (unexpected spike)
- [ ] Set threshold (suggested: $40/mo soft, $80/mo hard for solo-company baseline)
- [ ] Recipient: ops email + Slack/PagerDuty webhook if available
- [ ] Repeat for each paid service: Workers Paid, R2, D1 (if on paid tier)

**Review cadence:**
- Monthly: review last 30d spend vs threshold in dashboard
- Quarterly: re-tune thresholds based on actual usage growth

**Anti-patterns:**
- ❌ Set threshold only on total account spend → masks per-service spikes
- ❌ Disable alerts during traffic experiments → re-enable IMMEDIATELY after

**Recovery if budget blown:**
1. Identify spike service in Analytics → Workers/R2/D1
2. Check Inngest job loops, recursive cron, or runaway egress
3. Emergency: temporarily disable offending route via `wrangler tail` + redeploy with kill switch
4. Post-mortem: file in operator notebook

**Cross-refs:** `docs/deployment-guide.md` §1 (cost section); `.claude/rules/binh-phap-cicd.md` (CI/CD doctrine).

---

## Cross-references

| Doc | Purpose |
|---|---|
| `.claude/rules/sophia-layer-architecture.md` | 4-layer rules + import direction |
| `.claude/rules/cross-layer-orchestration.md` | Forest→Land orchestration exception |
| `.claude/rules/sophia-deploy-verify.md` | Deploy verify mandatory sequence |
| `.claude/rules/sophia-handover-rules.md` | Client-facing quality (non-tech CEO) |
| `docs/code-standards.md` | Detailed coding rules |
| `docs/system-architecture.md` | High-level architecture |
| `docs/deployment-guide.md` | Deploy onboarding |
| `docs/sop-ceo-production-smoke.md` | Production smoke checklist |
| `docs/payout-operations-runbook.md` | Payout ops procedures |
| `docs/load-testing-runbook.md` | k6 load test scripts |

---

*If a procedure conflicts with `.claude/rules/*.md`, the rule file wins (it is authoritative). Update this SOP doc to match.*
