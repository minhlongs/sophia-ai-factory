# Solo-Founder Operations Runbook

> **Bilingual:** English (primary) + Vietnamese (operational phrases)
> **Audience:** Solo operator (non-technical CEO)
> **Last verified:** 2026-08-19 against production codebase

---

## What This Runbook Is

This is your daily, weekly, and monthly checklist for running Sophia AI Factory in production. It is written for someone who is not a developer. Follow the steps exactly — no coding required.

**Vietnamese:** Đây là danh sách kiểm tra hàng ngày, hàng tuần và hàng tháng để vận hành Sophia AI Factory trong môi trường producción. Viết cho người không phải lập trình viên. Làm theo các bước chính xác — không cần viết code.

---

## Daily Operations (15 minutes)

**Kiểm tra hàng ngày (15 phút)**

### Step 1: Health Check (2 min)
```
Kiem tra suc khoe (2 phut)
```

Open terminal, run:
```
curl -s https://sophia.agencyos.network/api/version | grep shortSha
```

**Expected:** Returns a SHA string (e.g. `"shortSha":"e0225b3b"`).
If this fails or returns empty → go to **Troubleshooting** below.

### Step 2: Sentry Error Check (5 min)
```
Kiem tra loi Sentry (5 phut)
```

Open: https://sentry.io → Sophia project → Issues tab.

- Filter: Last 24 hours, level: Error or Fatal
- If new errors appear that are NOT in the "Known Issues" list → create a GitHub issue and check **Incident Response** below
- If no new errors → continue

### Step 3: Cloudflare Worker Logs (5 min)
```
Nhat ky Worker Cloudflare (5 phut)
```

Run in terminal:
```
cd apps/sophia-ai-factory
npx wrangler tail sophia-ai-factory --format=pretty
```

Watch for 30 seconds. Look for:
- `500` status codes (server errors)
- `circuit_breaker_open` messages (external API blocked)
- Any message containing `CRITICAL` or `FATAL`

**Vietnamese:** Chạy lệnh trên, xem trong 30 giây. Tìm mã trạng thái `500`, thông báo `circuit_breaker_open`, hoặc tin nhắn `CRITICAL`/`FATAL`.

### Step 4: Payment Flow (3 min)
```
Luong thanh toan (3 phut)
```

Open: `/dashboard/admin/billing/summary` on production.
Confirm:
- Active subscriber count is reasonable
- No stuck/pending payments
- TODAYPayments webhook last received within 24h

**Vietnamese:** Mở trang billing summary trên production. Xác nhận số lượng subscriber hợp lý, không có thanh toán bị kẹt, webhook NOWPayments nhận trong 24h.

---

## Weekly Review (30 minutes, Monday)

**Danh gia hang tuan (30 phut, thu Hai)**

### 1. Run performance check (5 min)
```
Chay kiem tra hieu suat (5 phut)
```

```
cd apps/sophia-ai-factory
npm run perf:check
```

**Expected:** Exit code 0. If exit code 1, see the specific SLO violation and check the incident playbook.

### 2. Check D1 backup status (5 min)
```
Kiem tra trang thai sao luu D1 (5 phut)
```

```
curl -s https://sophia.agencyos.network/api/health | head -c 500
```

Confirm health response includes `db: "ok"`.

