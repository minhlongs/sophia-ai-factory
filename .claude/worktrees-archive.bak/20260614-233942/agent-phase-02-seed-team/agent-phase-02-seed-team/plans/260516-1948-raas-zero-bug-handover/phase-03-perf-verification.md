---
title: "Phase 03 — Perf Verification (Group C)"
description: "Measure quasi-verifiable performance + math claims: TTFB, mission latency, crypto-at-rest, ROI formula, pricing config."
status: completed
priority: P0
effort: "~1h"
dependencies: [phase-01-copy-honest-pivot]
created: 2026-05-16
completed: 2026-05-16
output: plans/reports/audit-260516-promise-wiring-matrix.md (Group C section)
---

# Phase 03 — Perf Verification (Group C)

## Context Links

- Brainstorm: `plans/reports/brainstorm-260516-1948-video-gen-zero-bug-handover-promise-audit.md` §2 Group C, §4 Phase 03
- Doctrine: `apps/sophia-ai-factory/CLAUDE.md`, `.claude/rules/sophia-handover-rules.md`
- Output (append to same matrix as Phase 02): `plans/reports/audit-260516-promise-wiring-matrix.md`
- Production URL: `https://sophia.agencyos.network`

## Overview

- **Priority:** P0 — quasi-verifiable claims drive credibility; wrong math = legal exposure
- **Status:** pending
- **Description:** Measure 5 performance + math promises: P2 TTFB, P7 mission latency, P21 crypto-at-rest spec, P24 ROI formula, P28 pricing config alignment. Output appends to Phase 02's matrix.

## Key Insights

- P2 `<50ms Response` is almost certainly false on real cold edge — likely needs copy downgrade
- P24 ROI formula `$2 CPM + affiliate` must match calculator code; mismatch = misleading marketing
- P28 pricing in `messages/*.json` MUST equal `config/tiers.ts` — drift = checkout vs landing inconsistency
- P21 256-bit Encrypted — verify both TLS in transit AND BYOK at-rest crypto (Web Crypto AES-GCM or libsodium)
- Phase 03 can run in parallel with Phase 02 (different code areas, no shared edits)

## Requirements

### Functional

- P2: Measure TTFB from 3 geographies (or curl multiple times) — report median ms
- P7: Find mission queue latency benchmark or instrument code path
- P21: Document encryption-at-rest spec — algorithm, key derivation, key storage
- P24: Verify ROI calculator math matches `$2 CPM + affiliate` formula in homepage copy
- P28: Pricing values in `messages/en.json` + `vi.json` must match `config/tiers.ts` exact numbers (Starter/Growth/Premium/Master)

### Non-Functional

- No source modifications this phase (audit only)
- Append-only writes to matrix
- Production curls only (no Polar/NOWPayments / paid API calls)

## Architecture

```
P2 TTFB:     curl -w "%{time_starttransfer}" https://sophia.agencyos.network → median
P7 Mission:  grep mission queue → read instrumentation or estimate from step timings
P21 Crypto:  read encryption module + key storage code → document spec
P24 ROI:     read calculator code → compare formula vs homepage copy
P28 Pricing: diff messages/*.json tier strings vs config/tiers.ts numbers
```

## Related Code Files

### Read

- `apps/sophia-ai-factory/src/lib/crypto/**` (or wherever BYOK encryption lives)
- `apps/sophia-ai-factory/src/lib/missions/**` (queue + handlers)
- `apps/sophia-ai-factory/src/components/roi-calculator*.tsx` (or `src/app/.../page.tsx` with calculator)
- `apps/sophia-ai-factory/src/config/tiers.ts`
- `apps/sophia-ai-factory/messages/en.json`, `messages/vi.json`

### Write

- `plans/reports/audit-260516-promise-wiring-matrix.md` — append Group C rows

### Create / Delete

- None.

## Implementation Steps

1. **P2 TTFB:** run `curl -sI -w "%{time_starttransfer}\n" -o /dev/null https://sophia.agencyos.network` x10. Compute median. Record verdict (<50ms = PASS, else downgrade copy).
2. **P7 Mission Latency:** locate mission queue file. Read step latencies from code (e.g., script gen ~5s, voice ~10s, render ~15s, publish ~3s). Sum + queue overhead. Verdict vs `<60s` claim.
3. **P21 Crypto-at-rest:** read encryption module. Document algorithm (AES-256-GCM expected), key source (per-user derived?), key storage (D1 column with envelope encryption? CF Secret Store?). Verdict vs `256-bit Encrypted` claim.
4. **P24 ROI Formula:** locate ROI calculator. Verify formula `revenue = views × ($2 / 1000) + affiliate_commissions`. Run 1 sample input by hand vs UI output (if reachable in static analysis).
5. **P28 Pricing Match:** compare numbers — `messages/en.json` `pricing.tiers.*.price` vs `config/tiers.ts` `PRICE_USD` (or equivalent). All 4 tiers (Starter/Growth/Premium/Master) must match. Also verify `compare_price: $9,588` vs `$799/mo × 12` math.
6. Append all 5 rows to matrix with same column format as Phase 02.
7. Update matrix summary block with Group C verdicts.
8. Commit: `docs(audit): perf + math verification for Group C promises`

## Todo List

- [ ] P2 TTFB curl x10 + median
- [ ] P7 Mission latency sum from code
- [ ] P21 Crypto-at-rest spec documented
- [ ] P24 ROI formula verified
- [ ] P28 Pricing config match (4 tiers + compare_price math)
- [ ] Append 5 rows to matrix
- [ ] Update summary block
- [ ] Commit matrix

## Success Criteria

- All 5 Group C rows in matrix with measured/computed values + verdict
- Pricing drift detected (or confirmed zero) — list any mismatches
- Crypto spec written in plain English (algorithm, key origin, storage layer)
- If P2 / P7 fail, NEEDS-COPY-FIX item created for Phase 06 to address before sign-off

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| TTFB varies wildly by location | Take median of 10 samples; note geographic limitation in matrix |
| Crypto spec exists in docs but not code | Trust code, not docs. Flag doc drift. |
| Pricing in messages drifts from config silently | Make this verification a recurring CI check (Phase 06 follow-up) |
| ROI calculator uses different formula in UI vs JSON copy | Single source of truth — calculator wins; copy must match it |

## Security Considerations

- P21 audit may surface weak crypto (e.g., no key rotation, weak KDF) — escalate to Phase 04 P0 fix if found
- Do NOT paste real encrypted samples or actual user_keys rows into matrix
- Confirm TLS termination at CF edge (not at origin) for `256-bit` in-transit claim
- Pricing mismatch is a payment-fraud risk (customer charged different amount than displayed)

## Next Steps

- Findings merge into Phase 02 matrix → drive Phase 04 fix scope
- P2/P7 fails route to Phase 06 copy adjustments (downgrade wording) rather than Phase 04 code fixes (avoid over-engineering)
- Crypto findings feed handover doc security section
