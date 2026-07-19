---
phase: 05
title: "Audit Inngest functions with retries: 0 — convert benign errors to RetryAfterError"
priority: P2/MED/RELIAB
status: complete
effort_estimate: 1h
effort_actual: ~25m
completed: 2026-05-10
outcome: Option A — keep retries:0 with corrected inline comment; W23 fix queued
report: reports/inngest-retry-audit-2026-05-10.md
dependencies: []
---

# Phase 05 — Inngest Retry Audit

## Context Links

- W20 review finding #3: `plans/260510-0115-wave21-hardening-and-docs/reports/code-reviewer-wave20-2026-05-10.md` lines 39–43
- Primary suspect: `src/forest/inngest/functions/publish-execute.ts:193` (`retries: 0`)
- Telegram step: `publish-execute.ts:374-380` (uses `RetryAfterError` from helper)
- W21 P04 smoke noted: `plans/260510-0115-wave21-hardening-and-docs/reports/smoke-260510-0128-wave21-phase04.md`

## Goal

Audit all Inngest functions with `retries: 0` to verify Inngest correctly honors `RetryAfterError` (which has separate retry semantics) despite the 0-retry config. Where ambiguous or broken, replace with explicit step-level retry config or pre-throw `step.sleep()` workaround.

## Key Insights

1. **Open question from W20 review:** "Inngest `RetryAfterError` vs `retries: 0`" — undocumented behavior. Need to confirm via either:
   - Live test on staging (controlled 429 trigger)
   - Inngest docs / source review
   - Conservative rewrite (explicit retry semantics)
2. **Function-level `retries: 0`** was set originally for idempotency safety (publish-execute already handles its own CAS lock). But `RetryAfterError` is a special-case Inngest signal for rate-limit honoring; muddied semantics are risky.
3. **`generate-campaign.ts`** uses `NonRetriableError` properly (terminal failures). Different concern; not in scope.

## Architecture

```
Audit pass:
1. grep all `retries: 0` in src/forest/inngest/
2. for each function:
   a. List all step.run() error paths
   b. Classify: BENIGN (rate-limit, retriable) vs TERMINAL (logic error)
   c. If BENIGN currently throws → audit if RetryAfterError is honored
3. Decision tree:
   - If Inngest honors RetryAfterError despite retries:0 → document, no change
   - If NOT → either:
     a. Set function-level retries (e.g., 3) and use NonRetriableError for terminal
     b. Pre-sleep workaround: `await step.sleep('rate-limit-wait', ${retryAfterSec}s); throw plainError;`
```

## Files to Create

| File | Purpose |
|---|---|
| `plans/260510-0152-wave22-security-and-reliability/reports/inngest-retry-audit-2026-05-10.md` | Audit findings + decision per function |

## Files to Modify

Depends on audit outcome. Likely:

| File | Possible Change |
|---|---|
| `src/forest/inngest/functions/publish-execute.ts` | Either keep `retries: 0` (if confirmed RetryAfterError honored) or change to `{retries: 3}` + add `NonRetriableError` for terminal cases. Add inline doc comment explaining choice. |
| `src/forest/inngest/functions/__tests__/publish-execute-retry.test.ts` (create) | Behavioral test: mock 429 → step.run throws RetryAfterError → assert retry-after delay was respected (via Inngest test runner if available, else integration on staging) |

## Implementation Steps

1. **Inventory** — Run `grep -rn "retries:" src/forest/inngest/functions/`. List each function + retry value.
2. **For each `retries: 0` function**, read source and document each `throw` site:
   - What error type?
   - Is rate-limit (e.g., 429) handling expected here?
3. **Authoritative answer source** (in priority order):
   a. Check Inngest docs: https://www.inngest.com/docs/features/inngest-functions/error-retries (specifically: does `RetryAfterError` override function-level retries?)
   b. If unclear, scan `node_modules/inngest/` for `RetryAfterError` handling (search for retries config interaction).
   c. If still unclear, propose conservative rewrite (option 3b above).
4. **Write audit report** to `reports/inngest-retry-audit-2026-05-10.md`:
   - Table: function | retries config | error types thrown | verdict (SAFE / NEEDS-FIX) | reasoning
5. **Implement fix** for any NEEDS-FIX functions:
   - Option A (preferred if docs confirm): keep `retries: 0`, add inline comment justifying.
   - Option B: change to `retries: 3`, replace any plain `throw err` (terminal logic) with `throw new NonRetriableError(...)`. Verify CAS replay-safety preserved.
6. **Run** `npm run build && npm test`.

## Migration

None.

## i18n Keys

None.

## Test Strategy

If Option B chosen (function retries enabled):

| Test | Type | Expected |
|---|---|---|
| Telegram 429 → RetryAfterError → retry happens | integration | retry executed after retryAfterSec |
| Telegram terminal 4xx → NonRetriableError → no retry | integration | function fails, no replay |
| publish-execute step idempotency under retry | integration | CAS lock prevents double-publish |

If Option A chosen (no code change), no new tests; just regression run.

Target: 0–3 new tests depending on outcome.

## Success Criteria

- [ ] Audit report committed to `reports/`
- [ ] Each `retries: 0` function has explicit decision (KEEP or CHANGE)
- [ ] If CHANGE: inline doc comment explains why
- [ ] All existing tests pass
- [ ] Deploy SHA match
- [ ] If Option B: smoke test on staging triggers a 429 → observe retry in Inngest dashboard

## Risk Assessment

- **R1: Changing `retries` breaks idempotency assumptions** — `publish-execute` was deliberately set to 0 because step.run handles its own claim/CAS. Re-introducing retries needs careful review of every step's idempotency. Worst case: double-publish.
- **R2: Inngest behavior undocumented** — If we can't confirm RetryAfterError semantics, the safest path is Option A (no change) + documented assumption + smoke-test on staging.
- **R3: `generate-campaign-refund-notify.ts` swallows errors** — already documented as intentional (caller throws NonRetriableError). Verify still correct under any change.

## Security Considerations

- Excessive retries on payment-adjacent webhooks could cause double-charge. Audit must call out any payment-webhook-triggered Inngest functions and confirm idempotency.

## Verification Steps

```bash
# Audit step
grep -rn "retries:" src/forest/inngest/functions/

# After any code change
cd apps/sophia-ai-factory
npm run build
npm test
npm run deploy:full
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ SHA match"

# If Option B: optional staging smoke
# Trigger a known-rate-limited Telegram chat → observe step retry in Inngest dashboard
```

## Next Steps

- Audit report informs Phase 06 (auto-finalize cron) implementation: same retry semantics apply.
- If Option B taken across multiple functions, consider extracting an `inngest-error-helper` util to seed/utils.
