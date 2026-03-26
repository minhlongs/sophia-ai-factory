# Disaster Recovery Plan — Sophia AI Factory

## Recovery Objectives

| Metric | Target | Justification |
|--------|--------|---------------|
| RPO (Recovery Point Objective) | 24 hours | D1 daily backups via Cloudflare |
| RTO (Recovery Time Objective) | 4 hours | Redeploy from git + D1 restore |

## Architecture Overview

- **Compute**: Cloudflare Workers (serverless, auto-scaling, multi-region)
- **Database**: Cloudflare D1 (SQLite, single-region with automatic backups)
- **Storage**: Cloudflare R2 (ISR cache, static assets)
- **DNS**: Cloudflare DNS (sophia.agencyos.network)
- **Code**: GitHub (longtho638-jpg/sophia-ai-factory)

## Backup Strategy

### Database (D1)
- Cloudflare provides automatic daily backups for D1
- Manual export: `npx wrangler d1 export sophia-raas-db --remote --output backup.sql`
- Recommended: weekly manual export to external storage

### Code
- GitHub repository with full history
- Branch protection on `main` (required reviews, no force push)
- All deployments triggered via `git push origin main`

### Secrets
- Stored in Cloudflare Workers secrets (encrypted at rest)
- Document all required secrets in `.env.example` (no actual values)
- Required secrets: JWT_SECRET=REDACTED, ANTHROPIC_API_KEY, RESEND_API_KEY, POLAR_ACCESS_TOKEN, HEYGEN_API_KEY

## Recovery Procedures

### Scenario 1: CF Workers Down (Cloudflare outage)
1. Wait for Cloudflare status updates (status.cloudflare.com)
2. Cloudflare has 99.99% SLA — outages are rare and brief
3. No action needed — services auto-recover

### Scenario 2: D1 Data Corruption
1. Identify last known good state via transaction logs
2. Restore from Cloudflare automatic backup: Cloudflare Dashboard > D1 > Backups
3. Or restore from manual export: `npx wrangler d1 execute sophia-raas-db --remote --file=backup.sql`
4. Verify data integrity: check user count, org count, transaction sums

### Scenario 3: Deployment Break (bad code pushed)
1. Identify broken commit via `gh run list`
2. Revert: `git revert <bad-commit> && git push origin main`
3. Wait for GitHub Actions to redeploy
4. Verify: `curl -sI https://sophia.agencyos.network`

### Scenario 4: Secret Compromise
1. Rotate compromised secret immediately
2. Update in CF Workers: `npx wrangler secret put <SECRET_NAME>`
3. Invalidate old JWT tokens if JWT_SECRET=REDACTED compromised (all users must re-login)
4. Audit access logs in Cloudflare dashboard

## Team Roles

| Role | Responsibility | Contact |
|------|---------------|---------|
| Admin | Full system access, secret rotation | billwill.mentor@gmail.com |
| DevOps | Deploy, D1 access, monitoring | System operator |

## Quarterly DR Drill Checklist
- [ ] Export D1 backup manually
- [ ] Verify backup can be restored to local D1
- [ ] Test deployment rollback procedure
- [ ] Review and rotate secrets older than 90 days
- [ ] Verify monitoring alerts are active
