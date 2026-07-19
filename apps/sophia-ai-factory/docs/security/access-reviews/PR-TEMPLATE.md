# Quarterly Access Review — PR Template

**Quarter:** Q2 2026  
**Date:** 2026-06-XX  
**Reviewer:** Compliance Officer  
**Approver:** CTO

---

## Summary

This PR contains the quarterly access review report for Sophia AI Factory, in accordance with SOC 2 CC6.1 requirements.

**Report files:**
- `docs/security/access-reviews/Q2-2026.md` — Review summary with sign-off section
- `docs/security/access-reviews/Q2-2026.csv` — Machine-readable data

**Period covered:** 2026-04-01 to 2026-06-30  
**Next review:** 2026-09-30 (Q3)

---

## Review Findings

### Total Admin/Enterprise Users: X

- Active admin accounts: N
- Enterprise tier customers with elevated access: N
- GitHub collaborators with write access: N

### Actions Taken

- [ ] No changes needed — all users active and authorized
- [ ] Revoked access for departed employees: `user_id_1, user_id_2`
- [ ] Notified admins to re-authenticate (session expiry)
- [ ] Rotated admin API keys (if applicable)

### Exceptions

| User | Reason | Mitigation |
|------|--------|------------|
| (none) | — | — |

**If exceptions exist, describe remediation plan:**

---

## Compliance Checklist

- [ ] All admin users have completed security training (last 12 months)
- [ ] No departed employees retain access (HR confirmed offboarding checklist)
- [ ] MFA enforced on all admin accounts (GitHub + Cloudflare)
- [ ] Session timeouts configured (24h max)
- [ ] Privileged access logs reviewed (no anomalies)
- [ ] API keys for admin services rotated if compromised

---

## Sign-off

**Compliance Officer:** ___________________ Date: _________

**CTO:** ___________________ Date: _________

---

## Post-merge Actions

- [ ] Notify affected users of continued access (or revocation)
- [ ] Update user access matrix in `docs/security/access-matrix.md`
- [ ] Schedule Q3 review for 2026-09-30
