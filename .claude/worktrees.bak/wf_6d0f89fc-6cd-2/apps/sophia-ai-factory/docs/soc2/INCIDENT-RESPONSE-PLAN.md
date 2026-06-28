# Incident Response Plan

**Version**: 1.0 | **Date**: 2026-06-12
**Owner**: CTO
**Approved by**: CEO
**Review cycle**: Annual + after every P0 incident

**Quick reference**: `docs/runbooks/INCIDENT-RESPONSE-QUICKREF.md`

---

## 1. Purpose

Establish a structured, repeatable process for detecting, responding to, containing, eradicating, and recovering from security incidents. Minimize business impact and ensure timely communication.

## 2. Scope

Applies to all incidents affecting:
- Production systems (Workers, D1, R2, APIs)
- Customer data (any classification)
- Internal systems (Slack, email, GitHub)
- Third-party services we depend on

## 3. Incident Categories

### Security incidents

- Unauthorized access (confirmed or suspected)
- Data breach or exfiltration
- Malware / ransomware
- Phishing or social engineering
- DDoS attack
- Vulnerability exploitation

### Availability incidents

- Service outage (P0)
- Partial degradation (P1/P2)
- Performance degradation
- Data loss / corruption

### Compliance incidents

- GDPR breach (notification required ≤72 hours)
- CCPA breach
- DMCA takedown (non-routine)
- Audit finding

---

## 4. Severity Classification

| Severity | Definition | Response SLA | Resolution SLA | Examples |
|----------|------------|--------------|----------------|----------|
| P0 | All users affected, data loss, security breach | 15 min | 4 hours | Login fails for all, confirmed breach |
| P1 | Many users, critical feature broken | 2 hours | 24 hours | AI generation down, payment broken |
| P2 | Some users, workaround exists | 24 hours | 7 days | Reports slow, occasional failures |
| P3 | One user, minor issue | 48 hours | 30 days | Account-specific bug, how-to question |

---

## 5. Incident Response Team

### Roles

| Role | Responsibility | Default |
|------|----------------|---------|
| Incident Commander (IC) | Coordinates response, makes decisions | Engineering Lead |
| Communications Lead | Internal + customer comms | AM or designated |
| Subject Matter Expert (SME) | Technical resolution | Per system |
| Scribe | Documents timeline | Engineer on rotation |
| Legal Counsel | Compliance, regulatory | External counsel (for breaches) |

### Activation

P0/P1: IC activates war room in Slack (`#war-{incident-id}`)
P2/P3: Standard ticket, no war room

---

## 6. Response Phases

### Phase 1: Detection (0-15 min)

**Activities**:
- Alert fires (Sentry, Cloudflare, status checks)
- On-call engineer acknowledges
- Initial triage (real incident vs false positive)
- Severity assigned
- IC notified (if P0/P1)

**Tools**:
- Sentry: Error monitoring
- Cloudflare: DDoS, WAF, analytics
- Stripe: Payment alerts
- Custom health checks
- Customer reports (via Slack, email)

**Output**: Severity classification + IC assignment

---

### Phase 2: Containment (15 min - 2 hours)

**Goal**: Stop the bleeding

**Activities**:

| Severity | Containment actions |
|----------|---------------------|
| P0 | Activate war room, freeze deploys, enable DDoS mitigation, isolate affected systems |
| P1 | Same as P0 but less aggressive, focused on affected component |
| P2 | Normal ticket handling, deploy fix when ready |
| P3 | Self-service via docs |

**For security incidents**:
- Disable compromised credentials
- Isolate affected accounts/systems
- Preserve evidence (logs, snapshots)
- Block attacker IPs / vectors

**Output**: Incident contained, no further damage

---

### Phase 3: Eradication (2-24 hours)

**Goal**: Remove root cause

**Activities**:
- Identify root cause (5 whys, log analysis)
- Develop fix (code, config, process)
- Test fix in staging
- Deploy to production
- Verify resolution

**Tools**:
- Git history
- Cloudflare logs
- Sentry traces
- Database audit logs

**Output**: Root cause identified + fix deployed

---

### Phase 4: Recovery (24-48 hours)

**Goal**: Restore normal service + verify

**Activities**:
- Monitor affected systems for recurrence
- Restore from backup (if needed)
- Verify data integrity
- Re-enable deploys (P0/P1)
- Communicate all-clear

**Output**: Service restored, verified stable

---

### Phase 5: Post-Incident (48 hours - 2 weeks)

**Goal**: Learn + prevent recurrence

**Activities**:
- Post-mortem document (within 48 hours)
- Blameless retro with all responders
- Customer notification (P0/P1 only)
- Action items with owners + dates
- Update runbooks + monitoring
- Track action items to completion

