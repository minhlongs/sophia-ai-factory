# SOC2 Type I Compliance Guide — Sophia AI Factory

> Hướng dẫn triển khai và duy trì SOC2 Type I compliance cho Sophia AI Factory.

**Phiên bản:** 1.0  
**Cập nhật lần cuối:** 2026-06-18  
**Trạng thái:** Evidence Pack Finalized (Barr Advisory đã chọn)  
**Auditor:** Barr Advisory  
**Target:** SOC2 Type I (Security, Availability, Confidentiality)

---

## 1. Tổng quan

SOC2 (Service Organization Control 2) là framework audit bảo mật và compliance cho SaaS providers. Sophia AI Factory đang pursuit SOC2 Type I certification (point-in-time controls assessment).

### 1.1. Trust Services Criteria

| Criteria | Status | Description |
|----------|--------|-------------|
| **Security** | ✅ Complete | Hệ thống và dữ liệu được bảo vệ khỏi unauthorized access |
| **Availability** | ✅ Complete | SLA 99.9% uptime, disaster recovery plan |
| **Confidentiality** | ✅ Complete | Dữ liệu khách hàng được bảo mật, encryption at rest & in transit |
| **Processing Integrity** | N/A | Không áp dụng (data processing không phải core service) |
| **Privacy** | Partial | GDPR compliance đã hoàn thành, PII handling docs cần bổ sung |

---

## 2. Evidence Pack (Finalized 2026-06-18)

### 2.1. Pack Location

```
.sophia-factory/
└── audit/
    └── soc2/
        ├── evidence-index.md
        ├── controls-mapping.md
        ├── vendor-soc2-reports/
        │   ├── aws-soc2.pdf
        │   ├── cloudflare-soc2.pdf
        │   ├── resend-soc2.pdf
        │   ├── sentry-soc2.pdf
        │   ├── stripe-soc2.pdf
        │   └── upstash-soc2.pdf
        └── internal-controls/
            ├── access-control.md
            ├── change-management.md
            ├── data-protection.md
            ├── incident-response.md
            └── monitoring.md
```

### 2.2. Evidence Components

1. **Vendor SOC2 Reports** — Từ tất cả vendors trong supply chain:
   - AWS (infrastructure)
   - Cloudflare (Workers, D1, R2)
   - Resend (email)
   - Sentry (error tracking)
   - Stripe (payments, although Polar rejected)
   - Upstash (Redis, if used)

2. **Internal Controls Documentation** — 87.5/100 architecture score maintained
   - Access control (RBAC, admin gates)
   - Change management (deploy guard 2-of-3)
   - Data protection (encryption, BYOK)
   - Incident response (runbooks)
   - Monitoring (Honeycomb OTEL)

3. **Controls Mapping** — Cross-reference SOP với SOC2 criteria

---

## 3. Controls Implementation

### 3.1. Access Control (CC6.1-CC6.6)

**Logical Access:**
- Better Auth với session-based auth
- Role-based: `admin`, `user`, `system`
- Admin routes yêu cầu `role === 'admin'`
- Cron routes yêu cầu `CRON_SECRET` bearer token

**Physical Access:**
- Cloudflare manages physical security (SOC2 covered)
- No on-prem servers

**Evidence:**
- `src/seed/auth/better-auth-session.ts` — auth implementation
- `src/app/api/admin/**/route.ts` — admin gates
- `src/app/api/cron/**/route.ts` — cron auth

---

### 3.2. Change Management (CC8.1-CC8.2)

**Deploy Guard (Multi-Operator Approval):**
- Tất cả deploys cần 2-of-3 operator approvals
- Pre-push hook kiểm tra approvals
- Hash-chain audit log

**Process:**
1. Developer push → create approval request
2. Operators review via `/api/admin/deploy-guard`
3. 2 approvals → deploy allowed
4. SHA recorded in audit log

**Evidence:**
- `src/app/api/admin/deploy-guard/**` — approval system
- `.claude/rules/sophia-deploy-verify.md` — deploy gate rules
- `scripts/pre-deploy-gate.mjs` — pre-deploy verification

---

### 3.3. Data Protection (CC6.7-CC6.8)

**Encryption at Rest:**
- D1 database: SQLite encryption (Cloudflare-managed)
- R2 storage: Server-side encryption (SSE-S3)
- BYOK keys: AES-GCM encrypted với `BYOK_MASTER_KEY`

**Encryption in Transit:**
- All traffic: HTTPS (TLS 1.3)
- Cloudflare Tunnel cho staging (optional)
- HSTS header enforced

**Evidence:**
- `src/lib/byok/byok-crypto.ts` — key encryption
- `wrangler.toml` — encryption config
- `docs/honeycomb-configuration.md` — monitoring

