---
title: "Consolidate 3 Proposal/RaaS Surfaces → 1"
description: "Delete dead apps/sophia-backend and orphan apps/sophia-proposal; port real gaps into canonical apps/sophia-ai-factory."
status: completed
completed: 2026-05-12
priority: P2
effort: 6-10h (4-8h if Phase-02 audit finds zero must-port gaps)
branch: main
tags: [consolidation, cleanup, yagni, raas, free100-prep]
created: 2026-05-12
---

## Goal

Repo currently has 3 parallel proposal/RaaS surfaces. Reduce to 1 canonical surface (`apps/sophia-ai-factory`) without regressing production (https://sophia.agencyos.network), the 4078/4110 test baseline, or FREE100 distribution prep.

## Surface Inventory (Pre-Plan)

| Surface | Status | LOC | Last Touch | Verdict |
|---|---|---|---|---|
| `apps/sophia-backend/` (Python FastAPI) | LEGACY, never integrated | 1003 | 2026-04-29 | DELETE (zero callers; tarball backup exists) |
| `apps/sophia-proposal/` (Next.js + Anthropic) | Self-declared DEPRECATED in own CLAUDE.md | ~10,459 + 458 files | post-merge cleanup only (2026-03-27+) | AUDIT → port gaps → DELETE |
| `apps/sophia-ai-factory/` (Next.js i18n) | CANONICAL, ACTIVE | massive | 2026-05-12 (HEAD `6ddeee00`) | PRESERVE |

## Confirmed Gap (must port before Phase 04)

- `apps/sophia-ai-factory/src/app/api/proposals/route.ts` is a 27-line STUB.
- `apps/sophia-proposal/app/api/proposals/generate/route.ts` is a 166-line REAL implementation (Anthropic + quality-check + balance-checker + RaaS token resolve).
- Backing libs in `apps/sophia-proposal/lib/ai/` (claude-proposal-generator, quality-check, proposal-templates) and `lib/validators/proposal.ts` not present in canonical.
- Other potential gaps: `lib/billing/balance-checker`, `lib/raas/resolve-token`, `lib/org`, `packages/raas-sdk` (public SDK), api routes `/api/crm`, `/api/feedback`, `/api/onboarding`, `/api/org`. Phase-02 will categorize each as PORT / SKIP / SUPERSEDED.

## Phase Table

| # | Phase | Effort | Risk | Status |
|---|---|---|---|---|
| 01 | Delete `apps/sophia-backend/` (Python) | 10m | LOW | ✅ completed |
| 02 | Audit `apps/sophia-proposal/` for unique value | 1-2h | LOW (read-only) | ✅ completed |
| 03 | Port confirmed gaps (proposals/generate + libs ± SDK) | 0-4h | MED | ✅ completed |
| 04 | Delete `apps/sophia-proposal/` + redeploy verify | 1h | MED-HIGH | ✅ completed |
| 05 | Docs sync (README, codebase-summary, architecture, changelog) | 30m | LOW | pending |

Total: 3-8h compute + 1h verify margin. Phase 03 effort is conditional on Phase 02 findings — may be 0h if all gaps either (a) already superseded by canonical equivalents we missed, or (b) explicitly out-of-scope for FREE100.

## Dependency Graph

```
P01 (delete python) ─┐
                     ├─► P02 (audit) ─► P03 (port gaps) ─► P04 (delete proposal) ─► P05 (docs)
                     │       │
                     │       └─ may fork sub-audit reports under plans/.../reports/
                     │
                     └─ independent; can ship alone if user defers P02+
```

P01 and P02 are independent: P01 can ship in isolation and gives partial value (1003 LOC + Python tooling debt gone). P02-P05 form the larger second wave.

## Out of Scope

- No new features (YAGNI). Pure delete + port-of-existing.
- No D1 migration consolidation (sophia-proposal has 6 migrations 0005-0010; canonical has 110+ migrations including newer 0005-0010 numbers — DO NOT cross-pollinate; canonical's history is authoritative).
- No tests written for ported code beyond what already exists in canonical.
- No deploy of `wrangler.toml` (orphan inside sophia-proposal/) — root `wrangler.jsonc` (`name = sophia-ai-factory`, points to `apps/sophia-ai-factory/.open-next/worker.js`) is the canonical deploy config.
- No touching of `apps/84tea` or `apps/sophia-video-bot` (out of consolidation scope).

## Critical Constraints

- Production https://sophia.agencyos.network MUST stay GREEN; SHA-match verify after Phase 04.
- Test baseline 4078/4110 — Phase 03 port must not introduce regressions; Phase 04 delete must not orphan canonical imports.
- CF-direct doctrine: `npm run deploy:full` from `apps/sophia-ai-factory/`. No GitHub Actions deploys.
- FREE100 distribution prep MUST remain ship-ready throughout. No long-lived feature branches.
- Backups: Python tarball at `~/plans/260429-2040-sophia-consolidation/backups/sophia-factory-mekong-260429.tar.gz`. sophia-proposal rollback via `git revert` of Phase-04 commit.

## Verification Map (per phase)

- P01: `grep -r "sophia-backend\|localhost:8000\|fastapi" apps/sophia-ai-factory/src` returns 0; build passes; tests 4078/4110.
- P02: Audit report written; no file mutations.
- P03: New files compile (`npm run type-check`); tests still 4078/4110 (or +N where N is new tests added intentionally).
- P04: Build passes; tests pass; `npm run deploy:full` → SHA match at `/api/version`; HTTP 200 at root.
- P05: `grep -r "apps/sophia-proposal\|apps/sophia-backend" docs/` returns 0.

## Risks

1. **Hidden import from canonical → sophia-proposal**: Verified ZERO direct path refs in `apps/sophia-ai-factory/src` today (only two stale source-of comments). Re-grep at start of Phase 04.
2. **packages/raas-sdk consumers**: Public SDK may be published to npm. Phase 02 MUST check `npm view @sophia/raas-sdk` (or whatever the name resolves to) before deletion. If published, decide: re-home into canonical monorepo OR keep `packages/raas-sdk` as separate top-level workspace.
3. **Migration number collision**: Both apps have files numbered 0005-0010. They are NOT the same migrations. D1 binding `sophia-raas-db` is shared. Confirm canonical app has already applied all migrations actually needed by prod, and discard sophia-proposal's migration files without applying them.
4. **Onboarding/CRM/Feedback route gap**: Canonical lacks `/api/onboarding`, `/api/crm`, `/api/feedback`, `/api/org`. Phase 02 must classify: are these used by any client today, or pre-merge experiments?

## Open Questions (for user before Phase 03)

1. Is `packages/raas-sdk` published externally (npm/private registry)? If yes, where? — gates whether we re-home it.
2. FREE100 partners — do any depend on `/api/crm`, `/api/feedback`, `/api/onboarding/*`, or `/api/org` routes that exist only in sophia-proposal?
3. Is `proposal-create.ts` mission handler in canonical (95 LOC) the intended replacement for sophia-proposal's `/api/proposals/generate` (166 LOC), or are both meant to coexist?

## Files

- [phase-01-delete-python-backend.md](./phase-01-delete-python-backend.md)
- [phase-02-audit-sophia-proposal.md](./phase-02-audit-sophia-proposal.md)
- [phase-03-port-gaps.md](./phase-03-port-gaps.md)
- [phase-04-delete-sophia-proposal.md](./phase-04-delete-sophia-proposal.md)
- [phase-05-docs-sync.md](./phase-05-docs-sync.md)
