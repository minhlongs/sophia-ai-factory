# Business Continuity Plan

**Version**: 1.0 | **Date**: 2026-06-12
**Owner**: CTO
**Approved by**: CEO
**Review cycle**: Annual + after any major incident

---

## 1. Purpose

Ensure Sophia AI Factory can continue critical operations during and after a disruption. Minimize downtime, protect customer data, and maintain customer trust.

## 2. Scope

All systems, processes, and personnel required to deliver the core service:
- Authentication + authorization
- AI content generation
- Customer dashboard
- Billing + payments
- Customer support

## 3. Objectives

| Objective | Target |
|-----------|--------|
| Recovery Time Objective (RTO) | 4 hours |
| Recovery Point Objective (RPO) | 1 hour |
| Maximum Tolerable Downtime (MTD) | 24 hours |
| Service availability (annual) | 99.9% |

---

## 4. Risk Assessment

### Threats

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Cloudflare region outage | Low | High | Multi-region deployment |
| D1 database failure | Low | High | Daily backups, point-in-time recovery |
| R2 storage failure | Low | High | Versioning, replication |
| Stripe outage | Low | Medium | Queue payments, retry logic |
| DDoS attack | Medium | High | Cloudflare protection |
| Key employee unavailable | Medium | Medium | Documentation, cross-training |
| Office inaccessible (pandemic, disaster) | Medium | Low | Fully remote-capable |
| Cyber attack / breach | Medium | High | Security controls, IR plan |
| Vendor bankruptcy | Low | Medium | Multi-vendor strategy |

---

## 5. Critical Functions

### Tier 1 (must恢复 within 4 hours)

- Authentication
- Customer dashboard
- AI content generation
- Payment processing

### Tier 2 (must恢复 within 24 hours)

- Analytics + reporting
- Admin tools
- API access

### Tier 3 (nice to have)

- Marketing site
- Documentation site
- Internal tools

---

## 6. Recovery Strategies

### Strategy 1: Cloudflare Region Failure

**Detection**: Cloudflare health check fails for >5 min

**Response**:
1. Automatic failover to backup region (if configured)
2. If not automatic, manual failover via Cloudflare dashboard
3. Update DNS if needed
4. Verify service restored

**RTO**: 1 hour
**RPO**: 0 (replicated)

---

### Strategy 2: D1 Database Failure

**Detection**: D1 query errors >5% for >5 min

**Response**:
1. Check Cloudflare status page
2. If Cloudflare issue, wait for resolution
3. If our issue, restore from latest backup
4. Verify data integrity post-restore

**RTO**: 4 hours
**RPO**: 1 hour (point-in-time recovery)

---

### Strategy 3: R2 Storage Failure

**Detection**: R2 upload/download errors >10% for >10 min

**Response**:
1. Check Cloudflare status page
2. If Cloudflare issue, wait for resolution
3. If our issue, restore from backup bucket
4. Verify data integrity

**RTO**: 4 hours
**RPO**: 24 hours (daily backup)

---

### Strategy 4: Stripe Outage

**Detection**: Stripe API errors >20% for >15 min

**Response**:
1. Queue all payment events
2. Show "Payment processing delayed" message to customers
3. Retry queue every 5 min
4. When Stripe recovers, process backlog

**RTO**: N/A (Stripe managed)
**RPO**: 0 (queued events)

---

### Strategy 5: Key Employee Unavailable

**Detection**: Cannot reach employee for >24 hours during critical incident

**Response**:
1. Identify backup person per role (see Roles section)
2. Backup person takes over
3. Document decisions in shared Slack channel
4. Post-incident, update runbooks with gaps discovered

**RTO**: 24 hours
**RPO**: N/A (decisions, not data)

---

### Strategy 6: Office Inaccessible

**Detection**: Office closed for >7 days (pandemic, natural disaster)

**Response**:
1. All employees work remotely (already standard)
2. Communication via Slack + Loom
3. Customer-facing comms via status page + email
4. No physical systems to recover (all cloud)

**RTO**: 0 (no office-dependent operations)
**RPO**: N/A

