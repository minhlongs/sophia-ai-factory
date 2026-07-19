# Phase 10 — Track Record Documentation

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Milestone C requirements)
- Related: Phase 2 (DR drills), Phase 3 (APM/SLOs), Phase 9 (operator enablement)
- Requirement: 6-month operational track record with zero Sev-1 incidents OR published post-mortems

## Overview

- **Priority:** P2 (ongoing after Phase 2/3/9 complete)
- **Status:** pending
- **Description:** Establish and maintain operational track record documentation: SLO dashboards, incident post-mortems, monthly DR drill logs, and compliance evidence. This phase spans 6-12 months and produces the "operational age" component of 100/100.

## Key Insights

- Many scorecard axes (DR drill cadence, SLO burn rate, incident history) **cannot score >7/10 without months of actual operations**
- Phase 5 concluded: "100/100 implicitly demands SOC2 Type II + 12-month track record"
- This phase is not "implementation" in the traditional sense — it's sustained execution and documentation
- Output: Monthly reports, quarterly reviews, incident logs (if any), all archived in `docs/operations/`

## Requirements

### Functional
1. **SLO dashboard** — Public or internal dashboard showing error budget burn rate, latency p95, availability % over 28-day window
2. **Incident management process** — Formal process for declaring Sev-1/2/3, war room, communication, post-mortem within 48h
3. **Post-mortem template** — Standardized blameless retrospective format; all Sev-1/2 incidents must have completed PM
4. **Monthly operations report** — Compile: DR drill results, SLO status, incidents, changes, near-misses
5. **Compliance evidence archive** — Organized folder structure for SOC 2 Type II evidence collection

### Non-functional
- SLO data retained for 12+ months
- Post-mortems published internally within 5 business days
- Monthly reports generated automatically where possible
- All evidence timestamped and signed (digital signature or PR approval)

## Architecture

### SLO Dashboard

Using Honeycomb SLOs (from Phase 3) or Prometheus + Grafana:

```yaml
# Honeycomb SLO definition (via API or UI)
slo_name: availability_28d
service: sophia-ai-factory
goal: 99.9%
metric: http.server.request.count{status_class="2xx"} / http.server.request.count
window: 28d
alert_burn_rate_threshold: 2  # alert if error budget burning at 2x rate
```

**Dashboard components:**
- Current error budget remaining
- Burn rate over time (fast and slow burn)
- Top contributing error dimensions (route, status code)
- Latency SLO (p95 < 500ms)

**Public/internal status page:** `docs/status/` or hosted on Better Stack/Uptime Kuma.

### Incident Management Process

**Severity definitions:**
- **Sev-1:** Full outage, all users affected, SLA breach — immediate war room, CEO paged
- **Sev-2:** Partial outage, significant user segment, degraded performance — IC declared, team notified
- **Sev-3:** Minor impact, workaround exists — logged, addressed during business hours
- **Sev-4:** Cosmetic/non-user-impacting — backlog

**Runbook references:**
- Sev-1 → `docs/runbooks/INCIDENT_RESPONSE.md` + relevant domain runbooks (D1-OUTAGE, PAYMENT-WEBHOOK-FAILURE)
- All incidents → create `docs/incidents/<date>-<slug>/` with timeline, root cause, action items

### Post-Mortem Template (`docs/incidents/TEMPLATE.md`)

```markdown
# Incident Post-Mortem: <TITLE>

**Incident ID:** INC-YYYY-NNN
**Severity:** Sev-1 / Sev-2 / Sev-3
**Declared:** <datetime UTC>
**Resolved:** <datetime UTC>
**Duration:** <T+Resolution - T+Declared>
**Impact:** <users affected, financial impact, SLA breach?>

## Timeline

| Time (UTC) | Event |
|------------|-------|
| T+00:00   | Alert triggered (monitoring system) |
| T+00:05   | Incident Commander assigned |
| ...       | ... |

## Root Cause

<5-whys or fishbone analysis>

## Contributing Factors

- Factor 1
- Factor 2

## Action Items

| ID | Owner | Action | Due | Status |
|----|-------|--------|-----|--------|
| PM-1 | @eng | Add circuit breaker to D1 queries | 2026-07-01 | In Progress |
```

### Monthly Operations Report (`docs/operations/monthly/YYYY-MM.md`)

Template:

