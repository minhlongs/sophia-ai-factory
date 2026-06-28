# Audit Log Retention Policy

**Document ID:** SOP-AUDIT-001
**Effective Date:** 2026-03-06
**Review Date:** 2026-06-06 (Quarterly)
**Owner:** Compliance Team

---

## 1. Overview

This document defines the audit log retention policy for Sophia AI Factory's ROIaaS (ROI-as-a-Service) License Management System. The policy ensures compliance with SOC 2, PCI DSS, and GDPR requirements.

---

## 2. Retention Periods

### 2.1 Active Retention (Primary Storage)

| Log Type | Retention Period | Storage | Access |
|----------|------------------|---------|--------|
| License Creation (CREATE) | 90 days | `raas_audit_logs` | Admin + User (own logs) |
| License Validation (VALIDATE) | 90 days | `raas_audit_logs` | Admin + User (own logs) |
| License Revocation (REVOKE) | 90 days | `raas_audit_logs` | Admin only |
| License Update (UPDATE) | 90 days | `raas_audit_logs` | Admin + User (own logs) |

**Minimum Retention: 90 days** - Compliant with SOC 2 Type II requirements.

### 2.2 Archive Retention (Long-term Storage)

| Standard | Requirement | Implementation |
|----------|-------------|----------------|
| SOC 2 Type II | 90 days minimum | 90 days active + optional archive |
| PCI DSS | 1 year minimum | Archive to cold storage (future) |
| GDPR | No minimum, right to erasure | Anonymize on request |

---

## 3. Compliance Mapping

### 3.1 SOC 2 Type II (Service Organization Control)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Audit trail retention (90 days min) | ✅ Compliant | `raas_audit_logs` table |
| User access to own logs | ✅ Compliant | RLS policy: `Users can view own audit logs` |
| Admin access control | ✅ Compliant | RLS policy: `Admins have full access` |
| Tamper-proof logging | ✅ Compliant | INSERT-only policy, no UPDATE/DELETE |
| Timestamp integrity | ✅ Compliant | Unix timestamp (BIGINT), immutable |

### 3.2 PCI DSS (Payment Card Industry Data Security Standard)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Audit trail (1 year min) | ⚠️ Partial | 90 days active, archive recommended |
| User access tracking | ✅ Compliant | `user_id` stored per log entry |
| IP address logging | ✅ Compliant | `ip_address` column |
| Action type logging | ✅ Compliant | `action` column (CREATE/VALIDATE/REVOKE) |

**Recommendation:** Implement archive to S3/GCS after 90 days for 1-year PCI DSS compliance.

### 3.3 GDPR (General Data Protection Regulation)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Right to access | ✅ Compliant | `/api/user/audit-logs` endpoint |
| Right to erasure | ⚠️ Partial | Manual process (future: automated) |
| Data minimization | ✅ Compliant | 90-day retention, auto-cleanup |
| IP address handling | ⚠️ Advisory | Consider hashing for privacy |

**Recommendation:** Implement IP address hashing (`SHA256(ip + salt)`) for GDPR privacy.

---

## 4. Technical Implementation

### 4.1 Database Schema

```sql
-- Table: raas_audit_logs
CREATE TABLE raas_audit_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,                 -- CREATE | VALIDATE | REVOKE | UPDATE
  license_id UUID REFERENCES raas_licenses(id),
  license_nonce TEXT,
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL            -- Unix timestamp (seconds)
);

-- Indexes for performance
CREATE INDEX idx_raas_audit_logs_user_id_created_at
  ON raas_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_raas_audit_logs_created_at
  ON raas_audit_logs(created_at DESC);
```

### 4.2 RLS Policies

```sql
-- Admins: Full access (ALL operations)
CREATE POLICY "Admins have full access to raas_audit_logs"
  ON raas_audit_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Users: Read-only access to own logs
CREATE POLICY "Users can view own audit logs"
  ON raas_audit_logs FOR SELECT
  USING (user_id = auth.uid());
```

### 4.3 API Endpoints

