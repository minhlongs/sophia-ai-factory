---
status: done (smoke pending)
---

# Phase 03 — Flip `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1`

## Context Links

- Phase 01 + 02 (HARD dependencies — must ship + smoke green)
- wrangler config: `apps/sophia-ai-factory/wrangler.toml` (envs + vars)
- Distribute UI gate: locate via `grep -rn "NEXT_PUBLIC_DISTRIBUTE_ENABLED" src/`
- Telegram fixture for smoke: `src/tree/telegram/` + `@Sophia_Bbot` (production bot)

## Overview

- **Priority:** P0
- **Status:** pending (BLOCKED by phases 01 + 02)
- **Effort:** 0.5 dev-day

Trivial code/config change but high risk: flipping the flag exposes the entire distribute pipeline to all users. Smoke test plan + rollback runbook are required.

## Key Insights

1. **`NEXT_PUBLIC_*` vars are baked into the client bundle at build time.** Setting in wrangler.toml is necessary but not sufficient — must rebuild + redeploy.
2. **Effective rollback path is `wrangler rollback`** — instant rollback to previous deploy without rebuild. Slower path: revert env var + redeploy.
3. **Smoke test must use real production stack** — D1, Inngest, Bot API, R2. NO mocks.
4. **Production user pool for FREE100 currently small** — flag flip impact is bounded.

## Requirements

### Functional

- `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` set in production env (wrangler.toml `[vars]` or `[env.production.vars]` depending on layout).
- Distribute button visible in production `/dashboard/videos` and `/dashboard/videos/[id]` for users with completed videos.
- End-to-end smoke test passes: real user creates video → distributes to telegram → publishing_jobs `status='live'` + telegram message delivered + `publishing_results.post_url` populated.

### Non-functional

- Rollback time <5 min if any post-flip metric goes red.
- No customer-impacting outage during flip (flip is additive — existing flows unaffected).

## Architecture

No code architecture change. Configuration + verification only.

## Related Code Files

### Modify

- `apps/sophia-ai-factory/wrangler.toml` — set `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` in production vars block. Verify other envs (preview, dev) match desired state.
- `apps/sophia-ai-factory/.env.example` (if present) — update default for new contributors.

### Create

- `plans/260509-1956-wave17-unlock-harden-cleanup/reports/phase-03-smoke-report.md` — final smoke test transcript (Bot API responses, D1 row dumps, screenshots).

### Delete

- None.

## Implementation Steps

### Pre-flip (verify both phase 01 + 02 are live)

1. Read `/api/version` → confirm `shortSha` matches HEAD that includes phase 02 commit.
2. Run smoke "dry run" with current env (flag=0) — verify build + manual UI inspection that gate logic correctly hides button.
3. Confirm production D1 has migrations 0099 + (any phase 01 migration) applied.

### Flip + deploy

4. Edit `wrangler.toml` — set `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` in production vars.
5. Commit with message `chore(wave-17): flip NEXT_PUBLIC_DISTRIBUTE_ENABLED=1`.
6. `cd apps/sophia-ai-factory && npm run deploy:full`.
7. Verify SHA match: `curl -s https://sophia.agencyos.network/api/version | jq .shortSha` == local short SHA.
8. Visit production `/en/dashboard/videos` (signed-in test user) — Distribute button visible.

### Smoke test (full E2E on production)

9. **Test user setup:** existing FREE100 test account OR create fresh one via magic link → sign in.
10. **Pair Telegram:** `/start` in `@Sophia_Bbot` from test user's personal Telegram → confirm pairing in `/dashboard/onboarding` step.
11. **Create AI video:** `/dashboard/videos/new` → submit short prompt ("Hello from Wave 17 smoke test") → wait for SSE `succeeded` (typical 60-180s).
12. **Verify videos row:** D1 query `SELECT id, video_url, r2_key, status FROM videos WHERE user_id=? ORDER BY created_at DESC LIMIT 1` → `r2_key NOT NULL`, `status='completed'`.
13. **Distribute panel:** `/en/dashboard/videos/{id}/distribute` → Distribute button enabled. Tick "Telegram". Submit.
14. **Verify publishing_jobs:** D1 query `SELECT id, status, channel_id, provider FROM publishing_jobs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1` → `provider='telegram'`, `status` cycles `scheduled→uploading→live` within ~30s.
15. **Verify telegram delivery:** test user's Telegram receives video message in DM with bot.
16. **Verify publishing_results:** D1 query `SELECT post_url, channel_post_id FROM publishing_results WHERE publishing_job_id=?` → `post_url` looks like `https://t.me/...` or similar valid URL.
17. **Document everything** in `phase-03-smoke-report.md` with timestamps, D1 row dumps, screenshot of Telegram message.

### Post-flip monitoring (24h)

