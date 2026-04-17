# Phase F — Health Monitoring Cron + Customer Docs

**Status:** deferred (next iteration) | **Priority:** P2 | **Effort:** 1d | **Depends:** Phase D

> **DEFERRED — DO NOT IMPLEMENT THIS ITERATION.**

## Goal
Background cron pings each provisioned customer's tunnel; emits `local_mode_unhealthy` signal on failure. Bilingual customer runbook + section in main activation runbook.

## Architecture Sketch
```
Cron (CF Workers Cron Trigger, every 15min):
  1. SELECT id, local_mode_endpoint, local_mode_bearer_encrypted FROM users WHERE local_mode_endpoint IS NOT NULL
  2. For each user (batch w/ Promise.allSettled, max 50/batch):
     a. decryptSecret(bearer) [Phase C]
     b. POST {endpoint}/v1/messages w/ tiny ping {model, messages:[{role:'user',content:'.'}], max_tokens:1}
     c. If non-2xx OR timeout (5s) → track('local_mode_unhealthy', user_id, {endpoint_hash, status})
     d. If 2xx → track('local_mode_healthy', user_id, {latency_ms})
  3. If user has 3 consecutive unhealthy signals → flip `local_mode_endpoint` to NULL + emit `local_mode_disabled`

Customer doc (bilingual):
  - What is Local Mode? (1 paragraph)
  - Setup checklist (link to install)
  - Troubleshooting: "model won't download", "tunnel not connecting", "fallback to cloud"
  - When to disable
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/app/api/cron/local-mode-health/route.ts` (≤100 LOC)
- `apps/sophia-ai-factory/src/app/api/cron/local-mode-health/route.test.ts` (≥3 tests)
- `docs/sophia-local-mode-runbook.md` (bilingual VN+EN, ~200 lines)

### Modify
- `apps/sophia-ai-factory/wrangler.toml` — add cron trigger `*/15 * * * *`
- `docs/sophia-activation-runbook.md` — add "Local Mode" section pointing to runbook

## Effort Estimate
- Cron handler + tests: 0.5d
- Bilingual runbook: 0.5d

## Open Questions
- Auto-disable threshold: 3 consecutive failures? Or time-window-based (5 fails in 1hr)? (Lean: 3 consecutive — simpler.)
- Notify customer on auto-disable? (Lean: yes — email via Resend; defer to next phase if email infra needs work.)
