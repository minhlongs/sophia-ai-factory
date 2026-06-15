# Disaster Recovery Plan

**Version**: 1.0 | **Date**: 2026-06-12
**Owner**: CTO + Engineering Lead
**Approved by**: CEO
**Review cycle**: Annual + after any DR test or major incident

**Companion to**: `BUSINESS-CONTINUITY-PLAN.md`

---

## 1. Purpose

Detailed procedures to recover IT systems and data after a disaster. Focused on technical recovery steps, distinct from BCP (which is broader business operations).

## 2. Scope

- Cloudflare Workers (production)
- D1 databases (all tenants + system)
- R2 storage (all buckets)
- Stripe integration
- Secrets + configuration
- DNS + networking

## 3. Recovery Targets

| System | RTO | RPO | Priority |
|--------|-----|-----|----------|
| Authentication | 1 hour | 0 | P0 |
| Customer dashboard | 2 hours | 1 hour | P0 |
| AI generation | 4 hours | 1 hour | P0 |
| Payment processing | 4 hours | 0 | P0 |
| Analytics | 24 hours | 24 hours | P1 |
| Admin tools | 24 hours | 24 hours | P2 |
| Marketing site | 72 hours | 24 hours | P3 |

---

## 4. Disaster Scenarios

### Scenario 1: Cloudflare Region Outage

**Likelihood**: Low
**Impact**: High (all services down for that region)

**Detection**:
- Cloudflare status page monitoring
- Internal health checks fail >5 min
- Customer reports surge

**Recovery steps**:
1. Confirm outage via Cloudflare status page
2. If regional: Wait for Cloudflare to recover (typical: <1 hour)
3. If extended: Failover to backup region (manual or via Workers for Platforms)
4. Update DNS if needed
5. Verify all services restored
6. Monitor for 24 hours post-recovery

**Owner**: Engineering Lead

---

### Scenario 2: D1 Database Corruption / Loss

**Likelihood**: Low
**Impact**: High (data loss for affected tenant)

**Detection**:
- Query errors
- Customer reports of missing data
- Integrity check failures

**Recovery steps**:
1. Identify scope: single tenant, multiple tenants, all tenants
2. Stop writes to affected database (enable read-only mode)
3. Restore from latest backup:
   - For single tenant: restore from D1 backup to new DB
   - For multiple tenants: assess blast radius
4. Verify data integrity post-restore (compare checksums)
5. Re-enable writes
6. Notify affected customers if data loss confirmed
7. Update audit log

**Owner**: Engineering Lead

**Tools**: `scripts/restore-d1.ts` (TODO), `wrangler d1 restore`

---

### Scenario 3: R2 Bucket Deletion / Corruption

**Likelihood**: Low
**Impact**: Medium (content loss if not versioned)

**Detection**:
- 404 errors on content URLs
- Missing files in customer dashboards

**Recovery steps**:
1. Identify affected bucket + files
2. Check versioning: restore previous version if available
3. If no versioning: restore from daily backup bucket
4. Verify file integrity (checksums)
5. Update DNS / URLs if bucket changed
6. Notify affected customers

**Owner**: Engineering Lead

---

### Scenario 4: Secrets Compromise

**Likelihood**: Low
**Impact**: High (potential data breach)

**Detection**:
- Unusual API activity
- Vendor security alert
- Anomalous auth logs

**Recovery steps**:
1. Immediately rotate all secrets via Cloudflare dashboard
2. Audit access logs for compromise window
3. Identify scope of access during compromise
4. Notify affected customers if data accessed
5. File regulatory notifications if required (GDPR ≤72 hours)
6. Post-incident: review secret management practices
7. Enable additional monitoring

**Owner**: CTO + Engineering Lead

---

### Scenario 5: Complete Cloudflare Account Compromise

**Likelihood**: Very low
**Impact**: Critical (all services affected)

**Detection**:
- Cannot access Cloudflare dashboard
- Unusual account activity alerts
- Vendor notification

**Recovery steps**:
1. Contact Cloudflare support immediately (emergency hotline)
2. If account takeover: work with Cloudflare security team
3. Restore from backups once access regained
4. Rotate all credentials
5. Audit for unauthorized changes during compromise
6. Notify all customers + regulatory if breach confirmed
7. Consider migration to new account if recovery impossible

**Owner**: CEO + CTO + Cloudflare support

---

### Scenario 6: Ransomware on Build / Deploy System

**Likelihood**: Low
**Impact**: Medium (deployment halted, code at risk)

**Detection**:
- Cannot deploy
- Unusual file encryption activity
- Ransom note

**Recovery steps**:
1. Isolate affected systems (disconnect from network)
2. Do not pay ransom
3. Restore from clean Git history (we own code)
4. Rebuild CI/CD pipeline from scratch
5. Re-rotate all secrets
6. Post-incident: review endpoint security

**Owner**: Engineering Lead + CTO

---

## 5. Recovery Procedures (Detailed)

### Procedure 1: Restore D1 Database from Backup

