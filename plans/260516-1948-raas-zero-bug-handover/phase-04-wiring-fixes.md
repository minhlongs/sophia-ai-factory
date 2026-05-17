---
title: "Phase 04 — Wiring Fixes (P0/P1 NEEDS-BUILD)"
description: "Implement code fixes for NEEDS-BUILD items from Phase 02/03 matrix. Scope capped at P0/P1; P2 deferred to backlog."
status: pending
priority: P0
effort: "Variable (~2-6h depending on Phase 02/03 findings)"
dependencies: [phase-02-wiring-audit, phase-03-perf-verification]
created: 2026-05-16
---

# Phase 04 — Wiring Fixes (P0/P1 NEEDS-BUILD)

## Context Links

- Brainstorm: `plans/reports/brainstorm-260516-1948-video-gen-zero-bug-handover-promise-audit.md` §4 Phase 04
- Input matrix: `plans/reports/audit-260516-promise-wiring-matrix.md` (built in Phase 02/03)
- Doctrine: `apps/sophia-ai-factory/CLAUDE.md`, `.claude/rules/sophia-handover-rules.md`, `.claude/rules/development-rules.md`
- Phase 01 baseline: commit `4531f6d4`

## Overview

- **Priority:** P0 — gates Phase 06 sign-off
- **Status:** pending
- **Description:** Implement code fixes for each P0/P1 NEEDS-BUILD item in the audit matrix. Each fix gets its own commit. P2 items are documented in handover doc as known deferred backlog rather than built now.

## Key Insights

- Likely fix candidates (predicted from brainstorm, confirmed by Phase 02 output):
  - P30 tier gate enforcement (security boundary — high priority if missing)
  - P25 affiliate DB seed (SmartSuite 50%, Shopify 200%, others)
  - P17 24/7 publish cron (wrangler cron trigger + handler)
  - P15 voice clone BYOK wiring (if currently uses operator key)
  - P14 affiliate link injection in publish pipeline
  - P19 Premium tier integrations (PartnerStack, Impact.com — may end up deferred)
- Each fix must respect canonical import paths from `.claude/rules/development-rules.md` (no banned imports)
- Tests REQUIRED for each fix (no shipping unverified code)

## Requirements

### Functional

- Every P0/P1 NEEDS-BUILD item from matrix → 1 commit fixing it + 1 test commit (or combined if small)
- BYOK constraint preserved on every fix — no operator keys introduced
- Tier enum unchanged: BASIC | PREMIUM | ENTERPRISE | MASTER (uppercase only)
- Build (`npm run build`) passes after each fix
- Tests (`npm test`) pass after each fix

### Non-Functional

- No `:any` types introduced
- No `console.log` in production paths
- File size < 200 lines (modularize if exceeded)
- Conventional commit messages (no AI references)

## Architecture

```
For each NEEDS-BUILD row in matrix:
  1. Read matrix row → identify gap
  2. Decide: build vs copy-fix vs defer-P2
  3. If build:
     a. Locate target file(s)
     b. Implement minimal viable wiring
     c. Add/extend test
     d. Build + test locally
     e. Commit (one logical fix per commit)
  4. Update matrix row: NEEDS-BUILD → PASS + link to commit
```

## Related Code Files

### Modify (confirmed by Phase 02/03)

Likely candidates — exact list determined by Phase 02 matrix output:

- `apps/sophia-ai-factory/src/lib/tier-gate-middleware.ts` (or wherever tier enforcement lives)
- `apps/sophia-ai-factory/src/lib/missions/publish-pipeline.ts` (affiliate injection)
- `apps/sophia-ai-factory/wrangler.toml` (cron trigger for P17 24/7 publish)
- `apps/sophia-ai-factory/src/lib/integrations/elevenlabs-voice-clone.ts` (BYOK key path)
- `apps/sophia-ai-factory/src/lib/integrations/partnerstack.ts`, `impact-com.ts` (Premium integrations — may defer)

### Create (probable)

