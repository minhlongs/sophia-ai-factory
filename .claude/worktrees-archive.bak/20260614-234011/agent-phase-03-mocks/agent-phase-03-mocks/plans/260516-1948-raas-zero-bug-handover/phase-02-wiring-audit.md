---
title: "Phase 02 — Wiring Audit (Group A Static)"
description: "Trace each Group A promise → code → DB → external API → tests. Classify PASS / FAIL / NEEDS-BUILD."
status: completed
priority: P0
effort: "2-3h"
dependencies: [phase-01-copy-honest-pivot]
created: 2026-05-16
output: "plans/reports/audit-260516-promise-wiring-matrix.md"
---

# Phase 02 — Wiring Audit (Group A Static)

## Context Links

- Brainstorm: `plans/reports/brainstorm-260516-1948-video-gen-zero-bug-handover-promise-audit.md` §2 Group A, §4 Phase 02
- Doctrine: `apps/sophia-ai-factory/CLAUDE.md` (no-tech v1.28.1), `.claude/rules/sophia-handover-rules.md`
- Output (append-only): `plans/reports/audit-260516-promise-wiring-matrix.md`
- Phase 01 commit: `4531f6d4` (copy honest-pivot baseline)

## Overview

- **Priority:** P0 — gates Phase 04 fixes and Phase 06 sign-off
- **Status:** completed 2026-05-16
- **Description:** Static code audit (zero $ cost) verifying each Group A homepage promise maps to a working code path, DB seed, external API client, and test. Output is a PASS/FAIL/NEEDS-BUILD matrix that drives Phase 04 work.
- **Completion:** All 16 Group A promises audited. Matrix complete at `plans/reports/audit-260516-promise-wiring-matrix.md`.

## Key Insights

- 16 Group A promises to verify: P5, P9, P10, P11, P12, P13, P14, P15, P17, P18, P19, P25, P26, P27, P29, P30
- BYOK constraint — verify keys are read from per-user encrypted storage, NOT operator env vars
- Tier gating (P30) is the most likely structural gap — affects pricing legitimacy
- Affiliate DB seed (P25 SmartSuite 50%, Shopify 200%) is a high-risk "marketing claim → empty table" gap
- 24/7 publish cron (P17) requires CF Cron Trigger config — easy to miss in audit

## Requirements

### Functional

- For each of 16 Group A promises, produce a row with: route file(s), DB table(s), external API client(s), test file(s), verdict (PASS / FAIL / NEEDS-BUILD), notes
- Each verdict backed by exact file paths + line numbers (grep evidence)
- NEEDS-BUILD items include estimated effort (S/M/L) and P0/P1/P2 priority

### Non-Functional

- Append-only writes to audit matrix (no destructive edits)
- No source code modifications during this phase
- Zero $ external API calls (static analysis only)

## Architecture

```
Promise (homepage messages/*.json)
  ↓
Route handler (apps/sophia-ai-factory/src/app/api/...)
  ↓
Server action / service module (src/lib/...)
  ↓
D1 query (createServerClient) + External API client (BYOK key from encrypted user_keys table)
  ↓
Test coverage (apps/sophia-ai-factory/tests/...)
```

Each promise must trace cleanly through this chain. Breaks = NEEDS-BUILD.

## Related Code Files

### Read (no edits this phase)

- `apps/sophia-ai-factory/messages/en.json`, `messages/vi.json` — promise source strings
- `apps/sophia-ai-factory/src/app/api/**/*.ts` — route handlers
- `apps/sophia-ai-factory/src/lib/**/*.ts` — services, BYOK key resolver
- `apps/sophia-ai-factory/src/config/tiers.ts` — tier gate definitions
- `apps/sophia-ai-factory/migrations/*.sql` + `wrangler.toml` D1 bindings + cron triggers
- `apps/sophia-ai-factory/tests/**/*.test.ts`

### Write (this phase)

- `plans/reports/audit-260516-promise-wiring-matrix.md` — append matrix rows

### Create / Delete

- None.

## Implementation Steps