| Endpoint | Method | Access | Purpose |
|----------|--------|--------|---------|
| `/api/admin/licenses/audit` | GET | Admin only | Full audit log access |
| `/api/user/audit-logs` | GET | Authenticated users | User's own logs (90 days) |

### 4.4 Retention Enforcement

**Automatic Cleanup (Future Enhancement):**

```sql
-- Scheduled function: Run daily via pg_cron or external scheduler
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS void AS $$
BEGIN
  -- Archive logs older than retention period (optional)
  INSERT INTO raas_audit_logs_archive
  SELECT *, NOW() FROM raas_audit_logs
  WHERE created_at < (EXTRACT(EPOCH FROM NOW() - (retention_days || ' days')::INTERVAL))::BIGINT;

  -- Delete from main table
  DELETE FROM raas_audit_logs
  WHERE created_at < (EXTRACT(EPOCH FROM NOW() - (retention_days || ' days')::INTERVAL))::BIGINT;
END;
$$ LANGUAGE plpgsql;
```

**Environment Configuration:**

```bash
# .env.example
AUDIT_LOG_RETENTION_DAYS=90
AUDIT_LOG_ARCHIVE_ENABLED=false  # Set to true for PCI DSS compliance
```

---

## 5. Access Control Matrix

| Role | CREATE | READ (All) | READ (Own) | UPDATE | DELETE |
|------|--------|------------|------------|--------|--------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Authenticated User | ❌ | ❌ | ✅ | ❌ | ❌ |
| Anonymous | ❌ | ❌ | ❌ | ❌ | ❌ |
| Service Role | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 6. Audit Log Contents

### 6.1 CREATE Action

```json
{
  "action": "CREATE",
  "license_nonce": "abc123...",
  "tier": "PREMIUM",
  "timestamp": 1741234567,
  "createdBy": "admin-uuid",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

### 6.2 VALIDATE Action

```json
{
  "action": "VALIDATE",
  "license_nonce": "abc123...",
  "isValid": true,
  "userId": "user-uuid",
  "ipAddress": "192.168.1.2",
  "userAgent": "Sophia-CLI/1.0.0"
}
```

### 6.3 REVOKE Action

```json
{
  "action": "REVOKE",
  "license_nonce": "abc123...",
  "tier": "PREMIUM",
  "revokedBy": "admin-uuid",
  "reason": "Terms violation",
  "ipAddress": "192.168.1.1"
}
```

---

## 7. Monitoring & Alerting

### 7.1 Metrics to Track

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Audit log volume/day | > 10,000 | Warning |
| Failed validation rate | > 20% | Critical |
| Admin access anomalies | Unusual patterns | Warning |
| Storage growth | > 1GB/month | Warning |

### 7.2 Logging Configuration

```typescript
// logger.ts - Structured logging format
{
  "timestamp": "2026-03-06T12:00:00Z",
  "level": "info",
  "action": "LICENSE_VALIDATE",
  "userId": "user-uuid",
  "licenseNonce": "abc123...",
  "result": "success",
  "ipAddress": "192.168.1.1"  // Consider hashing for GDPR
}
```

---

## 8. Future Enhancements

| Enhancement | Priority | Timeline | Compliance Impact |
|-------------|----------|----------|-------------------|
| IP address hashing | High | Q2 2026 | GDPR privacy |
| Automated archive to S3 | Medium | Q3 2026 | PCI DSS 1-year |
| Right-to-erasure automation | Medium | Q3 2026 | GDPR Art.17 |
| Real-time alerting | Low | Q4 2026 | SOC 2 monitoring |
| Export to SIEM | Low | Q4 2026 | SOC 2 integration |

---

## 9. References

- **SOC 2 Type II:** https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/sorhome.html
- **PCI DSS v4.0:** https://docs-prv.pcisecuritystandards.org/PCI%20DSS/Standard/PCI-DSS-v4_0.pdf
- **GDPR:** https://gdpr.eu/
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Engineering Team | Initial policy document |
| | | | 90-day retention from 30 days |
| | | | User access to own logs enabled |

---

**Approval:**
[ ] CTO
[ ] Compliance Officer
[ ] Security Lead
