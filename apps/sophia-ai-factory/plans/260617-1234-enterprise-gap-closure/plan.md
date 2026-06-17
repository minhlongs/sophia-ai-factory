---
title: "Enterprise Gap Closure — Milestone B & C Roadmap"
description: "Close remaining gaps from 75→85 (Milestone B) and path to 100 (Milestone C) per Phase 5 scorecard. SOC 2 prep, DR cadence, real APM, key rotation, supply-chain hardening."
status: active
priority: P0
effort: large (Milestone B: ~3-4 months; Milestone C: 6-12 months)
branch: main
tags: [security, reliability, observability, soc2, enterprise]
created: 2026-06-17
source: plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md
---

# Enterprise Gap Closure — Milestone B (85) & C (100)

## Context

**Baseline:** Go-Live 100 audit (plan `260521-2342-go-live-100-audit`) completed 2026-06-04.
**Current score:** 75/100 (weighted) after all 8 P0 blockers shipped (Wave A/B/C).
**Target:** Milestone B = 85/100 (3-4 months). Milestone C = 100/100 (6-12 months + operational track record).

**Doctrine status:** `sophia-no-tech-doctrine.md` SUSPENDED for this audit cycle — operator-side gaps now score honestly.

**Prod anchor:** HEAD `d68b4d96` → `99252d57` (P0 fixes) → current `main` (includes P0 closures).

## Gap Categories (from Phase 5 scorecard)

| Category | Current /10 | Milestone B /10 | Milestone C /10 | Gap |
|---|---|---|---|---|
| Security | 7.5 | 8.8 | 10 | 0.3→2.5 |
| Reliability | 7.0 | 8.5 | 10 | 1.5→3.0 |
| Observability | 6.0 | 8.0 | 10 | 2.0→4.0 |
| Scalability | 6.5 | 8.0 | 10 | 1.5→3.5 |
| DevEx | 7.5 | 8.0 | 10 | 0.5→2.5 |
| Infra & Cost | 5.5 | 8.0 | 10 | 2.5→4.5 |

**Biggest gaps:** Infra & Cost (+2.5), Observability (+2.0), Reliability (+1.5).

## Milestone Definitions

### Milestone B — "Enterprise-Ready 85"
Target: Pass external security review; survive outage with operator-only debugging.
Duration: 3-4 months

**Deliverables:**
1. SOC 2 Type I prep (immutable audit log, separation-of-duties, incident response runbook, quarterly access review)
2. DR drill cadence (monthly restore test + off-site backup copy)
3. Real APM (OpenTelemetry in CF Worker → traces + p95 latency + SLO + Sentry alerts)
4. Key rotation infra (versioned keys + dual-decrypt window + tested runbook)
5. Per-org quotas (missions, credentials, members, webhooks) + audit overruns
6. Backup builder (deploy from clean machine <60min runbook + second-operator test)

**Expected score:** 85/100 weighted (Security 88, Reliability 85, Observability 80, Scalability 80, DevEx 80, Infra 80)

### Milestone C — "100/100"
Target: SOC 2 Type II + 12-month track record.
Duration: 6-12 months