---

### Strategy 7: Cyber Attack / Breach

**Detection**: Security alert, customer report, or anomaly

**Response**: Follow `INCIDENT-RESPONSE-PLAN.md`

**RTO**: 4 hours (containment) + 24 hours (recovery)
**RPO**: 1 hour

---

## 7. Roles and Responsibilities

| Role | Primary | Backup |
|------|---------|--------|
| Incident Commander | Engineering Lead | CTO |
| Technical Lead (Cloudflare) | Engineering Lead | CTO |
| Technical Lead (Database) | Engineering Lead | CTO |
| Communications Lead | AM | CEO |
| Customer Support Lead | AM team | CEO |
| Decision Authority (>$10k spend) | CEO Long Tho | N/A |
| Legal | External Counsel | N/A |

---

## 8. Communication Plan

### During incident

**Internal**: Slack `#war-{incident-id}` (war room for P0/P1)

**Customer**: 
- Status page (always)
- Slack `#sophia-{tenant}` (per tenant)
- Email (P0/P1)

**Public**: Blog post for major incidents (P0 with customer impact)

### After incident

- Post-mortem to internal team (within 48 hours)
- Customer notification (P0/P1 within 48 hours)
- Anonymized public post-mortem (optional, for major incidents)

---

## 9. Data Backup and Recovery

### Backups

| System | Frequency | Retention | Storage | Encryption |
|--------|-----------|-----------|---------|------------|
| D1 databases | Continuous (point-in-time) | 30 days | Cloudflare D1 | AES-256 |
| D1 databases (full) | Daily | 90 days | R2 cold storage | AES-256 |
| R2 objects | Continuous (versioning) | 90 days | R2 | AES-256 |
| R2 objects (full) | Daily | 1 year | R2 cold storage | AES-256 |
| Configuration (Git) | Per commit | Indefinite | GitHub | TLS + repo encryption |
| Secrets | Per change | Indefinite | Cloudflare Workers secrets | AES-256 |

### Backup testing

- Frequency: Quarterly
- Test: Restore to staging environment, verify integrity
- Owner: Engineering Lead
- Documentation: `tenants/_internal/backup-tests/`

---

## 10. Testing

### Quarterly

- [ ] Restore one D1 database from backup (verify data integrity)
- [ ] Restore one R2 bucket from backup (verify files)
- [ ] Failover test (if multi-region enabled)
- [ ] On-call rotation drill

### Annually

- [ ] Full disaster recovery exercise (simulated outage)
- [ ] Tabletop exercise with leadership
- [ ] BCP review + update

### Ad-hoc

- After any P0 incident
- After infrastructure changes
- After team changes

---

## 11. Plan Maintenance

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Plan review | Annual | CTO |
| Contact list update | Quarterly | COO |
| Backup test | Quarterly | Engineering Lead |
| Full DR test | Annual | CTO |
| Plan update after incident | Per P0 | CTO |

---

## 12. External Dependencies

| Vendor | Service | Backup plan |
|--------|---------|-------------|
| Cloudflare | Hosting, D1, R2 | Multi-region, daily backups |
| Stripe | Payments | Queue + retry, manual invoicing fallback |
| Slack | Communication | Email + phone fallback |
| GitHub | Code | Mirror to GitLab (consider) |
| Loom | Video | Direct uploads if needed |

### Vendor failure plan

If critical vendor fails for >24 hours:
1. Activate backup plan (per vendor)
2. Notify customers via status page
3. If prolonged, consider temporary workaround (manual processes)
4. Post-incident, review vendor strategy

---

## 13. Financial Considerations

### Insurance

- Cyber liability: $5M minimum (renewed annually)
- Business interruption: $1M minimum
- Errors + omissions: $2M minimum

### Budget for BCP

- Backup infrastructure: $500/month
- DR testing: $5k/year
- Insurance: $15k/year
- Plan maintenance: $10k/year

---

## 14. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CEO | Long Tho | 2026-06-12 | |
| CTO | | | |

---

**Last reviewed**: 2026-06-12
**Next review**: 2027-06-12 or after first P0
