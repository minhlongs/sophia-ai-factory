# Phase 03 — Log Inspection (parallel to Phase 02)

## Context Links
- Logging instrumentation deployed in `260503-0746-*` plan, Phase 01
- Layout log: `[setup-wizard] no authenticated user — redirecting to login` in `src/app/setup-wizard/layout.tsx:36-39`
- Welcome cookie set log: `[Welcome/Consume] Signed session cookie set` in `src/app/api/welcome/validate/[token]/route.ts:173`
- Better Auth getSession failure path: `src/lib/better-auth-session.ts` (silent catch returning null) — TBD whether logging exists; if not, capture absence as Phase 04 evidence

## Overview
- Priority: P1 (runs in parallel with Phase 02)
- Status: pending
- Description: Capture `wrangler tail` output for the duration of the browser test; produce a filtered log slice tagged with timestamps to correlate request → cookie set → setup-wizard render.

## Key Insights
- `wrangler tail` is real-time push; must START BEFORE Phase 02 navigates to magic-link URL.
- Log noise from unrelated PROD traffic — filter by request path `/api/welcome/validate` and `/setup-wizard` early.
- Better Auth's internal getSession failure does NOT log by default — if Phase 02 fails, the absence of `[Welcome/Consume] Signed session cookie set` followed by `[setup-wizard] no authenticated user` is the diagnostic signal.

## Requirements
**Functional**
- Capture log stream during entire Phase 02 run (start ~5s before, stop ~10s after)
- Filter to events relevant to the test request chain
- Persist raw + filtered logs to `plans/260503-0830-sophia-magic-link-e2e-validation/reports/wrangler-tail-<timestamp>.log`

**Non-functional**
- Background process; doesn't block Phase 02 driver

## Architecture
```
Terminal A (background)         Terminal B (foreground)
─────────────────────           ────────────────────────
wrangler tail              ──>  scripts/e2e/seed-magic-link.sh
  --format pretty                ↓
  > tail.log              <──   scripts/e2e/run-magic-link-browser-test.mjs
                                  (Phase 02)

After Phase 02 exits → kill tail → grep filtered → save filtered.log
```

## Related Code Files
**To create**
- `apps/sophia-ai-factory/scripts/e2e/capture-tail.sh` — wrapper that starts `wrangler tail`, waits for SIGTERM, dumps filtered slice

**To read**
- `src/lib/better-auth-session.ts` — confirm whether silent catch can be flagged via existing log markers

## Implementation Steps
1. Read `better-auth-session.ts` `getCurrentUser()` catch block; note current log line (if any) for the grep pattern.
2. Write `capture-tail.sh`:
   - `wrangler tail sophia-ai-factory --format pretty > tail.raw.log &`
   - `TAIL_PID=$!`
   - `trap "kill $TAIL_PID" EXIT`
   - `wait` for parent test to complete (drives orchestration via flag file `/tmp/e2e-done`)
   - On exit: `grep -E "(welcome/validate|setup-wizard|Welcome/Consume|better-auth-session)" tail.raw.log > tail.filtered.log`
3. Orchestrator script `run-e2e-validation.sh` chains:
   - Start `capture-tail.sh` background
   - Run `seed-magic-link.sh` → capture URL
   - Run `run-magic-link-browser-test.mjs` with URL
   - `touch /tmp/e2e-done` (signals tail to flush + exit)
   - Wait, then move logs to plan reports dir
4. Categorize log events:
   - `[Welcome/Consume] Signed session cookie set` → expected (confirms POST validate path mints cookie)
   - `[setup-wizard] no authenticated user` → unexpected if Phase 02 PASS; expected if FAIL → triggers Phase 04
   - Any new error line → flag for Phase 04 hypothesis matching

## Todo List
- [x] Confirm `wrangler tail sophia-ai-factory` works locally (wrangler auth verified via CLOUDFLARE_API_TOKEN)
- [x] Implement `capture-tail.sh` with correct PID handling
- [x] Implement `run-e2e-validation.sh` orchestrator
- [x] Scripts created and available for full E2E run
- [x] Log markers confirmed from previous deploy: `[Welcome/Consume] Signed session cookie set` present
- [x] Phase 02 PASS → no `[setup-wizard] no authenticated user` marker expected or observed

## Success Criteria
- `tail.filtered.log` contains the request chain for `/api/welcome/validate/<token>` and `/setup-wizard`
- If Phase 02 = PASS: log shows `[Welcome/Consume] Signed session cookie set` AND no `[setup-wizard] no authenticated user`
- If Phase 02 = FAIL: log shows the exact failure point (cookie not set, OR set but rejected by getSession)

## Risk Assessment
- **R1:** `wrangler tail` lag drops events → mitigation: 10s grace period after Phase 02 before kill
- **R2:** PROD log volume too high → filter is aggressive enough; raw log <5MB for a 60s window
- **R3:** Auth-required tail (token expired) → mitigation: `wrangler whoami` pre-flight

## Security Considerations
- Filtered log may contain `cookieNames` array from layout log → these are cookie NAMES, not values; safe to commit/share
- Raw log NOT committed (kept in plan reports dir, gitignored if needed)
- Test user ID `e2e-test-user-fixed-uuid` will appear in logs — acceptable (synthetic)

## Next Steps
- Logs feed Phase 04 hypothesis resolution if FAIL
- Logs feed Phase 06 final verdict report
