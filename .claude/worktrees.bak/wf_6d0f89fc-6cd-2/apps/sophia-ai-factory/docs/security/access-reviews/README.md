# Quarterly Access Reviews

Quarterly access certification for SOC 2 CC7.2 (logical access review).

## Process

1. **Generate report** by running the access review script:
   ```bash
   cd apps/sophia-ai-factory
   node scripts/security/quarterly-access-review.js --quarter Q3-2026
   ```

2. **Review with compliance officer** — verify all admin/enterprise users are active and authorized.

3. **Document actions** — revoke access for departed employees, rotate API keys, update least-privilege assignments.

4. **Commit the report** to this directory as evidence of quarterly review:
   ```bash
   git add docs/security/access-reviews/Q3-2026.md
   git commit -m "docs: add Q3-2026 access review report"
   ```

5. **Sign off** — obtain signatures from Compliance Officer and CTO in the markdown document.

6. **Archive** — keep signed copy in secure location (SharePoint/Google Drive) for 7+ years.

## Retention

Per legal hold requirements, all quarterly access review documents must be retained for a minimum of **7 years**.

## Evidence Package for Auditor

- [ ] Completed markdown review document (committed to git)
- [ ] Executed script output (CSV)
- [ ] Signed PDF (if required for external audit)
- [ ] Git commit showing review completion date

## Automation

The review script queries:
- D1 database `users` table for admin/enterprise/master tier accounts
- GitHub API for repository collaborators with push access

Run quarterly (March, June, September, December) to maintain continuous compliance.