To trigger a manual backup:
```
curl -X POST https://sophia.agencyos.network/api/cron/d1-backup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Vietnamese:** Sao luu tu dong hang ngay luc 02:00 +0700. Chi can kiem tra, khong can keo thu cong.

> ✅ **Backups are automatic, not manual.** A registered cron
> (`forest/crons/d1-backup.ts`) fires daily at 02:00 +0700. R2 lifecycle policy
> retains 30 days. **Your only weekly job:** confirm the cron is still registered
> after any deploy that touches `wrangler.toml` — the cron list ships in the
> deploy payload:
> ```bash
> npx wrangler d1 list 2>/dev/null | grep sophia-raas-db
> ```

### 3. Review test suite (10 min)
```
Xet bo kiem thu (10 phut)
```

```
cd apps/sophia-ai-factory
npm test
```

**Expected:** All tests pass. If any fail → see **Incident Response**.

### 4. Check npm audit (5 min)
```
Kiem tra lo hong bao mat (5 phut)
```

```
cd apps/sophia-ai-factory
npm audit --audit-level=high
```

**Expected:** Exit code 0. If HIGH/CRITICAL vulnerabilities found → create GitHub issue immediately.

### 5. Review admin route access (5 min)
```
Xem truy cap route admin (5 phut)
```

Open Sentry → Issues → filter by `admin` tag in last 7 days.
Confirm: no unauthorized access attempts (403 spikes), no rate limit violations (429 spikes).

**Vietnamese:** Mở Sentry, lọc tag `admin` trong 7 ngày qua. Xác nhận không có truy cập trái phép (nhiều 403), không có vi phạm giới hạn tốc độ (nhiều 429).

---

## Monthly Tasks (2 hours, first Monday of month)

**Nhiem vu hang thang (2 gio, thu Hai dau tien)**

### 1. Full security audit (45 min)
```
Audit bao mat day du (45 phut)
```

```
cd apps/sophia-ai-factory
npm run build && npm test && npm run lint && npm audit --audit-level=high
```

All four commands must exit 0. Document results in `docs/project-changelog.md`.

### 2. D1 migration check (15 min)
```
Kiem tra migration D1 (15 phut)
```

Count total migrations:
```
ls migrations/*.sql | wc -l
```

Verify all applied:
```
cd apps/sophia-ai-factory
bash scripts/apply-migrations.sh
```

### 3. R2 backup bucket review (15 min)
```
Xem bucket sao luu R2 (15 phut)
```

Cloudflare Dashboard → R2 → `sophia-backups` → Objects.
Confirm 30-day lifecycle is rotating (no files older than 31 days).

### 4. Sentry source map check (15 min)
```
Kiem tra source map Sentry (15 phut)
```

Open Sentry → Project Settings → Debug Files.
Confirm source maps are uploaded (errors show original file names, not minified).

**Note:** Source map upload is optional per the no-tech doctrine. Without `SENTRY_AUTH_TOKEN`, errors still capture but traces are minified.

### 5. Documentation review (30 min)
```
Xem lai tai lieu (30 phut)
```

Check these files are current:
- `docs/project-changelog.md` — latest entry matches latest deploy
- `docs/roadmap/SOPHIA_2027_ROADMAP.md` — Phase status accurate
- This runbook — all commands still work

---

## One-Time Founder Setup

**Lan dau tien — thiet lap mot lan**

Do this once, on your first deploy. After this, every deploy is a single command
(see Deploy Procedure below).

```bash
# 1. Get a Cloudflare API token:
#    https://developers.cloudflare.com/fundamentals/api/get-started/tokens/
#    Token needs: Account → Workers → Read + Edit
#    (Or use a scoped token with only Workers:Read, Workers:Edit)

# 2. Save it in your shell profile (~/.zshrc or ~/.bash_profile):
echo 'export CLOUDFLARE_API_TOKEN="your-token-here"' >> ~/.zshrc
source ~/.zshrc

# 3. Confirm it works:
cd apps/sophia-ai-factory && npm run deploy:full
```

**Vietnamese:** Sau khi luu token, moi lan trien khai chi can 1 lenh: `npm run deploy:full`.

> ⚠️ **Never commit this token.** It lives only in your shell profile and in the
> Cloudflare dashboard. `deploy-with-sha.sh` reads it from the environment.

---

## Deploy Procedure

**Quy trinh trien khai**

### Prerequisites (before every deploy)
```
Dieu kien tien quyet (truoc moi lan trien khai)
```

- [ ] Working tree is clean: `git status` shows no modified files
- [ ] All tests pass: `npm test` exits 0
- [ ] Build succeeds: `npm run build` exits 0

### Deploy Steps

```bash
# Step 1: Push commits to main
git push origin main

# Step 2: Build + deploy (runs typecheck + tests + SHA injection automatically)
cd apps/sophia-ai-factory
npm run deploy:full

# Step 3: Apply any new D1 migrations (if migrations/ folder changed)
bash scripts/apply-migrations.sh

# Step 4: Verify SHA match (CRITICAL — proves new code is live)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
# These MUST match. If they don't match → see Troubleshooting.

# Step 5: Health check
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health
# Must return: 200
```

**Vietnamese:** Sau khi trien khai, kiem tra SHA phai giong nhau. Neu khac → xem Huong dan xu ly.

### Post-Deploy Smoke Test

```
Kiem tra smoke sau trien khai
```

```bash
cd apps/sophia-ai-factory
npx playwright test --grep "@smoke"
```

If smoke tests fail → check Incident Response playbook.

---

## Rollback Procedure

**Quy trinh thu hoi**

### Option 1: Wrangler Rollback (fastest, < 30 seconds)

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Rollback: <reason>" --yes
```

Then verify SHA changed:
```
curl -s https://sophia.agencyos.network/api/version | grep shortSha
```

### Option 2: Redeploy Previous Commit

```bash
git log --oneline -5        # Find the previous good commit
git checkout <previous-sha>
cd apps/sophia-ai-factory
npm run deploy:full         # Deploy the previous version
git checkout main
```

**When to use rollback vs redeploy:**
- Rollback → if the latest deploy is broken and you want to go to the immediately previous version
- Redeploy → if you need to go to a specific older version

**Vietnamese:** Thu hoi → neu phien ban moi bi loi va ban muon quay lai phien ban truoc do. Trien khai lai → neu ban muon quay lai mot phien ban cu cu the.

---

## Troubleshooting Guide

**Huong dan xu ly van de**

### Problem: SHA mismatch after deploy

**Symptoms:** `npm run deploy:full` exited 0, but `LIVE_SHA` does not equal `LOCAL_SHA`.

**Fix:**
1. Wait 60 seconds (Cloudflare propagation delay)
2. Re-run the SHA check
3. If still mismatched, run `npm run deploy:full` again
4. If still failing, check `npx wrangler tail sophia-ai-factory` for deploy errors

---

### Problem: Health check returns non-200

**Symptoms:** `curl /api/health` returns 500 or timeout.

**Fix:**
1. Run `npx wrangler tail sophia-ai-factory --format=pretty` to see live errors
2. If D1 connection error: check Cloudflare dashboard for D1 status
3. If 500 error: check Sentry for the specific exception
4. If timeout: check if Cloudflare is experiencing an outage (status.cloudflare.com)

---

### Problem: Sentry showing new errors after deploy

**Symptoms:** New error types appear in Sentry after a deploy.

**Fix:**
1. Check if the error is from the new deploy or pre-existing
2. If from new deploy and affecting users → **rollback immediately** (see above)
3. If from new deploy but not affecting users → create GitHub issue, investigate next day
4. If pre-existing → add to Known Issues list in Sentry

---

### Problem: Payment webhook not received

**Symptoms:** No new NOWPayments IPN in last 24h despite active subscribers.

**Fix:**
1. Check NOWPayments dashboard: is webhook configured to `https://sophia.agencyos.network/api/webhooks/nowpayments`?
2. Check Cloudflare Worker logs for the webhook URL
3. Check D1 for recent payment_events: `SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 5`
4. If webhook URL is wrong → fix in NOWPayments dashboard (no code change needed)

---

### Problem: Telegram bot not responding

**Symptoms:** @Sophia_Bbot does not reply to /campaign, /status, /results.

**Fix:**
1. Check bot token is valid: `curl -s https://api.telegram.org/bot<TOKEN>/getMe`
2. Check webhook is set: `curl -s https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. If no webhook or webhook URL is wrong → re-register via Setup Wizard
4. Check circuit breaker state in Cloudflare Worker logs: `circuit_breaker_open: telegram`

---

### Problem: Tests failing after deploy

**Symptoms:** `npm test` shows failures.

**Fix:**
1. Run `npm test` locally to reproduce
2. Check if failure is in new code or existing code
3. If new code → fix and redeploy
4. If existing code → check if a migration broke something: `bash scripts/apply-migrations.sh`
5. Never push without all tests passing

---

## Emergency Contacts

| Issue | Where to Look | Action |
|---|---|---|
| Production down | Cloudflare status page | Wait for Cloudflare resolution |
| Data loss | D1 backups in R2 | Restore from `sophia-backups` bucket |
| Security breach | Sentry + Cloudflare logs | Rotate secrets, rollback, investigate |
| Payment failure | NOWPayments dashboard | Check webhook config |

---

## Dry Run Proof (2026-08-19)

**Thuc thien thu thao — da xac minh**

This runbook was validated by a solo founder in a single 90-minute session.
Full results: `docs/ops/DRY_RUN_RESULTS_2027.md`.

| Step | Time | Result |
|---|---|---|
| typecheck + lint + test + build | 38 min | ✅ all green |
| deploy + SHA verify | 4 min | ✅ SHA matched |
| health + Sentry + perf:check | 8 min | ✅ 5/5 SLOs |
| feature smoke (rate limit, IPN) | 10 min | ✅ live verified |
| rollback rehearsal | 2 min | ✅ command confirmed |
| troubleshooting rehearsal | 15 min | ✅ all 6 paths rehearsed |
| **Total** | **90 min** | ✅ under 2-hour target |

**Two manual dependencies remain** (both one-time or cron-driven):
1. Cloudflare API token in shell profile — see **One-Time Founder Setup** above.
2. D1 backup is automatic at 02:00 +0700 — confirm cron registration after any
   deploy touching `wrangler.toml`.

**Vietnamese:** Toan bo quy trinh chi can 90 phut. Hai dieu can chu dong: luu token
Cloudflare 1 lan, va kiem tra cron sau moi lan deploy.

---

## Quick Reference Commands

| Task | Command |
|---|---|
| Health check | `curl -s https://sophia.agencyos.network/api/health` |
| Version check | `curl -s https://sophia.agencyos.network/api/version` |
| Run tests | `cd apps/sophia-ai-factory && npm test` |
| Performance check | `cd apps/sophia-ai-factory && npm run perf:check` |
| Deploy | `cd apps/sophia-ai-factory && npm run deploy:full` |
| Rollback | `npx wrangler rollback --name sophia-ai-factory --yes` |
| View live logs | `npx wrangler tail sophia-ai-factory --format=pretty` |
| Apply migrations | `cd apps/sophia-ai-factory && bash scripts/apply-migrations.sh` |
| Trigger D1 backup | `curl -X POST https://sophia.agencyos.network/api/cron/d1-backup -H "Authorization: Bearer YOUR_CRON_SECRET"` |
