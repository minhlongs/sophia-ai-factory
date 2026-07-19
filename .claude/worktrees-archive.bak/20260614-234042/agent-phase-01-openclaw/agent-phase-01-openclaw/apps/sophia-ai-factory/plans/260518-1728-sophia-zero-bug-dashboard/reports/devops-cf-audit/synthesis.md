# Cloudflare DevOps Audit — Synthesis & Ranked Action List

**Date:** 2026-05-18 | **Mode:** /devops "C F only --auto" | **Inputs:** 2 parallel track reports

Scope: Cloudflare-only DevOps audit of Sophia AI Factory. Stack: Workers (OpenNext) + 2 D1 + 3 R2 + KV + 17 cron triggers + 117 migrations. Deploy: CF-direct via `npm run deploy:full` (GitHub Actions disabled by design 2026-05-03).

---

## Ranked Top 10 Issues

| # | Severity | Issue | Track | Fix LOC |
|---:|---|---|---|---:|
| 1 | 🔴 CRITICAL | `fulfillment-retry` (*/2m) + `fulfillment-reconcile` (06:00) crons NEVER FIRE — mapped in inject-scheduled-handler.mjs but absent from `wrangler.toml` triggers array | A§3 | 2 |
| 2 | 🔴 CRITICAL | Middleware hits D1 on every `/dashboard` GET to check `onboarding_completed_at` — no cache, full-region round-trip per request | B§4 | ~15 |
| 3 | 🟠 HIGH | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` missing from prod secrets → cron/uptime + weekly-signals-digest + alert handlers fail silently | A§2 | secret put + startup check |
| 4 | 🟠 HIGH | `wrangler.staging.toml` copies prod `EXPERIMENT_KV` namespace id verbatim → staging A/B writes pollute prod feature flag cache | A§6 | new KV namespace + 1 line |
| 5 | 🟠 HIGH | `scripts/apply-migrations.sh` uses `git diff HEAD~1 HEAD` as applied-cursor — no idempotency. With 117 migrations, double-apply risk increasing | A§5 | switch to `wrangler d1 migrations apply --remote` |
| 6 | 🟡 MEDIUM | `storage-tracker-cron.ts` references `VIDEO_R2_BUCKET` but wrangler declares `VIDEO_BUCKET` → tracker silently measures wrong bucket (likely nothing) | B§3 | 2 |
| 7 | 🟡 MEDIUM | Bare `npm run deploy` bypasses ALL safety guards (push-check, SHA inject, retries) — only `npm run deploy:full` is safe | A§4 | remove or alias |
| 8 | 🟡 MEDIUM | HSTS / X-Frame-Options / X-Content-Type-Options set in `next.config.ts` static headers — NOT re-applied inside middleware redirect/rewrite paths. Coverage depends on OpenNext merge behavior | B§1 | ~10 |
| 9 | 🟡 MEDIUM | Sentry SDK boots silently if `NEXT_PUBLIC_SENTRY_DSN` missing — no health-endpoint visibility | B§6 | 5 |
| 10 | 🟢 LOW | Junk secrets on prod: 7 dead `POLAR_*` (banned product) + 4 redundant `NEXT_PUBLIC_*` (build-baked, not runtime-read) + `*/1 * * * *` cron unmapped (burns invocations) + 6 orphan cron schedules + duplicate marker blocks in wrangler.toml | A misc | ~20 |

Effort key: each fix is small (≤30 LOC). Critical fixes are 1-2 LOC config changes.

---

## Concrete Refactor Proposals (R1-R5, total ~6h dev)

### R1 — Wire missing fulfillment crons (closes #1)

**File**: `wrangler.toml` (triggers/crons array).

**Add 2 schedules**:
```toml
[triggers]
crons = [
  # ... existing ...
  "*/2 * * * *",   # fulfillment-retry (defined in scripts/inject-scheduled-handler.mjs CRON_ROUTES)
  "0 6 * * *",     # fulfillment-reconcile
]
```

Cross-check `scripts/inject-scheduled-handler.mjs` CRON_ROUTES — every pattern there MUST exist in wrangler.toml. Also remove the orphan `*/1 * * * *` if no handler exists (or add handler).

Revenue impact: fulfillment-retry is the safety net for failed checkout post-processing — silently dead since deploy.

---

### R2 — Cache `/dashboard` onboarding check in KV (closes #2)

**File**: `src/middleware.ts` (line 132-153).

**Pattern**:
```ts
// Existing cookie fallback already present; add KV layer in between
const cacheKey = `onboard:${session.user.id.slice(0, 16)}`;
const cached = await env.EXPERIMENT_KV?.get(cacheKey);
if (cached === '1') {
  wizardDone = true;
} else {
  // existing D1 query
  if (wizardDone) {
    await env.EXPERIMENT_KV?.put(cacheKey, '1', { expirationTtl: 86400 });
  }
}
```

P90 latency win: ~80ms → ~5ms per dashboard request. Invalidate by deleting key on wizard-completion server action.

Per no-tech doctrine: EXPERIMENT_KV is an existing platform-bound namespace, not operator third-party. Compliant.

---

### R3 — Bind Telegram secrets + add startup probe (closes #3)

**Step 1** (operator action — one-time):
```bash
echo "<bot-token>" | npx wrangler secret put TELEGRAM_BOT_TOKEN
echo "<chat-id>"   | npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
```

**Step 2** — health endpoint guard:
File `src/app/api/health/route.ts` — add to full-probe response:
```ts
telegram: env.TELEGRAM_BOT_TOKEN ? 'configured' : 'missing_config',
```

**Doctrine reconciliation needed**: `sophia-no-tech-doctrine.md` says customer provides Telegram bot token via wizard. But `sophia-handover-rules.md` lists `@Sophia_Bbot` as operator-managed protected flow #2. Newer doctrine wins → migrate to customer-side OR document operator-exception. Surface for product call before applying R3 step 1.

---

### R4 — Fix `VIDEO_R2_BUCKET` binding mismatch (closes #6)

**File**: `src/forest/.../storage-tracker-cron.ts`

```diff
- const bucket = env.VIDEO_R2_BUCKET
+ const bucket = env.VIDEO_BUCKET
```

2 LOC. Tracker has been silently writing zeros to D1 storage stats since whenever this typo landed. Re-run tracker once after deploy to capture real baseline.

---

### R5 — Migrate `apply-migrations.sh` to canonical wrangler migrations (closes #5)

**File**: `scripts/apply-migrations.sh`

Current: uses `git diff HEAD~1 HEAD` to detect "new" migrations — no idempotency cursor. Re-running OR running with wrong base ref re-applies. With 117 migrations and growing this is a ticking bomb.

**Switch to**:
```bash
npx wrangler d1 migrations apply sophia-raas-db --remote
```

`wrangler d1 migrations` uses a managed `d1_migrations` table to track applied state. Idempotent by default. Requires migrations dir to follow wrangler's naming convention (`NNNN_name.sql`) — Sophia already does.

**Migration step** (one-time):
1. Audit current applied state vs `migrations/` content via `wrangler d1 migrations list sophia-raas-db --remote`
2. If wrangler's internal cursor is empty (legacy git-diff flow never populated it), mark all current migrations as applied via direct INSERT into `d1_migrations`
3. Update `scripts/apply-migrations.sh` + `package.json` `deploy:migrations` script
4. Document in deploy-verify rule

Risk: medium. Worth a planning doc + dry-run before flipping.

---

## Cleanup Bundle (LOW priority, can batch as single PR)

- Remove 7 dead `POLAR_*` prod secrets (`wrangler secret delete POLAR_*`)
- Remove 4 redundant `NEXT_PUBLIC_*` secrets (these are build-baked; secret storage is wasted)
- Add the missing handler OR remove the `*/1 * * * *` cron from wrangler.toml
- Clean up duplicate `=== P3-CRONS/KV-BEGIN/END ===` marker blocks in wrangler.toml
- Document the 6 orphan cron schedules (or wire them up)

Total cleanup: ~20 LOC + N secret-delete commands. Defer to next iteration unless quick batch fits Phase 05.

---

## What's Excellent (keep as-is)

- CF-direct deploy doctrine + `deploy-with-sha.sh` retry helper (CF 502 incident hardened)
- CSRF double-submit cookie with timing-safe verify + SameSite=Strict
- CSP per-request nonce via Web Crypto (no `unsafe-eval`, only Tailwind-required `style-src 'unsafe-inline'`)
- Rate limiting tiered (api/auth/webhook/discovery)
- D1 prepared statements parameterized throughout — zero raw SQL injection surface
- R2 access always via Worker proxy — no public buckets
- Structured JSON logger with `withRequestId` for trace correlation
- tagCache D1 binding wired (`NEXT_TAG_CACHE_D1` = `sophia-tag-cache`)
- Image rendering binding + Assets binding present
- MFA challenge enforcement in middleware (line 119-130)
- Admin basic-auth on `/admin/*` (legacy route guard, separate from `/dashboard/admin/*`)
- Bundle size reasonable (5 KB entry + 2.7 MB middleware/handler — OpenNext baseline, not product bloat)

---

## Phase 05 effort estimate (R1-R5)

| Refactor | Effort | Risk | Operator action? |
|---|---:|---|---|
| R1 wire fulfillment crons | 1h | low | no |
| R2 KV cache `/dashboard` onboard | 2h | low | no |
| R3 Telegram secrets + probe | 1h | medium (doctrine call) | YES (secret put) |
| R4 R2 binding rename | 30m | none | no |
| R5 migrations cursor flip | 2h + dry-run | high | maybe (one-time INSERT) |
| Cleanup bundle | 1h | none | YES (secret delete) |
| **Total** | **~7-8h** | | |

Solo: ~1 day. Parallel (R1+R2+R4 // R5 // R3+cleanup): half day.

---

## Doctrine considerations

1. **Telegram operator token** (R3) — conflicts with no-tech doctrine. Needs product call. Options:
   - (a) Keep as documented operator-side exception (handover wizard already implies platform-default OR customer-provides)
   - (b) Migrate Telegram alerts to customer-provided keys only (remove operator alert cron paths)
   - (c) Disable the cron handlers until decision lands

2. **Sentry symbolication** (R-not-listed) — already documented as "optional" per doctrine. Symbol upload step warns + skips on missing token. Acceptable per current doctrine.

3. **Migrations management** (R5) — switching to `wrangler d1 migrations` doesn't require operator credentials; uses existing wrangler authentication. Compliant.

---

## Unresolved

1. R3 Telegram doctrine resolution — operator-managed exception OR customer-side migration?
2. R5 dry-run plan — how to validate `d1_migrations` cursor seeding without risking double-apply?
3. R2 cache invalidation — guarantee that wizard-completion server action calls `KV.delete(onboard:<uid>)`?
4. R1 — confirm both fulfillment handlers exist in inject-scheduled-handler.mjs CRON_ROUTES (already noted but should re-verify on PR)
5. Should `npm run deploy` be aliased to `deploy:full` OR removed entirely? (Track A§4 flagged as smell)

---

## References

- Track A — Config + Bindings: `./track-a-config-bindings.md`
- Track B — Runtime + Security: `./track-b-runtime-security.md`
- ui-ux Phase 04 sibling synthesis: `../ui-ux-audit/synthesis.md`
- Sophia deploy verify rule: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- No-tech doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`