- `apps/sophia-ai-factory/migrations/00XX-seed-affiliate-programs.sql` (P25 seed)
- `apps/sophia-ai-factory/src/app/api/cron/publish-scheduler/route.ts` (P17 if missing)
- `apps/sophia-ai-factory/tests/tier-gate.test.ts` and per-fix tests

### Delete

- None expected. **Do not** create new "*-enhanced.ts" files — modify existing per dev rules.

## Implementation Steps

1. Read final Phase 02 + Phase 03 matrix. Extract all rows with verdict NEEDS-BUILD and priority P0 or P1. Defer P2 rows → write them to handover doc backlog section.
2. Order fixes by dependency + risk: security (tier gates) > data integrity (affiliate seed) > flow completeness (cron, publishing) > feature parity (voice clone) > Premium integrations.
3. For each fix in order:
   - 3.a. Spawn implementation: read target file, write change, keep < 200 lines per file
   - 3.b. Add or extend unit test (Vitest)
   - 3.c. Run `npm run build` from `apps/sophia-ai-factory/` — must exit 0
   - 3.d. Run `npm test` — must pass
   - 3.e. Commit with conventional message: `fix(scope): <description>` or `feat(scope): <description>`
   - 3.f. Update matrix row: change NEEDS-BUILD → PASS, append commit hash
4. After all P0/P1 fixes complete, run full build + test suite one more time.
5. Deploy via `npm run deploy:full` (CF-direct, NOT GitHub Actions).
6. Verify production: `curl -sI https://sophia.agencyos.network` returns 200 + `curl -s https://sophia.agencyos.network/api/version` returns matching SHA.
7. Commit final matrix snapshot: `docs(audit): close P0/P1 wiring gaps`

## Todo List

- [ ] Extract P0/P1 NEEDS-BUILD items from matrix
- [ ] Document P2 items in handover backlog
- [ ] Order fixes by security → data → flow → feature
- [ ] Implement + test + commit each fix
- [ ] `npm run build` passes (final)
- [ ] `npm test` passes (final)
- [ ] `npm run deploy:full` succeeds
- [ ] Production HTTP 200 verified
- [ ] Production `/api/version` SHA matches commit
- [ ] Matrix all NEEDS-BUILD rows → PASS (with commit links)
- [ ] Final matrix commit

## Success Criteria

- 0 P0/P1 NEEDS-BUILD rows remaining in matrix
- All P2 items explicitly listed in handover doc backlog with reason
- Build + test green
- Production deploy verified (HTTP 200 + SHA match)
- No new `:any` types, no `console.log`, no banned imports introduced

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Phase 04 scope explodes if matrix has >5 P0 items | Hard cap — escalate to user for budget decision before starting; flip excess to "downgrade copy" path |
| Fix introduces regression in existing protected flow (Setup Wizard, Telegram bot, payment) | Run full test suite after each commit; manual smoke of protected flows before deploy |
| Tier gate fix locks out existing customers unexpectedly | Audit tier values in D1 before deploy; deploy behind feature flag if changing enforcement strictness |
| Cron trigger deployed without handler → 500 errors every interval | Ship handler + cron in same commit; verify cron registers in `wrangler deploy` output |
| Affiliate seed migration drops existing rows | Use `INSERT OR IGNORE` (or equivalent) — never `DELETE FROM` in seed |

## Security Considerations

- Tier gate fixes are SECURITY-CRITICAL — wrong enforcement = privilege escalation. Add test for each tier boundary.
- All BYOK fixes must read keys from per-user encrypted storage. Never fall back to operator env var.
- New cron handlers must not log keys or PII
- Affiliate seed = public data, safe to commit
- NOWPayments / payment-touching fixes require extra review — escalate if found

## Next Steps

- Output (closed matrix) feeds Phase 05 (smoke test, if budget approved) and Phase 06 (handover doc)
- If user approves smoke test budget after Phase 04 → proceed Phase 05
- Otherwise → skip directly to Phase 06 sign-off with matrix as primary evidence
- Any P2 deferred items: create follow-up issue or backlog entry in handover doc
