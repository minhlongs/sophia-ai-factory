# Phase 02 — Documentation Backfill

## Context Links

- Phase 1 outputs: `reports/phase-01-codebase-map.md`, all `research/researcher-*.md`
- Existing docs index: `docs/README.md` (modified in dirty tree — verify post-Phase-1)
- Doc-management rule: `~/.claude/rules/documentation-management.md`
- Project docs layout: `docs/project-overview-pdr.md`, `docs/system-architecture.md`, `docs/code-standards.md`, `docs/codebase-summary.md`, `docs/deployment-guide.md`, `docs/disaster-recovery.md`, `docs/dev-sops.md`

## Overview

- **Priority:** P1
- **Status:** pending (blocked-by Phase 1)
- **Description:** Backfill missing or stale enterprise documentation. Eight target docs covering quickstart through incident response. Update existing docs against verified Phase 1 maps — do NOT create parallel "enhanced" files.

## Key Insights

- Many `docs/*.md` files modified in current dirty tree → updates already in flight; Phase 1 must commit/abandon first
- Sophia has solid docs surface (`docs/dev-sops.md`, `docs/disaster-recovery.md`, `docs/credentials-handover.md`, `docs/customer-handover-runbook.md`) — gap is enterprise-grade docs: QUICKSTART (dev onboarding ≤15 min), ARCHITECTURE deep-dive, RUNBOOKS index, INCIDENT_RESPONSE playbook, SECURITY policy
- README is currently 30 lines — too thin for enterprise positioning
- Bilingual VI/EN required for customer-facing docs only (per `sophia-handover-rules.md`); operator/dev docs stay EN

## Requirements

### Functional
- Refresh/create exactly these 8 docs (all in `docs/` or `apps/sophia-ai-factory/`):
  1. `README.md` (repo-root) — enterprise positioning, badges, links to all key docs
  2. `docs/QUICKSTART.md` — 15-minute dev onboarding (clone → first deploy)
  3. `docs/system-architecture.md` (update, not create) — anchor to Phase 1 layer map + sequence diagrams for IPN/Setup-Wizard/Telegram flows
  4. `docs/runbooks/INDEX.md` — central catalogue of all `docs/runbooks/*.md`
  5. `docs/INCIDENT_RESPONSE.md` — sev classification, escalation, on-call protocol, postmortem template
  6. `docs/SECURITY.md` — threat model, vuln-disclosure address, BYOK encryption story, secret-rotation pointer
  7. `docs/codebase-summary.md` (update) — consume Phase 1 layer counts + import graph
  8. `docs/project-overview-pdr.md` (update if stale)

### Non-functional
- ≤500 lines per doc; KISS, no fluff
- Every claim backed by file:line citation or runtime evidence (URL, env var, binding name)
- VI/EN bilingual ONLY for customer-facing — operator/dev docs EN only

## Architecture

Sequential within phase (docs cross-reference each other). Parallelizable with Phase 3 + Phase 4 (no shared files).

| Doc | Audience | Length cap |
|---|---|---|
| README.md | All | 120 lines |
| QUICKSTART.md | Dev | 200 lines |
| system-architecture.md | Dev + auditor | 500 lines |
| runbooks/INDEX.md | Operator | 80 lines |
| INCIDENT_RESPONSE.md | Operator + on-call | 300 lines |
| SECURITY.md | Auditor + security review | 250 lines |
| codebase-summary.md | LLM + new dev | 300 lines |
| project-overview-pdr.md | Stakeholder | 200 lines |

## Related Code Files

**Read for content sourcing:**
- Phase 1 research outputs + `reports/phase-01-codebase-map.md`
- `apps/sophia-ai-factory/CLAUDE.md`, `apps/sophia-ai-factory/.claude/rules/*.md`
- `wrangler.toml`, `package.json` scripts
- `src/app/api/csp-report/route.ts`, security headers in `next.config.ts`

**Modify:**
- 8 target docs above
- DO NOT create `docs/*-v2.md` or `docs/*-enhanced.md` (per dev rule "update existing files directly")

## Implementation Steps

1. Verify Phase 1 dirty-tree resolution committed; pull fresh `git status` to confirm clean
2. Read all 8 target doc current states; note delta vs Phase 1 maps
3. Update `README.md` first (highest visibility) — repo-root + `apps/sophia-ai-factory/README.md` cross-link
4. Update `system-architecture.md` with Phase 1 layer counts + cron-trigger table + binding table
5. Create `QUICKSTART.md` — verify steps actually work by reading scripts referenced
6. Create `INCIDENT_RESPONSE.md` — anchor to `docs/disaster-recovery.md`, deploy rollback (`wrangler rollback`), SHA-mismatch playbook
7. Create `SECURITY.md` — anchor to CSP/HSTS in `next.config.ts`, BYOK crypto in `src/tree/credentials/`, `0114-user-failed-logins.sql`
8. Create `docs/runbooks/INDEX.md` — `ls docs/runbooks/*.md` and one-line each
9. Update `codebase-summary.md` + `project-overview-pdr.md` against Phase 1 reconciled counts
10. Commit batch: `docs: phase-02 backfill — README/QUICKSTART/ARCH/RUNBOOKS/INCIDENT/SECURITY`

## Todo List

- [ ] Confirm clean tree post-Phase-1
- [ ] Update repo-root `README.md`
- [ ] Update `docs/system-architecture.md` with Phase 1 maps
- [ ] Create `docs/QUICKSTART.md`
- [ ] Create `docs/INCIDENT_RESPONSE.md`
- [ ] Create `docs/SECURITY.md`
- [ ] Create `docs/runbooks/INDEX.md`
- [ ] Update `docs/codebase-summary.md` + `docs/project-overview-pdr.md`
- [ ] Validate via `npm run lint-md` if present
- [ ] Commit + push (push-precondition for any later deploy work)

## Success Criteria

- All 8 docs present, ≤cap lines, file:line citations resolve
- `docs/runbooks/INDEX.md` lists every existing runbook
- README repo-root → app-level cross-link works
- Zero "enhanced" parallel files
- Phase 5 can cite these docs as evidence for L7/L10 score lift

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Doc claims drift from code (auto-stale) | High | Med | Anchor every claim to file:line; reject narrative-only assertions |
| Bilingual rewrite slows phase | Med | Low | Limit VI/EN to customer-facing only |
| Conflicts with in-flight dirty-tree doc edits | High | Med | Phase 1 resolves first |
| Over-documentation (fluff) | Med | Low | Length caps; KISS principle |

## Security Considerations

- `SECURITY.md` MUST NOT leak secret names with example values
- Disclosure email must be configurable, not personal account
- BYOK doc must not include encryption key paths

## Next Steps

- Feeds Phase 5 evidence pool for Documentation/Maintainability category scores
- Parallel-safe with Phase 3 + Phase 4
