# Sophia AI Factory — Go-Live 100/100 Audit

**Date:** 2026-05-21 19:01
**SHA audited:** `b8c4f6dd` (main)
**Prior baseline:** `plans/reports/strategic-audit-260502-1837-go-live.md`
**Doctrine ceiling:** `87.5/100` (no-tech doctrine v1.28.1 — no operator-third-party setup as score path)

---

## Brutal Verdict

**Soft-launch ready (5 design partners). Public-launch blocked by 2 open P0 + 1 throughput ceiling.**

The May-2 audit shipped real fixes — 3 of 5 P0s legitimately CLOSED on current SHA (per-customer HeyGen secret, `getHeyGenClientSync` removed, IPN underpayment guard). 2 of 5 only **partially** closed:

- **Tier gate** present at `/api/videos/generate` but **missing at canonical `/api/missions/auto-video` + mission-create**. Free user can bypass via direct API call.
- **Double-pay dedupe** present on one-time checkout (30-min window) but **missing on subscription checkout** — two clicks → two invoices → two fulfillments.

New P0 surfaced (security audit): HeyGen webhook D1 lookup on `heygen_job_id` is **not user-scoped** — cross-tenant collision possible (re-finding of May-2 P0.2, same root, different surface).

Throughput ceiling **unchanged from May-2**: video-status-sync cron runs sequential loop with inline R2 transfer. HOLDS@25 customers, DEGRADES@50, BREAKS@100. Operational, not security — but it caps public launch.

Doctrine ceiling **87.5/100 still holds**. Honest aggregate score on current SHA: **80.0/100** (gap = ship the P0+P1 list below).

---

## Go-Live Scorecard

| Category | Score | Justification |
|---|---|---|
| **Architecture** | 85/100 | 4-layer (seed→tree→forest→land) enforced via import rules; service topology clean; 8 known unknowns acceptable for new-engineer onboarding. Loses 15 for: chargeback SOP not codified, backup automation manual. |
| **Reliability** | 72/100 | 3 May-2 P0s closed, 2 partial. F-03 `decrementCredits` TOCTOU race; F-06 circuit-breaker state in eviction-prone KV. Idempotency solid on IPN, weak on subscription checkout. |
| **Scalability** | 60/100 | Throughput verdict: HOLDS@25, DEGRADES@50, BREAKS@100. Root cause = sequential cron + inline R2 in single Worker. Same as May-2. CF Queues + parallelized polling needed. |
| **Security** | 70/100 | SOFT-LAUNCH-ONLY. 2 open P0 (checkout dedupe, webhook user-scope), 4 P1 (mission-create gate, session revoke on pw-reset, admin BasicAuth non-constant-time, platform HeyGen silent bill). CSP/HSTS/headers good. |
| **Observability** | 78/100 | Structured logger + PII scrub + Sentry-with-forwarder + cron check-ins + real probes + synthetic monitor + version SHA contract. Gaps: anonymous `/api/health` always 200 (O-03), no Sentry alert rules in repo (O-04), sourcemap upload optional. |
| **Documentation** | 87/100 | Main docs current (2026-05-18+), Codebase Summary verified at b8c4f6dd, 4-layer architecture documented, 17 runbooks. Missing: QUICKSTART, CONTRIBUTING, RELEASE_PROCESS runbook, 3 specific runbooks (cron failure, D1 rollback, IPN retry). |
| **Testing** | 82/100 | 4702 tests across 474 files, 99.5% pass. Coverage thresholds at 0 (D-06). 5 API routes lack Zod (proposals, violations, health, stats, usage-summary). 25 `:any` all in test files. |
| **Deployment** | 78/100 | CF-direct doctrine clear (`npm run deploy:full`), SHA injection contract enforced, post-deploy verify script. **Doctrine drift caught**: docs claim "GitHub Actions disabled" but 12 active workflows exist (quality-gate, security-scan, 4 cron-*.yml). Need doctrine v1.28.2 to reconcile. |
| **DevEx** | 72/100 | 4-layer + dev-sops + fast tests above average. Friction: 60-var env sprawl no preflight, no local D1 seed bootstrap, Turbopack drops PWA/bundle-analyzer silently, pnpm/npm mixed signals, `pnpm dev` ≠ CF-parity. |
| **Maintainability** | 79/100 | 0 `:any` in production, layer rules enforced, build clean. Drag: 20 files >200 LOC (largest: supabase/types.ts 902 LOC, openclaw-bridge.ts 536 LOC), 40 legacy files in src/lib/, status-store.ts references nonexistent D1 table. |

