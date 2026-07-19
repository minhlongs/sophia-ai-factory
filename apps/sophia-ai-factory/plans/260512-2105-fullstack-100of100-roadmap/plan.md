---
title: "Sophia AI Factory — 74→93+ Fullstack Roadmap"
description: "Close 20 audit gaps via 5 phases (CI→DNS→Code→Backup→Schema). CF-direct doctrine."
status: completed
priority: P1
effort: 18h
branch: main
tags: [fullstack, audit, ci-cd, security, dr, code-quality]
created: 2026-05-12
---

# Plan: Sophia AI Factory — Fullstack 74 → 93+

**Audit:** `plans/reports/debugger-260512-2058-fullstack-audit-rescore.md` (74/100 baseline)
**Doctrine:** CF-direct (wrangler CLI). GH Actions disabled by design since 2026-05-03.
**SHA verify** mandatory after every deploy (`/api/version` shortSha == HEAD short SHA).
**Test baseline:** 4081+ vitest pass — must not regress.

## Phase List

| # | File | Scope (Gaps) | Effort | Score Δ | Cumulative | Status |
|---|------|--------------|--------|---------|------------|--------|
| 1 | [phase-01-ci-hardening.md](phase-01-ci-hardening.md) | G2*, G3, G7, G12, G13, G19 | 3h | +4 | 78/100 | pending |
| 2 | [phase-02-dns-security.md](phase-02-dns-security.md) | G6, G8, G15 | 1h | +3 | 81/100 | pending |
| 3 | [phase-03-code-quality-sprint.md](phase-03-code-quality-sprint.md) | G16, G5, G10, G4 | 8h | +3 | 87/100 | pending |
| 4 | [phase-04-backup-dr.md](phase-04-backup-dr.md) | G1, G14 | 4h | +2 | 91/100 | pending |
| 5 | [phase-05-schema-tech-debt.md](phase-05-schema-tech-debt.md) | G9, G11 | 2h | +1 | 93+/100 | pending |

\* G2 (add `ci:lint` to pre-push) is **planned in Phase 1** but **enforcement step DEFERRED until end of Phase 3** — pre-push lint cannot be enforced while 274 ESLint errors exist (would block all commits).

## Dependencies

```
Phase 1 (CI prep) ─┬─► Phase 3 (Code Quality) ──► [Phase 1 G2 enforcement turn-on]
                   ├─► Phase 4 (Backup/DR) — needs Phase 1 RPO/RTO docs
                   └─► Phase 2 (DNS) — independent, can run parallel
Phase 5 (Schema) ──► Independent — can run after Phase 1
```

**Recommended execution order:** 1 → 2 (parallel ok) → 3 → 1-tail (G2 enforce) → 4 → 5.

## Out of Scope

- **Phase 4 PEV** — deferred per YAGNI (Sophia uses Inngest, not PEV).
- **GH Actions re-enable** — CF-direct is canonical; do not restore CI.
- Gaps G17, G18, G20 — LOW severity, deferred to future audit.

## Unresolved Questions (from audit §8 — do NOT block on these)

1. Is `BETTER_STACK_HEARTBEAT_URL` secret actually set in CF? Need: `npx wrangler secret list` check.
2. Resend send domain — `sophia.agencyos.network` or `em.resend.dev`? Affects G6 scope.
3. `protobufjs` HIGH vuln — build-time only or in Workers runtime bundle? Affects G8 urgency.
4. Live `polar_customer_id` data check — null for all rows? Determines G9 migration shape.

## Success Criteria (Overall)

- Score ≥ 93/100 verified by re-running audit framework on completion commit
- All deploys: SHA match + HTTP 200 + tests green
- No regression to 4081+ vitest baseline
- Documented in `docs/project-changelog.md` after each phase
