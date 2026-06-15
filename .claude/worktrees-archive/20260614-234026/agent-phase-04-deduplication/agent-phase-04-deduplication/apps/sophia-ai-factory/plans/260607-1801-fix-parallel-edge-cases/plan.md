# Fix Plan — 40 Edge Cases (11 Unhandled + 29 Partial)

## Overview

| Wave | Agent | Scope | File Ownership | Parallel? |
|------|-------|-------|----------------|-----------|
| A1 | fullstack-dev | JWT nonce TOCTOU + templates auth bypass | `seed/auth/jwt-nonce-*`, `tree/templates.ts` | Yes |
| A2 | fullstack-dev | 16 Server Actions org validation + changeTierAction .single | `app/actions/*` | Yes |
| B | fullstack-dev | DLQ consumer + overflow fix + paying rows stuck + classifier | `land/billing/nowpayments-ipn-*`, `land/payouts/commission-ledger-mutations.ts` | Yes |
| C | fullstack-dev | Gateway instrumentation bypass detection | `forest/usage-metering/gateway-instrumentation*.ts` | Yes |
| D | fullstack-dev | Fanout dedup + failure state + zombie cancel + selective retry | `forest/inngest/functions/batch-video-fanout.ts`, `land/campaigns/batch-jobs-repo.ts` | Yes |

## Phase Dependencies

```
[A1] → [A2] → [TEST ALL] → [B || C || D] → [FINAL TEST] → [SHIP]
                  sequential          parallel
```

A1 and A2 share `app/actions/*` indirectly — A2 reads auth context from A1's files.
A2 must complete before B/C/D start (auth fixes may affect Server Action security gates).

## Acceptance Criteria

- All 11 unhandled edge cases → handled
- All 29 partial → improved to handled or documented-acceptable
- `npm run build` exits 0
- `npm test` passes
- No new `:any` types
- No `console.log` added

## Report

Save to: `plans/reports/from-fixer-to-reviewer-260607-1801-edge-cases-fix.md`
