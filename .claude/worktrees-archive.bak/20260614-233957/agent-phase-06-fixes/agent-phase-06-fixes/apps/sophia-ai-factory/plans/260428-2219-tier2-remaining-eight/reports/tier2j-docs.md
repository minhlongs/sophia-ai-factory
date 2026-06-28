# TIER-2J Report — Infrastructure Hardening Docs + Scripts

**Task:** TIER-2J — Infrastructure Hardening (DNS, R2 lifecycle, GH secrets), Wave 2 DOCS+SCRIPTS  
**Date:** 2026-04-28  
**Status:** COMPLETE (docs + scripts only, no actual hardening applied)

---

## Summary

Created comprehensive infrastructure hardening documentation and three idempotent audit scripts for Sophia AI Factory. All deliverables are bilingual (EN + VI) and follow the non-tech CEO persona (no developer jargon in key sections).

---

## Deliverables

### 1. Documentation: `docs/infra-hardening.md` (260 lines)

**Structure:**
- DNS Hardening (Cloudflare): CAA, DNSSEC, SPF/DKIM/DMARC
- R2 Lifecycle Policy: 30-day cache + 7-day health-check rotation
- GitHub Secrets Inventory: 8 required secrets with rotation cadence (90-day API tokens, 180-day encryption keys)
- Worker Bindings Audit: Verification commands for D1, R2, KV
- Bilingual VI+EN sections with tables, code examples, verification checklists

**Key Content:**
- Rotation schedule: 90-day (CLOUDFLARE_API_TOKEN, SENTRY_AUTH_TOKEN, NOWPAYMENTS_IPN_SECRET, OPENROUTER_API_KEY)
- Incident response: Leak revocation procedure (<5 min immediate, <15 min provider, <30 min redeployment)
- Provider-specific instructions (Cloudflare dashboard, Sentry, NOWPayments, GitHub Actions)

---

### 2. Audit Scripts (3x, in `scripts/infra/`)

All scripts are executable (chmod +x), dry-run safe, and idempotent.

#### `audit-dns.sh` (80 lines)
- Validates: A, AAAA, CAA, MX, TXT (SPF/DMARC), NS records
- DNSSEC chain verification (ad flag check)
- Output: `audit-results/audit-dns-{date}.log`
- No modifications to DNS

#### `audit-r2-lifecycle.sh` (60 lines)
- Checks bucket existence and auth
- Lists current lifecycle rules
- Recommends fixes if rules missing
- Output: `audit-results/audit-r2-lifecycle-{date}.log`
- No modifications to bucket

#### `audit-github-secrets.sh` (80 lines)
- Compares actual secrets against required list (parsed from `docs/infra-hardening.md`)
- Reports missing, extra, legacy secrets
- Displays rotation schedule per secret
- Exit code = count of missing secrets (CI-safe)
- Output: `audit-results/audit-github-secrets-{date}.log`
- No modifications to GitHub

---

### 3. System Architecture Update

**File:** `docs/system-architecture.md`

Added new section "Infrastructure Hardening" (25 lines) after "Operations & Disaster Recovery":
- Links to full `infra-hardening.md` doc
- Brief 1-liner per control (DNS, R2, GitHub, scripts)
- Summarizes audit script locations

---

## Technical Notes

### Bilingual Approach
- EN section first, VI section second (parallel structure)
- Tables use EN headers + bilingual content
- Code examples (dig, wrangler, gh commands) are language-agnostic
- Client-facing checklist items simple (e.g., "✓ A record points to Cloudflare IP")

### Script Idempotency
- All scripts read-only (no mutations)
- Can be run hourly via cron without side effects
- Each run generates timestamped log file (`{audit_type}-{YYYYMMDD_HHMMSS}.log`)
- Output directory: `audit-results/` (created on-demand)

### No Data Breaches
- Scripts never display secret values (only names)
- GitHub script uses `gh secret list` (returns names only, not values)
- Output is safe to commit to Git or share in logs

---

## Out of Scope (Preserved)

- ✗ No actual DNS changes (CAA/DNSSEC still TODO)
- ✗ No R2 lifecycle policy applied yet
- ✗ No GitHub secrets rotation executed
- ✗ No source code modifications
- ✗ No CI/CD workflow changes

**Next Steps:** User runs audit scripts, reviews baseline, then applies hardening (scheduled for TIER-2K Wave 3).

---

## Files Created/Modified

**Created:**
1. `/docs/infra-hardening.md` (260 lines) — Main doc
2. `/scripts/infra/audit-dns.sh` (executable) — DNS audit
3. `/scripts/infra/audit-r2-lifecycle.sh` (executable) — R2 audit
4. `/scripts/infra/audit-github-secrets.sh` (executable) — Secrets audit

**Modified:**
1. `/docs/system-architecture.md` — Added Infrastructure Hardening section

---

## Quality Checks

- [x] All scripts are executable (`chmod +x`)
- [x] Scripts are dry-run safe (read-only operations)
- [x] Documentation under 300 lines (260 actual)
- [x] Bilingual content (EN + VI)
- [x] Verified script paths exist in `wrangler.toml` and `.env.production.example`
- [x] No secrets exposed in docs or scripts
- [x] Links to actual GitHub repo (`longtho638-jpg/sophia-ai-factory`) verified
- [x] Binding names match wrangler.toml (`NEXT_INC_CACHE_R2_BUCKET` = `sophia-ai-factory-opennext-cache`)

---

## Usage

### Quick Start
```bash
# Run all audits
scripts/infra/audit-dns.sh
scripts/infra/audit-r2-lifecycle.sh
scripts/infra/audit-github-secrets.sh

# View results
ls -la audit-results/

# Review baseline before hardening
cat docs/infra-hardening.md
```

### Integration
- Monthly: Add `scripts/infra/audit-*.sh` to cron jobs
- Quarterly: Review DR plan + hardening checklist (see `docs/disaster-recovery.md`)
- On incident: Follow revocation procedure in `docs/infra-hardening.md` → GitHub Secrets section

---

## Unresolved Questions

None. All requirements met within scope (docs + scripts only, no actual hardening applied).
