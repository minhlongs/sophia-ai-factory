# SOC 2 Type I Readiness Report

**Prepared:** 2026-07-04
**Scope:** Sophia AI Factory production environment (Cloudflare Workers, D1, R2)
**Target TSCs:** Security (Common Criteria CC1-CC9), Availability (A1), Confidentiality (C1)
**Target auditor:** BARR Advisory (selected, not yet engaged)
**Target audit window:** Q4 2026 (Type I report by Q1 2027)

---

## 1. Current Compliance Posture

### Security -- Common Criteria (CC1-CC9)

| Domain | Status | Score |
|--------|--------|-------|
| CC1 Control Environment | WEAK -- no Code of Conduct, org chart, background checks, or training records | 2/10 |
| CC2 Communication | STRONG -- security docs public, incident channels defined | 8/10 |
| CC3 Risk Assessment | ADEQUATE -- risk register exists; vendor reviews incomplete | 6/10 |
| CC4 Monitoring Activities | MODERATE -- vuln scanning in pre-push, no pen test completed | 5/10 |
| CC5 Control Activities | STRONG -- deploy guard, approval workflows, least privilege enforced in code | 9/10 |
| CC6 Logical & Physical Access | MODERATE -- MFA enforced, audit logging with hash chain, Q2 access review overdue | 7/10 |
| CC7 System Operations | STRONG -- IR plan published, backups running, monitoring active | 8/10 |
| CC8 Change Management | STRONG -- all changes via PR, CI/CD gate, deploy guard enforced | 9/10 |
| CC9 Risk Mitigation | WEAK -- no cyber liability insurance, vendor reviews partial | 3/10 |

### Availability (A1)

All four controls exist but uptime measurement is manual (no status page, no automated SLA tracking). DR drill completed 2026-05-18 (RTO=13s, RPO=0s). Load test passed 100 concurrent users.

**Score: 6/10** -- procedures exist, but automated measurement and a public status page are missing.

### Confidentiality (C1)

Encryption at rest (AES-256) and in transit (TLS 1.3) are enforced. Multi-tenant isolation via `org_id` filters with validation middleware. Secrets management via Cloudflare Workers Secrets. Data retention and deletion procedures implemented with legal hold support.

Data classification policy is the only gap -- the classifications exist in the Information Security Policy but have not been formally documented as a standalone policy.

**Score: 8/10** -- strong technical controls, one documentation gap.

### Processing Integrity (Deferred)

Not in scope. AI outputs are non-deterministic and hard to attest.

### Privacy (Deferred)

GDPR/CCPA compliance handled separately. Not in scope for this SOC 2 engagement.

---

## 2. Gaps vs SOC 2 Type I Requirements

### Critical Gaps (Must Fix Before Auditor Engagement)

| # | Gap | Control | Deadline | Notes |
|---|-----|---------|----------|-------|
| G1 | **NOWPayments SOC 2 expiring 2026-07-10** | CC9.1/CC3.2 | 6 days | Request renewed report or document compensating controls. If expiration passes unrenewed, third-party review is incomplete. |
| G2 | **Q2 2026 quarterly access review not completed** | CC6.2 | OVERDUE (was 2026-06-30) | Run `node scripts/security/quarterly-access-review.js --quarter Q2-2026` immediately and archive the report. |
| G3 | **No penetration test completed** | CC4.2 | Q3 2026 | Schedule first pen test with qualified provider. SOC 2 Type I requires evidence of regular security testing. |
| G4 | **No cyber liability insurance** | CC9.3 | Q3 2026 | Obtain $1-5M coverage for data breach response costs. |
| G5 | **First BYOK key rotation not executed** | C1.5 | 2026-07-15 | Test on staging, then execute on production test user. Document in rotation log. |

### High-Priority Gaps (Fix Before Audit)