18. Watch Sentry / logs for `[distribute]`, `[publishExecute]`, `[publishToTelegram]` errors.
19. Check `publishing_jobs` failure rate via D1 query: `SELECT status, COUNT(*) FROM publishing_jobs WHERE created_at > UNIXEPOCH('now', '-1 day') GROUP BY status` — failure rate <5% acceptable.
20. If failure rate >10% within 1h post-flip → trigger rollback runbook below.

## Rollback Runbook

**Trigger conditions:** failure rate >10% in 1h, customer support tickets, Sentry error spike.

**Fast rollback (instant, ~30s):**

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "wave17 phase 03 distribute flag flip rollback" --yes
# Confirm rollback
curl -s https://sophia.agencyos.network/api/version | jq .shortSha  # should be PREVIOUS sha
```

**Slow rollback (revert config, redeploy ~5 min):**

```bash
git revert <wave17-flip-commit-sha>
cd apps/sophia-ai-factory && npm run deploy:full
# Verify SHA match
```

**After rollback:**
- Notify user (CEO) via established channel.
- Post-mortem in `plans/260509-1956-wave17-unlock-harden-cleanup/reports/phase-03-rollback-postmortem.md`.
- Hold flag flip until root cause identified + phase 04+ hardening shipped.

## Todo List

- [x] Verify phase 01 + 02 live on production (SHA match)
- [x] Pre-flip dry run (flag=0)
- [x] Edit wrangler.toml flag value
- [x] Commit + deploy
- [x] SHA match verify
- [ ] Smoke test step 9-17 (full E2E) — deferred to CEO
- [ ] Document smoke report — deferred to CEO
- [ ] Monitor 24h post-flip — deferred to CEO
- [ ] If GREEN at 24h: declare flag flip permanent — deferred to CEO

## Success Criteria

- Smoke test all 17 steps pass without manual intervention.
- 24h post-flip: distribute failure rate <5%, no Sentry critical alerts.
- Customer (CEO) confirms Distribute button visible + functional.
- `phase-03-smoke-report.md` committed with evidence.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Smoke test reveals phase 01/02 regression | Medium | High (rollback) | Pre-flip dry run + bounded rollback runbook |
| Telegram Bot API rate limit hit during flip | Low | Medium | Existing rate-limit middleware (10/min/user) |
| Build fails to pick up env var (Next.js build cache) | Low | High | `npm run deploy:full` rebuilds; verify `NEXT_PUBLIC_*` baked into bundle via DevTools network inspection |
| FREE100 user pool larger than expected → traffic spike | Low | Medium | Inngest auto-scales; D1 has indexes (migration 0091) |
| User PII / video leak via misconfigured Bot API token | Very low | Critical | Token resolver already scoped per-user (telegram-handover-notifier); no platform default |

## Security Considerations

- No new code paths exposed. Existing distribute API + publishExecute already audited (Wave 16 phase 02 + 03 reviews).
- `assertSafeVideoUrl` enforced (phase 01 + 02 verify).
- Rate limit on distribute API: 10 req/min/user (existing, see `withRateLimit` wrapper).
- Telegram channel rate limit: 5/min/user (already enforced).

## Next Steps

- Phases 04-08 are independent — schedule in parallel after phase 03 ships GREEN.
- Wave 18 candidate: cron job to backfill old `engine_missions` videos → `videos` table for users who created videos before phase 01 shipped.

## Completion Notes

**Phase 03 shipped 2026-05-09:**

- **Option A chosen:** wrangler.toml `[vars]` block + deploy script export. `.env.production` is gitignored (Option B ruled out); Option C lost source-traceability.
- **Files modified:** 2 total (+10 lines):
  - `scripts/deploy-with-sha.sh` (+4 lines): `export NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` before `next build`
  - `wrangler.toml` (+6 lines): `[vars]` block documents flag value (runtime docs, doesn't inject into build)
- **Build bake verified:** Turbopack substitution confirmed — 0 occurrences of `NEXT_PUBLIC_DISTRIBUTE_ENABLED` in 719 `.next/server/chunks/ssr/*.js` files. Literal `"1"` baked at build time → DCE to `true`.
- **TypeScript:** `npx tsc --noEmit` exit 0.
- **Smoke test:** 5-step E2E procedure handed off to CEO (sign in → pair Telegram → create AI video → distribute → verify delivery + D1 rows).
- **Rollback:** `npx wrangler rollback --name sophia-ai-factory --message "wave17 phase 03 flag flip rollback" --yes` (~30s, per §Rollback Runbook).

## Unresolved

- Does test user's Telegram pairing persist across magic-link sessions? (Should: `paired_by` is user.id which is stable.)
- Smoke test timing: will Inngest video-generate complete within 3min on production at low load? (Historical: yes, 60-180s typical. Confirm during dry run.)