```bash
# List available backups
wrangler d1 backup list <DATABASE_NAME>

# Restore specific backup to new database
wrangler d1 backup restore <DATABASE_NAME> --backup-id=<ID>

# Verify restoration
wrangler d1 execute <NEW_DATABASE_NAME> --command="SELECT COUNT(*) FROM tenants"

# If verified, swap binding in wrangler.toml
# Then deploy
wrangler deploy
```

**Verification**:
- [ ] Row counts match pre-disaster (or expected delta)
- [ ] Sample queries return expected data
- [ ] No schema corruption
- [ ] No data corruption (checksums match for critical tables)

**Estimated time**: 1-2 hours

---

### Procedure 2: Restore R2 Bucket from Backup

```bash
# List objects in backup bucket
wrangler r2 object list <BACKUP_BUCKET>

# Restore specific prefix
wrangler r2 object copy <BACKUP_BUCKET>/<PREFIX>/ <PRIMARY_BUCKET>/<PREFIX>/

# Or full restore
aws s3 sync s3://<BACKUP_BUCKET> s3://<PRIMARY_BUCKET> --delete
```

**Verification**:
- [ ] File counts match
- [ ] Sample files download successfully
- [ ] Checksums match (critical files)
- [ ] Public URLs work

**Estimated time**: 30 min - 4 hours (depends on bucket size)

---

### Procedure 3: Rotate All Secrets

```bash
# 1. Generate new secrets
NEW_STRIPE_KEY=...
NEW_JWT_SECRET=...

# 2. Update via Cloudflare dashboard or API
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put JWT_SECRET
# ... etc for all secrets

# 3. Verify new secrets work
wrangler dev

# 4. Revoke old secrets (in source systems like Stripe)
# Done manually in Stripe dashboard
```

**Estimated time**: 30-60 minutes

---

### Procedure 4: Rebuild from Git + Configuration

If entire Cloudflare account is lost:

```bash
# 1. Clone source code
git clone git@github.com:sophia-ai-factory/sophia-ai-factory.git

# 2. Re-create Cloudflare account (if needed)
# Contact support for assistance

# 3. Re-create D1 databases
wrangler d1 create <DB_NAME>
# Update wrangler.toml with new DB IDs

# 4. Re-create R2 buckets
wrangler r2 bucket create <BUCKET_NAME>

# 5. Restore data from backups (Procedure 1 + 2)

# 6. Re-set all secrets (Procedure 3)

# 7. Re-configure DNS (point to new Cloudflare account)

# 8. Deploy
wrangler deploy

# 9. Verify all services
```

**Estimated time**: 8-24 hours

---

## 6. Communication During DR

### Internal

| Event | Channel | Cadence |
|-------|---------|---------|
| DR activated | Slack `#sec-incidents` | Immediate |
| Status updates | Slack war room | Every 30 min |
| Resolution | Slack + email | When complete |

### Customer

| Event | Channel | Cadence |
|-------|---------|---------|
| DR activated | Status page | Within 15 min |
| Status updates | Status page + Slack | Every 30 min |
| Resolution + post-mortem | Email + blog | Within 48 hours |

### Regulatory

- GDPR breach notification: ≤72 hours if data breach confirmed
- Other per legal counsel advice

---

## 7. DR Test Schedule

| Test | Frequency | Last | Next | Owner |
|------|-----------|------|------|-------|
| D1 backup restore | Quarterly | {{LAST}} | {{NEXT}} | Engineering Lead |
| R2 backup restore | Quarterly | {{LAST}} | {{NEXT}} | Engineering Lead |
| Secrets rotation drill | Annually | {{LAST}} | {{NEXT}} | Engineering Lead |
| Full DR exercise | Annually | {{LAST}} | {{NEXT}} | CTO |
| Tabletop exercise | Annually | {{LAST}} | {{NEXT}} | CTO |

### Test documentation

Each test produces:
- Test plan (before)
- Test execution log (during)
- Test results (after)
- Action items (if gaps found)

Stored at: `tenants/_internal/dr-tests/`

---

## 8. Post-Recovery

After successful DR:

1. **Verify**: All services at 100% functionality
2. **Monitor**: Increased monitoring for 7 days
3. **Communicate**: Resolution notification to all stakeholders
4. **Document**: Timeline + decisions made
5. **Review**: What worked, what didn't
6. **Improve**: Update DR plan with learnings
7. **Test**: Schedule accelerated next test if major gap found

---

## 9. Tools and Access

### Required access for DR

- Cloudflare account (owner + admin roles)
- Stripe dashboard (admin)
- GitHub (admin)
- Slack (admin)
- AWS (if used for backups)

### Backup access

- Backup credentials stored in 1Password (owner + 2 backups)
- Break-glass account: {{EMERGENCY_ACCOUNT}} (stored in safe)

### Communication

- Slack workspace owner: CEO
- Email: CEO personal + team distribution list
- Phone tree for off-hours

---

## 10. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CEO | Long Tho | 2026-06-12 | |
| CTO | | | |
| Engineering Lead | | | |

---

**Last reviewed**: 2026-06-12
**Next review**: 2027-06-12 or after first DR test