| # | Gap | Control | Effort | Notes |
|---|-----|---------|--------|-------|
| G6 | **Missing Code of Conduct document** | CC1.1 | 2 hours | Create `docs/CODE_OF_CONDUCT.md` and collect signed acknowledgments from all team members. |
| G7 | **No formal org chart** | CC1.2 | 1 hour | Create `docs/org-chart.md` with reporting lines. |
| G8 | **No background check records** | CC1.3/CC6.4 | 4 hours | Establish basic process (tool or signed attestation). For a 2-3 person team, self-attestation with third-party verification on next hire may suffice. |
| G9 | **No security training completion tracking** | CC1.4 | 2 hours | Document training materials and track completion. For small team, signed acknowledgment is acceptable. |
| G10 | **No uptime SLA measurement** | A1.1 | 4 hours | Set up external monitoring (UptimeRobot, Checkly) and a status page. |
| G11 | **No automated SLA/SLO dashboard** | CC4.4/A1.1 | 8 hours | Complete Phase 3 APM implementation with SLO tracking. |
| G12 | **Vendor security reviews incomplete** | CC9.1/CC3.2 | 4 hours | Complete reviews for Cloudflare, Sentry, and NOWPayments (or replacements). Store in `docs/compliance/vendor-soc2-reports/`. |
| G13 | **DPAs not stored digitally** | CC9.4 | 2 hours | Compile all signed DPAs in a secure, access-controlled directory. |

### Moderate Gaps (Should Fix, Acceptable to Defer With Written Risk Acceptance)

| # | Gap | Control | Effort | Notes |
|---|-----|---------|--------|-------|
| G14 | **No business interruption insurance** | CC9.2 | 4 hours | Evaluate if enterprise contracts require it; document risk acceptance if not. |
| G15 | **No data classification standalone policy** | C1.1 | 2 hours | Classification already defined in Information Security Policy (Section 6). Extract to `docs/DATA-CLASSIFICATION.md` for auditor convenience. |
| G16 | **No structured monthly security meetings** | CC2.1 | 1 hour | Document meeting cadence (even if async Slack updates). |

---

## 3. Remediation Roadmap With Effort Estimates

All estimates are in person-hours for a 2-3 person engineering/operations team.

### Week 1 (2026-07-04 to 2026-07-10) -- Firefighting

| Task | Effort | Owner |
|------|--------|-------|
| Run Q2 2026 quarterly access review (G2) | 1h | CTO |
| Contact NOWPayments for renewed SOC 2 report (G1) | 2h | COO |
| Execute key rotation on staging (G5) | 3h | CTO |
| Apply pending D1 migrations if any | 1h | CTO |
| **Total Week 1** | **7h** | |

### Week 2 (2026-07-11 to 2026-07-17) -- Policy & Documents

| Task | Effort | Owner |
|------|--------|-------|
| Create Code of Conduct (G6) | 2h | CTO |
| Create org chart (G7) | 1h | CEO/CTO |
| Establish background check attestation process (G8) | 4h | CEO/COO |
| Create security training materials and tracking log (G9) | 2h | CTO |
| Execute key rotation on production test user (G5) | 2h | CTO |
| Create Data Classification policy document (G15) | 2h | CTO |
| **Total Week 2** | **13h** | |

### Week 3 (2026-07-18 to 2026-07-24) -- Monitoring & Insurance

| Task | Effort | Owner |
|------|--------|-------|
| Set up external uptime monitoring + status page (G10) | 4h | CTO |
| Complete vendor security reviews (G12) | 4h | COO |
| Compile DPAs in digital storage (G13) | 2h | COO |
| Obtain cyber liability insurance quotes (G4) | 4h | CEO |
| **Total Week 3** | **14h** | |

### Week 4 (2026-07-25 to 2026-07-31) -- Testing & Engagements

| Task | Effort | Owner |
|------|--------|-------|
| Engage pen test provider, schedule Q3 test (G3) | 2h | CTO |
| Engage BARR Advisory: send engagement letter (auditor) | 3h | CEO/CTO |
| Document monthly security meeting cadence (G16) | 1h | CTO |
| Evaluate and quote business interruption insurance (G14) | 2h | CEO |
| **Total Week 4** | **8h** | |

### Weeks 5-12 (August-September 2026) -- Execution

| Task | Effort | Owner |
|------|--------|-------|
| Undergo pen test (G3) -- provider-led, ~2 weeks | 8h (internal support) | CTO |
| Build APM/SLO dashboard (G11) | 8h | CTO |
| Set up compliance monitoring platform (Vanta/Drata) | 8h | CTO |
| Compile evidence pack for auditor | 8h | CTO |
| Conduct internal pre-audit walkthrough | 4h | CTO |
| **Total Weeks 5-12** | **36h** | |

### Week 13 (2026-10-01) -- Readiness Gate