---

### 3.4. Incident Response (CC7.2-CC7.3)

**Runbooks:**
- `docs/incident-response.md` — P0-P3 severity matrix
- `docs/runbooks/` — specific runbooks (secret rotation, activation, etc.)
- `apps/sophia-ai-factory/docs/` — engineering-internal runbooks

**Slack Alerts:**
- `#alerts` — P0-P2 incidents
- `#dev-alerts` — staging errors
- Telegram fallback cho P0

**Evidence:**
- `docs/observability-runbook.md` — monitoring setup
- `docs/apm-runbook.md` — Honeycomb dashboards
- `docs/secret-rotation-runbook.md` — credential rotation

---

### 3.5. Monitoring (CC4.1-CC4.2)

**OpenTelemetry Integration:**
- Staging: 100% sampling
- Production: 1% sampling (cost control)
- Honeycomb datasets: `sophia-staging`, `sophia-prod`

**Key Metrics:**
- Error rate < 5%
- p95 latency < 500ms
- Uptime > 99.9%

**Evidence:**
- `docs/honeycomb-configuration.md` — full dashboard & alerts config
- `apps/sophia-ai-factory/src/lib/telemetry/` — OTEL setup

---

## 4. Vendor SOC2 Reports

| Vendor | Report Date | Coverage | Location |
|--------|-------------|----------|----------|
| AWS | 2026-03 | Security, Availability | `vendor-soc2-reports/aws-soc2.pdf` |
| Cloudflare | 2026-04 | Security, Availability, Confidentiality | `vendor-soc2-reports/cloudflare-soc2.pdf` |
| Resend | 2026-02 | Security, Availability | `vendor-soc2-reports/resend-soc2.pdf` |
| Sentry | 2026-01 | Security, Confidentiality | `vendor-soc2-reports/sentry-soc2.pdf` |
| Stripe | 2026-05 | Security, Availability | `vendor-soc2-reports/stripe-soc2.pdf` |
| Upstash | 2026-03 | Security, Availability | `vendor-soc2-reports/upstash-soc2.pdf` |

---

## 5. Certification Timeline

| Milestone | Status | Date |
|-----------|--------|------|
| Auditor selection | ✅ Complete | 2026-06-10 |
| Controls walkthrough | ✅ Complete | 2026-06-12 |
| Vendor reports collected | ✅ Complete | 2026-06-15 |
| Evidence pack compiled | ✅ Complete | 2026-06-18 |
| Auditor review | 🔄 In Progress | Pending |
| SOC2 Type I report issued | ⏳ Pending | Q3 2026 |

---

## 6. Ongoing Compliance

### 6.1. Quarterly Reviews

- [ ] Review vendor SOC2 reports (renewal dates)
- [ ] Update evidence pack với thay đổi architecture
- [ ] Drill incident response (tabletop exercise)
- [ ] Audit access logs (admin actions, cron runs)

### 6.2. Annual Recertification

- Full audit repeat each year
- Evidence pack refresh
- Control testing
- Report issuance

---

## 7. Customer Communication

### 7.1. SOC2 Report Distribution

Khi report issued:
- Upload to secure customer portal
- Email announcement đến enterprise customers
- Add badge tới website (nếu approved bởi auditor)

### 7.2. Data Processing Addendum (DPA)

DPA đã sẵn sàng trong `docs/compliance/dpa-template.md` — có thể ký với customers theo request.

---

## 8. Audit Checklist

### Pre-Audit

- [ ] All evidence files indexed trong `evidence-index.md`
- [ ] Vendor SOC2 reports up-to-date (không quá 12 months)
- [ ] Access logs retained 90 days minimum
- [ ] Deploy guard audit log đầy đủ từ go-live
- [ ] Incident logs (postmortems) documented

### During Audit

- [ ] Provide auditor access to Honeycomb (read-only)
- [ ] Share D1 backup để sampling test
- [ ] Walk through deploy flow (screen recording nếu remote)
- [ ] Interview operators về runbook adherence

### Post-Audit

- [ ] Address any control gaps (30 days)
- [ ] Update evidence pack với remediation evidence
- [ ] Receive final SOC2 Type I report
- [ ] Distribute to customers as appropriate

---

## 9. Related Documents

- [Development Roadmap](../development-roadmap.md) — SOC2 phase tracking
- [Incident Response](../incident-response.md) — incident handling
- [Deployment Guide](../deployment-guide.md) — deploy guard details
- [Honeycomb Configuration](../honeycomb-configuration.md) — monitoring setup
- [Security](../SECURITY.md) — security posture

---

**Auditor Contact:** Barr Advisory (barr.advisory)  
**Next Review:** Q3 2026 (Type I report expected)

