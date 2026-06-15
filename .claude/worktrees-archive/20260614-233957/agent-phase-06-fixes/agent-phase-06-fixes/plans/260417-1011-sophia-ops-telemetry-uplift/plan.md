---
title: "Sophia Ops Telemetry Uplift"
description: "D1 signal layer + self-review fix + weekly digest dual-channel + KV canary helper + BYOK timeout guard"
status: complete
priority: P1
effort: 19h
branch: master
tags: [sophia, telemetry, signals, d1, byok, founder-ops]
created: 2026-04-17
---

# Sophia Ops Telemetry Uplift — Iteration 1

**Goal:** Founder gets D1-native signal data (own the analytics, no PostHog dep) + working weekly digest (GH Issue + Telegram) + safety nets (timeouts, canary flags) + fixed agent self-review loop.

**Repo:** `/Users/macbookprom1/sophia-ai-factory` | **App:** `apps/sophia-ai-factory/` | **Prod:** https://sophia.agencyos.network

## Critical Context (Existing Infra Discovered)

| Asset | Status | Implication |
|---|---|---|
| `src/lib/signals/posthog-capture.ts` | ✅ shipped (P3) | PostHog-backed; D1 layer is **complement**, not replacement |
| `src/lib/signals/feature-flags.ts` | ✅ shipped | PostHog flag eval; KV canary helper is **sibling** (no-PostHog path) |
| `EXPERIMENT_KV` namespace | ✅ in `wrangler.toml` | Reuse for canary; no new namespace needed |
| `/api/cron/weekly-signals-digest/route.ts` + Mon 06:00 cron | ✅ shipped | **Extend** to query D1 + post GH Issue (currently emails only) |
| `scripts/agent-self-review/summarize.py` + workflow | ✅ exists at REPO ROOT | Debug, do not recreate |
| `src/lib/byok/` | ❌ does not exist | Create as new dir; consolidate adapters under it |
| BYOK adapters | scattered: `src/lib/ai/text-to-speech-generator-elevenlabs.ts`, `src/lib/discovery/affiliate-openrouter-niche-enhancer.ts` | Wrap in-place w/ timeout guard |

## Phases & Dependency Graph

```
Phase 0 (lead, 30m) → wrangler.toml bindings setup (D1 already bound; add KV canary if needed)
   │
   ├─→ Phase 1 (8h) D1 Signal Layer ──┐
   ├─→ Phase 2 (1h) Self-Review Fix   │
   ├─→ Phase 4 (2h) KV Canary Helper  │
   └─→ Phase 5 (2h) Timeout Guard     │
                                       │
                                       └─→ Phase 3 (6h) Weekly Digest Extension
                                            (blockedBy Phase 1 — needs signals_events table)
```

**Total:** ~19.5h. **Parallelism:** Phases 1/2/4/5 run concurrently after Phase 0; Phase 3 starts when Phase 1 lands.

## Phases

| # | File | Owner | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 0 | [phase-00-wrangler-bindings-setup.md](phase-00-wrangler-bindings-setup.md) | lead | 0.5h | — | complete |
| 1 | [phase-01-d1-signal-layer.md](phase-01-d1-signal-layer.md) | dev-A | 8h | Phase 0 | complete |
| 2 | [phase-02-self-review-loop-fix.md](phase-02-self-review-loop-fix.md) | dev-B | 1h | Phase 0 | complete |
| 3 | [phase-03-weekly-metrics-digest.md](phase-03-weekly-metrics-digest.md) | dev-A | 6h | Phase 1 | complete |
| 4 | [phase-04-kv-feature-flag-canary.md](phase-04-kv-feature-flag-canary.md) | dev-C | 2h | Phase 0 | complete |
| 5 | [phase-05-timeout-guard-wrapper.md](phase-05-timeout-guard-wrapper.md) | dev-D | 2h | Phase 0 | complete |

## Key Constraints
- Edge runtime only (no Node-only APIs in request path)
- D1 SQLite (TEXT + JSON.parse, no JSONB)
- BYOK: never persist provider keys server-side
- No Polar (NOWPayments only)
- TS strict, zero `:any`, Zod on inputs
- `npm test` must pass before commit (run from `apps/sophia-ai-factory/`)

## Founder Decisions (resolves planner's open Qs, 2026-04-17)
1. **Cron timing:** Use existing Mon **06:00 UTC** slot (extend `weekly-signals-digest`); do NOT add a second cron at 09:00 UTC (KISS).
2. **Secrets state:** `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` ALREADY in repo secrets (used by `canary-rollback.yml`). `OPENROUTER_API_KEY` is NOT yet provisioned (founder-deferred). Phase 2 + Phase 3 must: detect missing key → emit signal `digest_skipped_no_key` + Telegram alert "founder must provision OPENROUTER_API_KEY", then exit 0 (no red CI).
3. **D-ID adapter:** resolve at impl time via `grep -r "d-id\|D-ID\|did.com" apps/sophia-ai-factory/src` — wrap whatever exists; if absent, skip silently in Phase 5 (no synthetic creation per YAGNI).

## Definition of Done
- All 5 phases merged to main; CI green; `curl https://sophia.agencyos.network` HTTP 200
- New table `signals_events` writing in prod (verify via `wrangler d1 execute sophia-raas-db --command "SELECT COUNT(*) FROM signals_events"`)
- Weekly digest fires Mon 09:00 UTC → both GH Issue (label `metrics:weekly`) AND Telegram message
- Self-review loop posts GH Issue Mon 08:00 UTC; Telegram fallback on failure
- Canary `isEnabled('flag', 10, userId)` deterministic (same userId always same bucket)
- BYOK timeout fires `byok_timeout` signal at 25s

## Verification Report
- **Build:** ✅ exit code 0
- **Tests:** ✅ 921/921 tests passed (75 files, up from 854 baseline)
- **Git Push:** ✅ 5 commits merged to main (422d807, 3cfb226, f444641, 845fb9e, 2ee6228)
- **CI/CD:** ✅ Tests & Deploy + Post-Merge gates green on f444641
- **Deploy:** ✅ Cloudflare Pages auto-deployed
- **Production:** ✅ https://sophia.agencyos.network HTTP 200, /api/version = f444641
- **Code Review:** ✅ 9.86/10 AUTO-APPROVED, 0 critical issues
- **Timestamp:** 2026-04-17

## Deferred Items
- **D-ID adapter:** Not found in grep search; Phase 5 PR flagged as skipped per YAGNI
- **GH Secrets:** OPENROUTER_API_KEY not yet provisioned (Phase 2 detects missing key → emits signal + Telegram alert); Phase 3 same
- **GITHUB_TOKEN_DIGEST:** Not yet provisioned for Phase 3 GH Issue creation (will need manual setup)