**Aggregate: 76.3/100** (simple mean) / **80.0/100** (weighted by criticality: reliability + security + scalability 2×)

---

## BLOCKERS — must close before public launch

| # | Title | Source | Effort | Owner |
|---|---|---|---|---|
| B1 | Subscription checkout double-pay dedupe (user+sku+30min) | sec P0-A / rel F-02 | 2-4h | backend |
| B2 | HeyGen webhook user-scope D1 lookup (`heygen_job_id` + `user_id` composite) | sec P0-B / rel F-07 | 30min-2h | backend |
| B3 | Tier quota gate on `/api/missions/auto-video` + mission-create | rel F-01 / sec P1-A | 2-4h | backend |

**Total BLOCKER effort: ~1 dev-day.** Soft-launch (≤5 partners) acceptable while open; public-launch blocked.

---

## HIGH PRIORITY — close before 50-customer milestone

| # | Title | Source | Effort |
|---|---|---|---|
| H1 | `decrementCredits` atomic — replace read-then-write with CAS or D1 atomic update | rel F-03 / sec related | 1d |
| H2 | Cron `video-status-sync` parallelize via `Promise.allSettled` per-user | rel F-04 | 4-8h |
| H3 | Move R2 transfer to CF Queues (decouple from cron Worker) | rel F-05 | 1d |
| H4 | Better Auth: revoke all sessions on password change | sec P1 | 4h |
| H5 | Admin Basic Auth → constant-time compare (timing-safe-equal) | sec P1 | 1h |
| H6 | Anonymous `/api/health` returns degraded on real dependency failure (D1/KV/R2 ping) | obs O-03 | 4h |
| H7 | Sentry alert rules → checked-in YAML/code | obs O-04 | 4h |
| H8 | Doctrine reconcile: docs vs 12 active GH workflows (v1.28.2) | obs O-01 | 2h |
| H9 | Add runbooks: cron failure recovery, D1 migration rollback, IPN retry SOP | docs gap | 4h |

**Total HIGH effort: ~5 dev-days.**

---

## MEDIUM PRIORITY — operational improvements

| # | Title | Source | Effort |
|---|---|---|---|
| M1 | Circuit-breaker state → dedicated KV namespace (not `EXPERIMENT_KV`) | rel F-06 | 1h |
| M2 | BYOK key versioning + rotation pipeline (`key_version` column) | sec P2 | 3d |
| M3 | Durable audit log (tier change, key rotation, refund) — D1 table + R2 archive | sec P2 | 1d |
| M4 | Header polish: `upgrade-insecure-requests`, COEP/COOP/CORP | sec P2 | 2h |
| M5 | Session IP-binding (revoke on IP class change, not absolute) | sec P2 | 4h |
| M6 | RaaS gate path-prefix tightening | sec P2 | 2h |
| M7 | Zod validation on 5 missing API routes | docs/td | 1h |
| M8 | Env var preflight script (validate 60 vars before `pnpm dev`) | dx D-01 | 2h |
| M9 | Local D1 seed bootstrap script | dx D-02 | 4h |
| M10 | Turbopack PWA/bundle-analyzer parity warning or fix | dx D-03 | 2h |
| M11 | Coverage thresholds: enforce 80% line / 70% branch | dx D-06 | 1h |
| M12 | Refactor oversized files >200 LOC (top 5: supabase/types.ts, openclaw-bridge.ts, …) | td P2 | 10h |
| M13 | CONTRIBUTING.md + QUICKSTART.md + RELEASE_PROCESS runbook | docs gap | 3h |
| M14 | Synthetic monitor — second region (Singapore alongside US) | obs gap | 2h |