| Task | Effort | Owner |
|------|--------|-------|
| Run deploy guard verification test | 1h | CTO |
| Run hash chain verification script on production | 1h | CTO |
| Verify all policy acknowledgments signed | 1h | COO |
| Final evidence inventory check | 2h | CTO |
| **Total Week 13** | **5h** | |

### Total Pre-Audit Effort: ~83 person-hours (about 2-3 weeks of focused work across 13 calendar weeks)

---

## 4. Auditor Recommendation

**Selected: BARR Advisory**

Rationale per existing auditor-selection.md:

| Factor | Assessment |
|--------|------------|
| **Cost** | $10,000-$22,000 (Type I) -- lowest of evaluated firms |
| **Timeline** | 5-7 weeks -- fits Q4 2026 window |
| **Startup fit** | Specializes in YC/a16z portfolio SaaS companies |
| **Stack fit** | Experience with Cloudflare Workers, Next.js, serverless |
| **Availability risk** | Not yet contacted -- should reach out within 1 week to check backlog |

**Backup option:** A-LIGN ($12k-25k, 4-6 weeks, more automated/less personalized)

**Action required this week:** Contact BARR Advisory to schedule introductory call and request engagement letter. Availability/backlog is the primary scheduling risk.

---

## 5. Timeline to Readiness

```
Weeks 1-4   (Jul 2026)   Firefighting + policy docs + external monitoring
Weeks 5-8   (Aug 2026)   Pen test + APM/SLO dashboard + compliance platform
Weeks 9-12  (Sep 2026)   Evidence pack compilation + pre-audit walkthrough
Week 13     (Oct 1 2026) Readiness gate -- verify all controls operational
                          ↓
                READINESS DATE: 2026-10-01
                          ↓
Audit kickoff (Oct 2026) 5-7 weeks with BARR Advisory
  └─ Evidence submission (weeks 1-2)
  └─ Auditor testing (weeks 2-4)
  └─ Draft report review (weeks 5-6)
  └─ Final report (week 7)
                          ↓
              TARGET REPORT: Q1 2027 (by 2026-12-15)
```

### Milestones

| Date | Milestone | Gate |
|------|-----------|------|
| 2026-07-10 | NOWPayments SOC 2 renewal secured OR compensating control documented | G1 |
| 2026-07-15 | Q2 access review completed, key rotation executed on test user | G2, G5 |
| 2026-07-31 | BARR Advisory engaged with signed engagement letter | Auditor |
| 2026-08-15 | Pen test completed with report | G3 |
| 2026-08-31 | Cyber liability insurance bound | G4 |
| 2026-09-15 | Evidence pack compiled | All gaps |
| 2026-09-30 | Internal pre-audit pass -- all controls verified | Readiness |
| 2026-10-01 | **READINESS DATE** -- greenlight for audit kickoff | |
| 2026-10-01 | Audit kickoff with BARR Advisory | |
| 2026-11-15 | Draft report received | |
| 2026-12-15 | **SOC 2 Type I report issued** | |

### Budget Estimate

| Item | Cost |
|------|------|
| BARR Advisory Type I audit (3 TSCs) | $10,000-$22,000 |
| Penetration test | $10,000-$25,000 |
| Cyber liability insurance (annual) | $5,000-$15,000 |
| Compliance platform (Vanta/Drata, annual) | $15,000-$30,000 |
| Internal time (83 person-hours) | $5,000-$10,000 |
| **Total Year 1** | **$45,000-$102,000** |

---

## 6. Decision Points

1. **Confirm 3 TSCs (Security + Availability + Confidentiality)** -- recommended. Processing Integrity and Privacy remain deferred.
2. **Engage BARR Advisory immediately** -- contact this week to check backlog availability.
3. **Compliance platform selection** -- Vanta vs Drata vs Secureframe. No decision documented yet.
4. **Risk acceptance** -- for any gaps not remediated by readiness date, document formal risk acceptance with CEO sign-off.
5. **NOWPayments contingency** -- if SOC 2 report cannot be renewed by 2026-07-10, identify and document compensating controls or begin migration.

---

**Status:** Remediation plan defined; 16 gaps identified (5 critical, 8 high, 3 moderate)
**Recommendation:** Proceed to readiness execution per above timeline
**Next review:** 2026-07-11 (after Week 1 firefighting items)