```markdown
# Operations Report — YYYY-MM

## Reliability
- **Availability:** 99.XX% (target: 99.9%)
- **Incidents:** Sev-1: 0, Sev-2: 1, Sev-3: 2
- **DR Drill:** ✅ Completed <date> — RTO 45min, RPO < 1min

## Observability
- **SLO status:** Error budget remaining: X%
- **Alert noise:** N alerts total; 0 false positives
- **APM coverage:** 100% of endpoints traced

## Security
- **Vulnerabilities:** HIGH: 0, MED: 3 (scheduled patches)
- **Access reviews:** Quarterly completed — N operators, 0 stale accounts
- **Compliance checks:** N payments screened, 0 blocked false positives

## Changes
- Deploys: N (all signed, no rollbacks)
- Migrations applied: N
- Infrastructure changes: list

## Issues / Risks
- <Any open risks or concerns>
```

## Related Code Files

**Files to create:**
- `docs/status/SLO-DASHBOARD.md` (or link to Honeycomb/Grafana)
- `docs/incidents/TEMPLATE.md`
- `docs/runbooks/INCIDENT_RESPONSE.md` (detailed)
- `scripts/operations/generate-monthly-report.js`
- `docs/operations/monthly/` (auto-populated)
- `docs/compliance/EVIDENCE-INDEX.md` — index of all SOC 2 evidence by control

**Files to modify:**
- `src/forest/inngest/functions/*` — ensure all jobs log to structured logger (Phase 3)
- `docs/runbooks/` — ensure all have owner and last-reviewed date

## Implementation Steps

1. **Set up SLO dashboard** — from Phase 3 APM; ensure 28-day window data
2. **Write incident response runbook** — roles, SLAs, communication plan
3. **Create post-mortem template** — `docs/incidents/TEMPLATE.md`
4. **Build monthly report generator** — script that pulls data from Honeycomb, D1, GH API
5. **Publish first monthly report** — even if no incidents; establish baseline
6. **Schedule recurring** — GitHub Actions monthly workflow to generate draft report for review
7. **First incident (if any)** — follow process; complete PM within 48h
8. **Quarterly access review** — from Phase 1; archive PR in `docs/access-reviews/`
9. **SOC 2 Type II evidence packing** — organize by control area; timestamp everything
10. **12-month archive** — ensure all evidence retained for audit

## Todo List (Ongoing)

- [ ] Week 1: Create SLO dashboard (link to Honeycomb)
- [ ] Week 1: Write INCIDENT_RESPONSE.md runbook
- [ ] Week 2: Create incidents/ template + directory structure
- [ ] Week 2: Build monthly report generator script
- [ ] Week 3: Publish first monthly report (current month)
- [ ] Month 2+: Generate monthly report on schedule (1st of month)
- [ ] Ongoing: Any Sev-1/2 incident → complete PM within 48h
- [ ] Quarterly: Access review PR (Phase 1)
- [ ] Month 6: Compile 6-month evidence pack for SOC 2 Type II readiness
- [ ] Month 12: Full year evidence pack; engage auditor for Type II

## Success Criteria (Milestone C)

- ✅ SLO dashboard showing 28-day rolling metrics (public or internal)
- ✅ All Sev-1/2 incidents have completed post-mortems within 5 days
- ✅ Monthly operations reports published without gaps for 6 consecutive months
- ✅ DR drill log shows monthly successful tests (Phase 2)
- ✅ Quarterly access reviews completed on schedule (Phase 1)
- ✅ Compliance evidence indexed and organized for SOC 2 Type II audit
- ✅ After 12 months: Zero Sev-1 incidents OR 100% of Sev-1 have published PMs

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SLO dashboard not maintained | Low | Med | Automate generation; set calendar reminder |
| Post-mortem skipped during incident | Med | High | Make PM completion prerequisite for incident closure |
| Monthly report becomes burdensome | Med | Low | Automate data collection; human only for narrative |
| Evidence not audit-ready | Low | High | Monthly archive check; validate file completeness |

## Security Considerations

- Post-mortems may contain sensitive info (PII, security details) — restrict to internal/auditor access only
- Incident logs must be tamper-evident (store in git with signed commits)
- Compliance evidence archive should be signed/timestamped

## Next Steps

1. **Immediate:** Build SLO dashboard (leverages Phase 3 APM work)
2. **Week 1-2:** Incident response runbook + post-mortem template
3. **Week 3:** Monthly report generator; publish first draft
4. **Ongoing:** Maintain cadence; this phase never "completes" — it's sustained

## Note on Milestone C Timeline

This phase requires **calendar time**:
- SOC 2 Type II needs 6-12 months of observation period
- Operational track record accumulates month-over-month
- Cannot compress; plan for 12-month journey from Milestone B completion

Therefore, Milestone C (100/100) is a **time-boxed milestone**, not a scope-boxed one. The work to *enable* it is mostly done by Milestone B; the work to *achieve* it is sustained operations.