**Total MEDIUM effort: ~7 dev-days.**

---

## LOW PRIORITY — polish

- L1 Permissions-Policy header broaden (sec P3, 30min)
- L2 Tailwind `style-src 'unsafe-inline'` → nonce-based (sec P3, 2h)
- L3 BYOK read-error null collapse → typed error (sec P3, 1h)
- L4 Remove `raas-key-gen` orphan module (td P3, 30min)
- L5 Resolve `status-store.ts` → create `status_check` table or delete file (td P2, 30min)
- L6 Fix `vi.mock()` top-level warnings (td P3, 12min)
- L7 Webhook resolver D1-blip accept-without-sig fallback → fail-closed (rel F-08, 1h)
- L8 Supabase legacy code audit: keep OAuth shims, document, remove rest (td, 2h)

---

## Doctrine Notes

1. **No-tech doctrine v1.28.1 holds.** None of the findings above require operator setup of third-party services. Honest ceiling = 87.5/100. Lift requires DR drills + months of operational evidence, not code.
2. **Doctrine drift on CI claim.** `apps/sophia-ai-factory/CLAUDE.md` says "GitHub Actions disabled by design" — but `quality-gate.yml`, `security-scan.yml`, and 4 cron workflows are active. Only `deploy.yml` + `test.yml.disabled` are gone. Reconcile to v1.28.2 wording (item H8).
3. **Prior-context mismatch.** `docs/observability-runbook.md` and `docs/postmortems/2026-05-03-github-actions-disabled-deploy-doctrine.md` were referenced but don't exist at those paths; closest equivalent = `docs/handover/sentry-alerts-setup-runbook-260512.md`. Either rename or fix references.

---

## Phase Files

Phase files for execution have not been created in this audit pass — this `plan.md` is the deliverable. If execution is requested, propose:

- `phase-01-blockers.md` — close B1/B2/B3 (1 dev-day, gate to public launch)
- `phase-02-scalability.md` — H1/H2/H3 (decouple cron + atomic credits + R2 queue)
- `phase-03-security-hardening.md` — H4/H5/M2/M3/M4 (sessions + BYOK rotation + audit log)
- `phase-04-observability.md` — H6/H7/M14 (health probe + alerts + multi-region)
- `phase-05-docs-doctrine.md` — H8/H9/M13 (reconcile doctrine + missing runbooks)
- `phase-06-devex-polish.md` — M7/M8/M9/M10/M11/M12 (post-launch sprint)

---

## Open Questions

1. **HeyGen job ID uniqueness contract** — is it globally unique across HeyGen accounts (BYOK)? If not, B2 composite key required; if yes, may be defensive only.
2. **Platform HeyGen fallback removal plan** — `getHeyGenClient` (non-Sync) still exists; when does platform key get fully retired? (sec P1, related to May-2 P0.3 closure depth.)
3. **`BYOK_MASTER_KEY` rotation runbook owner** — who owns the rotation drill? When was last drill? (sec P2)
4. **Audit log retention target** — 90d / 1y / 7y? Drives storage choice (D1 vs R2 archive). (sec P2)
5. **Public-launch trigger** — 5 design partners → public, or 5 → 25 staged ramp? Drives whether H2/H3 are pre-launch or post-launch.
6. **Doctrine v1.28.2** — should the CI claim be rewritten ("deploy is CF-direct; PR-quality workflows remain active") or should the active workflows be archived?

---

## Reports Index

- `reports/01-architecture-intelligence.md` — service topology, data flows, dependency graph, 18+ crons, auth model
- `reports/02-reliability-scalability.md` — May-2 P0 verification + 9 new findings + throughput verdict
- `reports/03-security.md` — 2 open P0, 4 P1, 6 P2, 3 P3, SOFT-LAUNCH-ONLY verdict
- `reports/04-observability-devex.md` — Obs 78/100, DevEx 72/100, doctrine drift caught
- `reports/05-docs-techdebt.md` — Docs 87/100, Maintainability 79/100, ship-as-is verdict for docs