**Deliverables:**
1. SOC 2 Type II audit closed (12-month observation period)
2. Dependency supply-chain (SBOM per release, signed commits, Renovate auto-merge)
3. Multi-region (D1 read replicas EU/APAC OR documented single-region acceptance)
4. Crypto compliance (AML/KYT for NOWPayments > threshold, sanctions screening)
5. Operational track record (6 months zero-incident OR all incidents post-mortem'd with blameless retros)
6. Vendor lock-in mitigation (tested cross-cloud DR — redeploy on Fly/Vercel within 24h)

**Reality check:** Many sub-scores require calendar time (drill history, incident track record). 100/100 is a 12-month milestone, not a sprint target.

## Phase List

| # | Phase | File | Scope | Effort | Score Δ | Status |
|---|-------|------|-------|--------|---------|--------|
| 1 | SOC 2 Type I Preparation | phase-01-soc2-type1-prep.md | Controls, audit log, SoD, runbooks | 3w | +3.0 Security | pending |
| 2 | DR Drill Cadence & Off-site Backup | phase-02-dr-drill-cadence.md | Monthly restore tests, R2→S3 mirror | 2w | +3.0 Reliability | pending |
| 3 | Real APM Implementation | phase-03-real-apm-implementation.md | OpenTelemetry, traces, SLO, alerts | 3w | +2.0 Observability | pending |
| 4 | Key Rotation Infrastructure | phase-04-key-rotation-infra.md | Versioned keys, dual-decrypt, runbook | 2w | +1.5 Security | pending |
| 5 | Per-Organization Quotas | phase-05-per-org-quotas.md | Quota enforcement + audit overruns | 2w | +1.0 Reliability | pending |
| 6 | Supply-Chain Hardening | phase-06-supply-chain-hardening.md | SBOM, signed commits, Renovate | 3w | +1.5 Infra | pending |
| 7 | Multi-Region Strategy | phase-07-multi-region-strategy.md | D1 read replicas or risk acceptance | 4w | +1.5 Scalability | pending |
| 8 | Crypto Compliance Framework | phase-08-crypto-compliance.md | AML/KYT, sanctions, NOWPayments review | 3w | +1.0 Security | pending |
| 9 | Operator Enablement | phase-09-operator-enablement.md | Second-operator test, backup builder runbook | 2w | +1.0 DevEx | pending |
| 10 | Track Record Documentation | phase-10-track-record-documentation.md | Incident response, post-mortems, SLO dashboard | ongoing | +1.5 Observability | pending |

**Total estimated effort:** ~24 weeks (6 months) to Milestone B + begin Milestone C track record.

## Dependencies

```
Phase 1 (SOC2) → foundational for all security work
Phase 2 (DR) → can start in parallel; depends on Phase 1 for audit trail
Phase 3 (APM) → independent; unblocks observability gaps
Phase 4 (Key Rotation) → depends on Phase 1 (SoD controls)
Phase 5 (Org Quotas) → independent; quick win
Phase 6 (Supply Chain) → independent; can run parallel
Phase 7 (Multi-region) → longest pole; can start after Phase 5
Phase 8 (Crypto Compliance) → depends on Phase 1 (audit trail)
Phase 9 (Operator Enablement) → depends on Phase 2 (DR) + Phase 3 (APM)
Phase 10 (Track Record) → ongoing after Phase 2/3/9 complete
```

**Critical path:** Phase 1 → Phase 4 → Phase 8 → Phase 10

## Out of Scope

- **Polar.sh integration** — permanently rejected for Sophia per `sophia-handover-rules.md`
- **GitHub Actions restore** — CF-direct deploy is permanent doctrine
- **Mass lib/→seed/tree/forest/land refactor** — consolidation complete per 2026-04-14; defer to separate cycle
- **Multi-cloud failover (Fly/Vercel)** — research phase only; implementation deferred to Milestone C
- **Customer-facing score inflation** — publish honest "Milestone A 75 → Milestone B 85" progression

## Success Criteria

### Milestone B (85/100) Completion
- All Phase 1-5 deliverables shipped and tested
- External security review passed (or critical findings resolved)
- DR drill log shows ≥3 monthly successful restores from R2 backup
- APM traces flowing; SLO dashboard shows p95 < 500ms for webhooks
- Key rotation runbook tested with dual-decrypt window validation
- Per-org quotas enforced for 100% of over-limit attempts
- Weighted score ≥85/100 (per Phase 5 rubric)

### Milestone C (100/100) Completion
- SOC 2 Type II audit certificate obtained
- SBOM published for last 3 releases; all commits signed
- D1 read replica in EU region operational (or risk acceptance doc signed)
- AML/KYT screening documented and operational for NOWPayments > threshold
- 6 consecutive months with zero Sev-1 incidents OR all incidents have published blameless post-mortems
- Cross-cloud DR runbook tested (redeploy on Fly/Vercel < 24h from clean state)
- Weighted score 100/100 (per Phase 5 rubric)

## Unresolved Questions

1. **SOC 2 Type I auditor selection** — Need to select and engage an audit firm. Budget approval required.
2. **Off-site backup destination** — R2→S3 mirror (AWS) vs R2→Backblaze B2. Cost/egress analysis needed.
3. **APM tool selection** — OpenTelemetry Collector to where? Honeycomb, Grafana Cloud, or self-hosted Tempo+Prometheus? Affects Phase 3 effort.
4. **Key rotation compatibility** — Need to decide: in-place re-encrypt (brief outage) vs versioned dual-decrypt window. Affects Phase 4 design.
5. **Multi-region read replicas cost** — D1 read replica pricing unknown. May exceed budget for Milestone B; could be Milestone C only.
6. **AML/KYT threshold** — What transaction volume triggers screening? Need product/legal decision.
7. **Vendor SOC 2 collection** — Cloudflare, Sentry, NOWPayments — need to collect and assess their SOC 2 reports for vendor management.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SOC 2 timeline slip (auditor availability) | High | High | Engage auditor early; consider multiple bids |
| DR restore test failure (R2 corruption) | Med | High | Validate R2 integrity first; add integrity checks |
| APM instrumentation increases latency | Med | Med | Benchmark before/after; use sampling |
| Key rotation causes outage | Med | High | Use dual-decrypt window; test on staging first |
| Multi-region cost exceeds budget | High | Med | Document cost/benefit; phase approach (read replica first) |
| Crypto compliance requires legal review | Med | High | Engage legal counsel early in Phase 8 |
| Operational track record requires calendar time | High | Max | No mitigation — this is inherent; set correct expectations |

## Related Files

**Inputs:**
- `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` — Gap analysis source
- `plans/260521-2342-go-live-100-audit/phase-03-production-readiness-audit.md` — Detailed axis reports
- `plans/260521-2342-go-live-100-audit/phase-04-tech-debt-discovery.md` — Tech debt inventory

**Outputs (per phase):**
- Each phase produces `reports/phase-XX-<topic>.md` with findings + fix recipe
- Final milestone reports: `reports/milestone-b-completion.md`, `reports/milestone-c-completion.md`

**Handover:**
- `reports/enterprise-gap-closure-handover.md` — Current implementation status + sign-off document (June 2026)

## Implementation Status (as of 2026-06-17)

**Phases in progress:**
- ✅ Phase 2 (DR) — Drill completed 2026-05-18, RTO=13s, RPO=0s
- 🟡 Phase 1 (SOC2) — Control evaluation code done; audit_log migration pending
- 🟡 Phase 3 (APM) — Sentry fail-fast wired; OpenTelemetry pending
- 🟡 Phase 6 (Supply Chain) — Migration guards enhanced; SBOM/Renovate pending

**Phases pending:**
- Phase 4 (Key Rotation) — Not started
- Phase 5 (Org Quotas) — Ready to start (quick win)
- Phase 7 (Multi-Region) — Not started
- Phase 8 (Crypto Compliance) — Not started
- Phase 9 (Operator Enablement) — Not started
- Phase 10 (Track Record) — Ongoing after Phase 2/3/9

**Estimated Milestone B completion:** August 2026 (provided budget + staffing secured)

## Next Actions

1. **Immediate (this week):**
   - [ ] Review handover document: `reports/enterprise-gap-closure-handover.md`
   - [ ] Secure SOC 2 auditor engagement (RFP → decision by 2026-06-30)
   - [ ] Select APM vendor (Honeycomb trial → decision by 2026-07-07)
   - [ ] Configure off-site backup (R2 → S3/B2 replication)

2. **Short-term (next 2 weeks):**
   - [ ] Create audit_log migration (0170) with immutable triggers
   - [ ] Implement OpenTelemetry instrumentation (Worker traces)
   - [ ] Define SLOs (availability 99.9%, p95 < 500ms)
   - [ ] Kickoff Phase 5 (Org Quotas) — independent quick win

3. **Budget & Staffing:**
   - [ ] Approve $5-15k for SOC 2 auditor
   - [ ] Approve $200-500/mo for APM vendor
   - [ ] Approve $50-100/mo for off-site storage
   - [ ] Certify second operator (bus factor mitigation)

**Handover document:** `reports/enterprise-gap-closure-handover.md`