1. Initialize matrix file `plans/reports/audit-260516-promise-wiring-matrix.md` with header + columns: Promise # | Claim | Route | DB | External API | Tests | Verdict | Effort | Priority | Notes
2. **P5 — 17 AI commands:** grep `commands/` registry + count actual handlers. Verdict if count >= 17.
3. **P9 — 50 leads <60s:** locate lead-gen mission code path. Read mission queue + concurrency config. Static estimate vs 60s.
4. **P10 — Commands via Telegram OR API:** verify each command has both a `/api/commands/<name>` route AND a Telegram bot handler.
5. **P11 — @Sophia_Bbot live:** grep Telegram webhook handler. Confirm `/campaign`, `/status`, `/results` handlers exist + webhook URL in wrangler.toml.
6. **P12 — Workflow 4 steps:** locate orchestrator. Verify chain `select_niche → ai_generate → publish → profit` exists as code or as enum/states.
7. **P13 — 5+ YouTube channels per dashboard:** grep multi-channel OAuth. Check `youtube_channels` table FK to user.
8. **P14 — Auto-affiliate links in descriptions:** trace publish pipeline → description builder → affiliate injection step.
9. **P15 — KOL Voice Cloning (ElevenLabs):** grep ElevenLabs voice-clone API call. Verify BYOK key path.
10. **P17 — 24/7 Auto-Publishing:** check `wrangler.toml` for `[triggers] crons` entry + cron handler file.
11. **P18 — Global Reach translate/localize:** grep caption translator. Verify it's wired into publish pipeline.
12. **P19 — Premium tier integrations (PartnerStack + Impact.com + weekly auto-updates):** verify tier-gate AND integration clients AND cron job for weekly refresh.
13. **P25 — Affiliate DB seed (SmartSuite 50%, Shopify 200%):** query D1 `affiliate_programs` table (or seed migration). Confirm rows exist.
14. **P26 — OpenRouter + ElevenLabs + D-ID BYOK:** confirm each of 3 API clients reads key from per-user encrypted storage.
15. **P27 — <40min video creation:** static add of step latencies from code comments / config. No real run.
16. **P29 — 30-day refund flow:** locate refund route + NOWPayments refund client + admin trigger.
17. **P30 — Tier gating enforcement:** for each tier-gated feature (MCU, campaigns/mo, channels, commands, team), verify middleware or service-layer check exists.
18. After all 16 rows written, summarize matrix: PASS count, FAIL count, NEEDS-BUILD count grouped by P0/P1/P2.
19. Commit matrix file with message: `docs(audit): wiring audit matrix for Group A promises`

## Todo List

- [x] Init matrix file with header + columns
- [x] Row P5 — 17 AI commands
- [x] Row P9 — 50 leads in <60s
- [x] Row P10 — Commands Telegram + API parity
- [x] Row P11 — @Sophia_Bbot webhook handlers
- [x] Row P12 — Workflow 4-step orchestrator
- [x] Row P13 — 5+ YouTube channels multi-OAuth
- [x] Row P14 — Auto-affiliate injection
- [x] Row P15 — ElevenLabs voice clone BYOK
- [x] Row P17 — 24/7 cron trigger
- [x] Row P18 — Caption translator
- [x] Row P19 — Premium tier integrations
- [x] Row P25 — Affiliate DB seed
- [x] Row P26 — 3-API BYOK wiring
- [x] Row P27 — Video pipeline latency
- [x] Row P29 — Refund flow
- [x] Row P30 — Tier gate enforcement
- [x] Summary block (PASS/FAIL/NEEDS-BUILD counts)
- [x] Commit matrix file

## Success Criteria

- All 16 promise rows present with cited file paths
- Each verdict has supporting evidence (file:line)
- NEEDS-BUILD rows tagged with P0/P1/P2 + effort estimate
- Summary block at bottom — counts ready to drive Phase 04 scope

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Grep misses dynamic / runtime-registered handlers | Cross-check with `wrangler.toml`, route manifest, and test file imports |
| Audit drifts into "fix while auditing" | Hard rule — Phase 02 is READ-ONLY. All fixes deferred to Phase 04. |
| Matrix becomes too long → unreadable | Cap notes column at 2 lines per row. Detailed notes go to `notes/<promise>.md` if needed. |
| Promise claims one thing, code does another subtly | Default to FAIL with notes — let Phase 04 decide build vs copy-fix |

## Security Considerations

- Verify BYOK keys never logged in plaintext (grep for `console.log` around key access)
- Confirm `user_keys` table encryption-at-rest spec exists (informs P21 Phase 03)
- Tier gate audit (P30) is a security boundary — failures could let lower tiers consume Premium features
- No new secrets introduced this phase

## Next Steps

- Output drives Phase 03 (perf) and Phase 04 (fixes) scope
- If FAIL or NEEDS-BUILD > 5 items at P0/P1, escalate to user for Phase 04 budget decision before starting fixes
- Matrix becomes input to Phase 06 handover doc
