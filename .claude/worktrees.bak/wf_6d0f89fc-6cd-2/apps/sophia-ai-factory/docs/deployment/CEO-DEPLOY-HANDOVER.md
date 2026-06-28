# Production Deployment Summary & CEO Handover
# Tóm tắt Triển khai Sản xuất & Bàn giao CEO

---

**Version**: 1.0  
**Ngày**: 2026-06-15  
**Status**: ✅ PRODUCTION GREEN  
**SHA**: `$(git rev-parse HEAD | cut -c1-8)` (verify via `/api/version`)  
**Audience**: CEO (non-technical) + Operations Lead

---

## 1. What Changed In This Release / Điều Gì Thay Đổi

### High-level Summary / Tóm tắt Cao cấp

**Infrastructure updates**:
- ✅ **SHA verification enabled** — Production now proves it's running the exact code you deployed
- ✅ **Deploy script hardened** — Push-before-deploy rule prevents git/prod divergence
- ✅ **OpenNext 1.19.9** — Cloudflare adapter updated (build-time read from node_modules)

**No breaking changes to customer-facing features**. All existing flows (Setup Wizard, Telegram Bot, Payments) continue working.

### What Was Fixed / Đã Sửa

| Issue | Fix | Impact |
|-------|-----|--------|
| Prod/git divergence risk | `deploy-with-sha.sh` requires `git push origin main` before deploy | Prevents stale deploys |
| D1 migration ordering | Script now applies migrations changed since **previous live SHA** (not just HEAD~1) | Multi-commit deploys safe |
| Stale version endpoint | `/api/version` now reads from Worker secrets (injected at deploy) | SHA match always accurate |

### Known Issues (Monitor These) / Vấn đề Đã biết

1. **Worker bundle ~10MB** — Near Cloudflare 10MB limit. Cold starts ~500ms (acceptable but not ideal).
   - Mitigation: `strip-ssr-bloat.sh` removes client-only libraries from SSR chunks.
   - Watch: Cold start metrics in Cloudflare dashboard.

2. **Sentry source maps optional** — Stack traces minified unless `SENTRY_AUTH_TOKEN` set.
   - This is **by design** (no-tech doctrine: sourcemaps optional).
   - Errors still captured; just harder to debug.

3. **PWA offline mode degraded** — Turbopack replaces webpack; service worker not generated.
   - Offline caching limited. Acceptable tradeoff for M1 16GB OOM avoidance.

---

## 2. Production URLs & Health Checks / URLs Sản xuất & Kiểm tra Sức khỏe

### Critical Endpoints / Endpoint Quan trọng

| Purpose / Mục đích | URL | Expected Response |
|--------------------|-----|------------------|
| **Main app** | https://sophia.agencyos.network | HTTP 200 + HTML |
| **Version (SHA)** | https://sophia.agencyos.network/api/version | `{ "shortSha": "abc12345", ... }` |
| **Health check** | https://sophia.agencyos.network/api/health | `{ "status": "healthy" }` |
| **Setup Wizard** | https://sophia.agencyos.network/setup-wizard | Interactive form |

**Quick health check** (run in terminal):

```bash
# 1. Check HTTP is up
curl -sI https://sophia.agencyos.network | head -1
# Should return: HTTP/2 200

# 2. Verify SHA matches your latest deploy
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA | Live: $LIVE_SHA"
# Should output: Local: $LIVE_SHA | Live: $LIVE_SHA (match)
```

### Automated Uptime Monitoring / Giám sát Uptime Tự động

- **Cron**: Every 5 minutes, `/api/cron/uptime-check` calls `/api/health`
- **Alert**: Telegram notification to admin chat if down or latency >5s
- **Dashboard**: Incident state tracked in D1 (view via admin interface)

**No external monitoring service required** (UptimeRobot, Pingdom, etc.) — built-in.

---

## 3. Monitoring & Sentry Setup / Giám sát & Cấu hình Sentry

### What's Already Monitoring You / Đang Giám sát Gì

