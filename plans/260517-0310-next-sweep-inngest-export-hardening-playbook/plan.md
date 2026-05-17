---
title: Next sweep — Inngest cleanup + lead:export live + 10-layer hardening + operator playbook
status: pending
priority: P2
effort: large
branch: main
tags: [tech-debt, integration, hardening, docs]
created: 2026-05-17
---

# Sophia Next Sweep — Plan Overview

Post `/cook all` (matrix 21/21 PASS, prod SHA `a79a5795`). Doctrine v1.28.1 ceiling 87.5/100 honest. Goal: tighten remaining tech debt + ship lead:export real + harden without lifting ceiling + ship operator playbook docs.

## Phases

| # | File | Status | Effort | Risk |
|---|---|---|---|---|
| 01 | [phase-01-inngest-video-jobs-cleanup.md](./phase-01-inngest-video-jobs-cleanup.md) | pending | M | MED — touches live URL-to-Revenue pipeline |
| 02 | [phase-02-lead-export-live.md](./phase-02-lead-export-live.md) | pending | M | LOW — additive, BYOK-gated, stub fallback |
| 03 | [phase-03-10-layer-hardening-sweep.md](./phase-03-10-layer-hardening-sweep.md) | pending | M | LOW — audit + tighten, no architectural change |
| 04 | [phase-04-operator-playbook-bundle.md](./phase-04-operator-playbook-bundle.md) | pending | S | NONE — docs only |

Total estimated effort: ~3-4 dev-days (Phase 1+2+3 code; Phase 4 docs ~0.5d).

## Key dependencies

- Phase 01 finding (chain alive vs dead) gates remediation path. Phase 01 audit MUST complete before any deprecate-or-migrate code change.
- Phase 02 is independent — can ship in parallel with Phase 01/03.
- Phase 03 audit findings may surface remediation items that need their own follow-up phase (not implemented in this sweep beyond quick wins <50 LOC).
- Phase 04 docs CAN reference Phase 02 lead:export new params once stable.

## Doctrine alignment

- **No-tech doctrine (2026-05-15):** Phase 03 must NOT propose operator-action gates (e.g., "register external cron"). Hardening = code/config tightening only.
- **CF-direct deploy:** All code changes verified via `npm run deploy:full` + SHA match (`sophia-deploy-verify.md`).
- **BYOK:** Phase 02 Apollo bulk MUST honor existing `user-api-key-store` pattern; stub fallback path remains canonical when key absent.
- **Layer rules:** Phase 02 keeps Apollo client in `seed/lib` (current path `src/lib/apollo/`); handler stays in `forest/missions/`. No new cross-layer edges.

## Success metrics

- Phase 01: orphaned events documented OR chain rewired; `npm test` GREEN; deploy GREEN; no prod regressions on URL-to-Revenue flow.
- Phase 02: `lead:export` status = `live` in registry; real Apollo CSV returned for tenants with key; stub for tenants without; ≥6 new tests pass.
- Phase 03: audit report committed; remediation patches for items rated MUST-FIX shipped; honest score remains 87.5 (no fake lift).
- Phase 04: 4 new operator playbook docs committed under `docs/operator-playbook/`; bilingual where customer-facing.

## Unresolved questions

1. **Inngest chain live-traffic share** — what % of prod video jobs flow through `video_jobs` Inngest chain vs. HeyGen webhook `videos` direct path? Need ad-hoc D1 count + 30-day Inngest dashboard before Phase 01 decision tree finalized.
2. **Apollo bulk pagination quota** — Apollo's bulk endpoint quotas vary by plan tier. Should `lead:export` `max_rows` hard-cap be 500 (current proposal) or dynamic per detected plan? Defer to Phase 02 spike.
3. **Phase 06 entry criteria** — Phase 04 doc 4 (phase-06-prep-checklist) lists data signals Phase 05 must emit. Some signals (e.g., "conversion attribution accuracy >90%") need analytics infra not yet specified. Decide: defer to Phase 05 results, or pre-specify minimum analytics in Phase 04 doc.
