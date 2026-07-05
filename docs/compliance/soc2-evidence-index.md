# SOC 2 Evidence Index — Sophia AI Factory

> **Last updated:** 2026-07-05
> **Scope:** Sophia AI Factory production environment (Cloudflare Workers, D1, R2)
> **Controls framework:** AICPA Trust Services Criteria — Security, Availability, Confidentiality

## 1. Controls Automatically Satisfied

### 1.1 Encryption at Rest (CC6.1)

| Control | Status | Evidence |
|---------|--------|----------|
| Data encrypted at rest in database | **Satisfied** | Cloudflare D1 encrypts all data at rest using AES-256. No operator action required. |
| Object storage encrypted at rest | **Satisfied** | Cloudflare R2 encrypts all objects at rest with AES-256. |
| Credential secrets encrypted | **Satisfied** | User API keys stored encrypted using `@/tree/credentials/credential-encryption.ts` (AES-256-GCM with per-key nonce). |

### 1.2 Encryption in Transit (CC6.1)

| Control | Status | Evidence |
|---------|--------|----------|
| All external traffic over TLS 1.2+ | **Satisfied** | Cloudflare terminates TLS at edge (TLS 1.3 by default). All origin traffic is over Cloudflare's encrypted network. |
| API endpoints enforce HTTPS | **Satisfied** | Cloudflare Workers — HTTPS-only by default; no plaintext HTTP reachable. |

### 1.3 Access Controls — Platform Level (CC6.3)

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication required for all user-facing routes | **Satisfied** | Middleware auth guard at `src/middleware.ts` — all routes except API health/version and auth callbacks require session. |
| Role-based tier gating | **Satisfied** | Tier gates (BASIC / PREMIUM / ENTERPRISE / MASTER) enforced via `getUserTier()` in server components and `requireMasterTier()` for admin routes. |
| Session management | **Satisfied** | Better Auth v1.6.14 — email + password sessions with cookie-based auth. Session expiry enforced server-side. |

### 1.4 Audit Logging (CC7.2)

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication events logged | **Partially satisfied** | Login/register events captured in D1 `audit_log` table (`src/tree/audit/`). Session events tracked but not stored persistently. |
| Admin actions logged | **Partially satisfied** | Enterprise admin audit log available via `src/land/audit-log/` for MASTER-tier events. Not yet covering all org-level mutations. |
| Data access events logged | **Not implemented** | Read operations are not logged. Only write operations in sensitive modules (billing, credentials) are captured. |

## 2. Evidence Collection Scripts

### Available scripts

- `scripts/verify-production-deploy.sh` — Deploy verification, SHA match, HTTP health check
- `scripts/apply-migrations.sh` — D1 migration application tracker
- `tests/e2e/admin.spec.ts` — E2E admin flow tests (playwright)

### Missing

- **User access review report** — No script to export current user list with roles and last login timestamps
- **Encryption key rotation report** — No automated key rotation attestation
- **Access log export** — No aggregation script for audit log → SIEM export

## 3. Gaps to Close

### Critical (must-fix before SOC 2 audit)

| Gap | Target | Effort |
|-----|--------|--------|
| No formal incident response plan documented | Create `docs/compliance/incident-response-plan.md` | L |
| No user access review process | Implement quarterly access review workflow | M |
| Audit log retention policy not documented | Define and document 90-day retention in D1 | L |

### Important (should-fix)

| Gap | Target | Effort |
|-----|--------|--------|
| No vulnerability scanning schedule | Integrate monthly `npm audit` → D1 report | M |
| No backup restore test procedure | Document and perform quarterly restore drill | M |
| Penetration testing not performed | Schedule annual third-party pen test | L |

### Nice-to-have

| Gap | Target | Effort |
|-----|--------|--------|
| SIEM integration for audit log export | JSON export → customer's SIEM via webhook | H |
| Automated evidence collection dashboard | Dedicated `/dashboard/admin/compliance` page | M |

## 4. Evidence Location Index

| Evidence Artifact | Location | Format |
|-------------------|----------|--------|
| Authentication code | `src/seed/auth/` | TypeScript |
| Authorization code (RBAC) | `src/seed/auth/rbac.ts` | TypeScript |
| Encryption code (credentials) | `src/tree/credentials/credential-encryption.ts` | TypeScript |
| Audit log module | `src/tree/audit/` | TypeScript |
| Tier gate | `src/seed/auth/require-master-tier.ts` | TypeScript |
| Admin IAM controls | `src/app/[locale]/dashboard/admin/` | TypeScript / React |
| Deploy verification | `scripts/verify-production-deploy.sh` | Shell |
| Infrastructure config | `wrangler.toml` | TOML |
| E2E tests | `tests/e2e/` | Playwright |
| CI/CD gate | `.github/workflows/test.yml.disabled` | YAML |

## 5. Next Review

**Next evidence review:** 2026-10-01 (quarterly)

**Accountable:** Platform operator (MASTER-tier admin)

---

*End of document*