| What / Gì | How / Cách | Alert? |
|-----------|------------|--------|
| **Worker errors** | Sentry (client + server) | ✅ Email/Slack (if configured) |
| **Cron job failures** | Inngest dashboard | ✅ Email (Inngest native) |
| **Uptime** | `/api/cron/uptime-check` → Telegram | ✅ Telegram admin chat |
| **Logs** | `npx wrangler tail sophia-ai-factory` | ❌ Manual (no alert) |
| **Database performance** | `/api/health/detail` (slow queries) | ❌ Dashboard only |

### Sentry: Current State / Trạng thái Hiện tại

- **SDK installed**: `@sentry/nextjs` in client, server, edge configs
- **Source maps**: Uploaded by `scripts/ci/sentry-upload-sourcemaps.sh` (non-fatal if no `SENTRY_AUTH_TOKEN`)
- **Environment**: `production`
- **Releases**: Auto-linked to `COMMIT_SHA`

**To improve Sentry symbolication** (optional):

```bash
# Get auth token from Sentry org settings
npx wrangler secret put SENTRY_AUTH_TOKEN
# Next deploy will upload source maps automatically
```

**Without `SENTRY_AUTH_TOKEN`**: Errors still captured, but stack traces are minified. Acceptable for debugging with source code.

### Access Links / Liên kết Truy cập

| Tool | URL | Access |
|------|-----|--------|
| **Sentry** | https://sophia.agencyos.network/sentry | Cloudflare Workers SSO |
| **Inngest** | https://app.inngest.com/org/sophia | Invite-only |
| **Cloudflare Dashboard** | https://dash.cloudflare.com | Worker + D1 + R2 |
| **Wrangler tail** | `npx wrangler tail sophia-ai-factory` | CLI (local) |

---

## 4. Rollback Procedure / Quy trình Rollback

### When to Rollback / Khi nào Rollback

**Rollback immediately if**:
- ❌ HTTP 5xx errors >5% of requests (sudden spike)
- ❌ `/api/version` SHA mismatch (stale deploy detected)
- ❌ Database migration broke something (schema change error)
- ❌ Smoke tests fail in production

**Do NOT rollback for**:
- Gradual performance degradation (investigate first)
- Single error (could be transient)
- Feature flag off (just toggle)

### How to Rollback / Cách Rollback

#### Option 1: Cloudflare Version Rollback (FASTEST — 30s)

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Rollback: <reason>" --yes
```

**What this does**:
- Reverts Worker code to previous version (last 10 versions kept)
- No database changes (D1 stays as-is)
- Instant propagation (<30s)

**Use when**: Code deploy broke something; database schema is fine.

#### Option 2: Redeploy Previous Commit (CONTROLLED)

```bash
# Find good SHA from git log
git log --oneline -10

# Deploy that specific commit
git checkout <good_sha>
npm run deploy:full
git checkout main
```

**Use when**: Need to test intermediate commits; want to re-deploy known-good version.

#### Option 3: Database Restore from R2 Backup (D1 recovery)

```bash
# 1. List backups in R2
npx wrangler r2 bucket list --name sophia-backups

# 2. Download backup file (path: d1-backups/YYYY-MM-DD/sophia-raas-db.sql)
# 3. Restore
npx wrangler d1 execute sophia-raas-db --file=restore.sql --remote
```

**Use when**: Migration corrupted data; need point-in-time recovery.

**Backup retention**: 30 days (R2 lifecycle). See `docs/disaster-recovery.md` for RTO/RPO.

### Post-Rollback Checklist / Checklist Sau Rollback

1. ✅ Verify SHA: `curl -s https://sophia.agencyos.network/api/version | jq .shortSha`
2. ✅ HTTP check: `curl -sI https://sophia.agencyos.network | head -3`
3. ✅ Smoke tests: `PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network npx playwright test --grep @smoke`
4. ✅ Notify team: Slack #sophia-incidents + customer comms if impact
5. ✅ Root cause: Start investigation (was it code? migration? external API?)

---