**Output**: Post-mortem published, action items tracked

---

## 7. Communication

### Internal cadence

| Severity | Frequency | Channel |
|----------|-----------|---------|
| P0 | Every 30 min | Slack war room |
| P1 | Every 2 hours | Slack thread |
| P2 | Daily | Ticket comment |
| P3 | As resolved | Ticket comment |

### Customer communication

**When**:
- P0/P1: Always (proactive)
- P2: If affects multiple customers or >4 hour resolution
- P3: Only on request

**Channels**:
- Slack (`#sophia-{tenant}`)
- Email (for formal notification)
- Status page (status.sophia.agencyos.network)

**Templates**: See `INCIDENT-RESPONSE-QUICKREF.md`

---

## 8. Regulatory Notification

### GDPR (72-hour rule)

**Trigger**: Personal data breach likely to result in risk to data subject rights

**Timeline**:
- Internal notification to CTO: ≤2 hours of detection
- Supervisory Authority notification: ≤72 hours
- Data subject notification: Without undue delay (if high risk)

**Owner**: CTO + Legal Counsel

**Required content**:
- Nature of breach (categories + approximate numbers)
- Name + contact of DPO / CTO
- Likely consequences
- Measures taken / proposed

### CCPA / CPRA

**Trigger**: Breach of unencrypted personal information

**Timeline**: "Most expedient time possible and without unreasonable delay"

**Owner**: CTO + Legal Counsel

### Other

- HIPAA: If applicable (not currently in scope)
- State laws: Varies by state (CT, NY, etc. have specific requirements)
- Contractual: Check customer DPAs for specific terms

---

## 9. Evidence Preservation

For security incidents:

**Preserve**:
- All relevant logs (Cloudflare, Sentry, app)
- Database snapshots at time of incident
- Slack messages
- Email correspondence
- Git history (relevant commits)
- Screenshots of attacker activity (if any)

**Retention**: 7 years minimum for security incidents

**Storage**: Encrypted, access-controlled, chain of custody documented

---

## 10. Post-Mortem Template

See `templates/post-mortem.md` (TODO: create)

### Required sections

1. **Summary**: One-paragraph description
2. **Timeline**: UTC timestamps of all key events
3. **Root cause**: 5 whys analysis
4. **Impact**: Users affected, downtime, revenue lost
5. **What went well**: Things that worked
6. **What didn't go well**: Process gaps
7. **Action items**: Owner + due date for each
8. **Lessons learned**: For future incidents

### Distribution

- Internal: All engineering + AM team
- Customer: All affected customers (P0/P1)
- Public: Anonymized version on blog (optional, for major incidents)

---

## 11. On-Call Rotation

### P0 coverage

- 24/7 rotation
- 1-week shifts
- 4-week cycle (4 engineers)
- Compensation: $200/week on-call + $500/P0 incident

### P1 coverage

- Business hours + escalation on-call
- Same rotation as P0

### P2/P3

- Business hours only
- No on-call requirement

---

## 12. Tools and Resources

### Required

- **Slack**: `#sec-incidents`, `#war-{incident-id}`, `#oncall`
- **PagerDuty** (or similar): Alert routing + escalation
- **Sentry**: Error monitoring
- **Cloudflare Analytics + Logs**: Request logs
- **GitHub**: Code review + deploy history
- **Status page**: status.sophia.agencyos.network
- **1Password**: Credential management
- **D1 audit logs**: Database access logs

### Optional

- **Jira / Linear**: Action item tracking
- **Notion**: Runbooks + post-mortems
- **Loom**: Async video updates
- **Confluence**: Internal documentation

---

## 13. Training

### Initial

- All engineers: IR training within first month
- AMs: Customer communication training
- All employees: Phishing + reporting training

### Ongoing

- Quarterly: Tabletop exercise (simulated P0)
- Annual: Full IR plan walkthrough
- After every P0: Lessons learned shared

---

## 14. Metrics

Track quarterly:

| Metric | Target |
|--------|--------|
| Mean time to detect (MTTD) | <5 min |
| Mean time to respond (MTTR) | <15 min (P0) |
| Mean time to resolve (MTTT) | <4 hours (P0) |
| Post-mortem completion rate | 100% (P0/P1) |
| Action item completion rate | >90% within 30 days |

---

## 15. Review

This plan reviewed:
- Annually (next: 2027-06-12)
- After every P0 incident
- Upon material change in infrastructure or team

---

## 16. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CEO | Long Tho | 2026-06-12 | |
| CTO | | | |

---

**Last reviewed**: 2026-06-12
**Next review**: 2027-06-12 or after first P0