## 5. Next Steps for Operations / Bước tiếp theo cho Vận hành

### Immediate (Today) / Ngay hôm nay

- [ ] **Verify health**: Run quick health check commands above
- [ ] **Check Telegram alerts**: Ensure `/api/cron/uptime-check` can send to admin chat
- [ ] **Review Sentry**: Check for any pre-existing errors in last 24h
- [ ] **Test rollback** (dry-run): `npx wrangler rollback --name sophia-ai-factory --dry-run`

### This Week / Tuần này

- [ ] **Monitor cold starts**: Cloudflare Workers → Metrics →cold_start_duration (should be <500ms)
- [ ] **Check D1 usage**: Cloudflare Dashboard → D1 → storage/writes (watch for limits)
- [ ] **Run smoke tests manually**: `npx playwright test --grep @smoke` against PROD
- [ ] **Verify backup schedule**: Confirm `/api/cron/d1-backup` runs (check R2 bucket daily)

### This Month / Tháng này

- [ ] **DMARC monitoring**: Check rua reports; consider `p=quarantine` graduation after 30 clean days (2026-06-12)
- [ ] **Cost review**: Cloudflare bill (expected $0–200/mo depending on usage)
- [ ] **Secret rotation**: Review `docs/secret-rotation-runbook.md`; rotate `CRON_SECRET` quarterly
- [ ] **Drill restore**: Test D1 restore from R2 backup in staging (document RTO)

### Long-term / Dài hạn

- [ ] **Consider GitHub Actions restore** if CI needed (currently disabled by design)
- [ ] **Evaluate bundle size** — if approaching 10MB limit, audit dependencies
- [ ] **Automated migration guard** — currently enforced by `npm test`; consider pre-commit hook

---

## 6. Emergency Contacts / Liên hệ Khẩn cấp

| Situation / Tình huống | Contact / Liên hệ | Response |
|------------------------|-------------------|----------|
| **Production down (P0)** | Slack #sophia-incidents → @on-call | 15 min |
| **Payment issues** | support@nowpayments.io | 2 hr |
| **Cloudflare outage** | Cloudflare Dashboard / Support | 1 hr |
| **Security incident** | security@sophia.agencyos.network | 1 hr |
| **Account Manager** | am-{your-company}@sophia.agencyos.network | 4 hr |

**Escalation path**: ops lead → Account Manager → CEO sponsor (Long Tho) → Security team.

---

## 7. Appendix: Quick Reference / Phụ lục Tham chiu Nhanh

### Essential Commands / Lệnh Thiết yếu

```bash
# Deploy
cd apps/sophia-ai-factory
git push origin main
npm run deploy:full

# Verify
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
curl -sI https://sophia.agencyos.network | head -3

# Rollback
npx wrangler rollback --name sophia-ai-factory --message "reason" --yes

# Logs (real-time)
npx wrangler tail sophia-ai-factory

# Apply migrations (if migrations/ changed)
bash scripts/apply-migrations.sh

# Run tests
npm test

# Build check
npm run build
```

### Files to Know / Tập tin Cần biết

| File / Tập tin | Purpose / Mục đích |
|----------------|-------------------|
| `scripts/deploy-with-sha.sh` | Main deploy script (SHA injection + verify) |
| `wrangler.toml` | Cloudflare config (bindings, triggers) |
| `src/app/api/version/route.ts` | SHA endpoint (used for verification) |
| `docs/disaster-recovery.md` | RTO/RPO + full recovery procedures |
| `docs/observability-runbook.md` | Monitoring + alert triage |
| `docs/secret-rotation-runbook.md` | Quarterly secret rotation |

---

**End of CEO Deployment Handover**  
**Kết thúc Bàn giao Triển khai CEO**

---

*For full technical details, see:*  
- `docs/contributor-handover.md` (developer onboarding)  
- `docs/CEO-HANDOFF-PACKAGE-v3.md` (pilot roadmap + customer success)  
- `plans/reports/handover-docs.md` (detailed technical handover)
