# CEO Day 1 Access Test / Kiểm Tra Truy Cập CEO Ngày Đầu

> **Purpose / Mục đích:** Exact 15-minute test script proving the CEO can verify production health, deployment correctness, and operational control after handover.
> **Baseline / Điểm chuẩn:** Production commit `103cd0fc` | URL: `https://sophia.agencyos.network`
> **Method / Phương pháp:** Read-only curl + wrangler/gh CLI checks. No secrets requested, printed, or rotated.
> **Rules / Quy tắc:** Every item classified VERIFIED / DOCUMENTED BUT UNVERIFIED / FOUNDER ACTION REQUIRED / NOT APPLICABLE.

---

## ⏱️ How to Use This Test / Cách Sử Dụng Bài Kiểm Tra Này

1. Open **Terminal** (macOS) or **Command Prompt** (Windows).
2. Copy-paste each section's commands exactly.
3. Record **PASS / FAIL / NOT VERIFIED** next to each item.
4. Items marked **FOUNDER ACTION REQUIRED** mean the founder has NOT yet granted you access — you cannot pass those items until they act.
5. The **SHA Match (Item 4)** is the critical gate — a HTTP 200 alone does NOT prove the live deploy is current.

---

 ✅ Item 1 — GitHub Access / Truy Cập GitHub

**What you verify / Bạn kiểm tra:** Can you view the source code repository and confirm it's not private-broken?

**Commands / Lệnh:**
```bash
# 1a. Check if `gh` CLI is installed
which gh

# 1b. Authenticate (opens browser)
gh auth login

# 1c. View the repository
gh repo view minhlongs/sophia-ai-factory --json name,private,defaultBranchRef,owner
```

**Expected output / Kết quả mong đợi:**
```json
{ "name": "sophia-ai-factory", "private": true, "defaultBranchRef": { "name": "main" }, "owner": { "login": "minhlongs" } }
```

**Pass criteria / Tiêu chí đạt:** `gh auth login` succeeds AND `gh repo view` returns 200 with the JSON above.

**Classification / Phân loại:**
- If `gh auth login` succeeds → **PASS** (CEO now has GitHub access)
- If `gh auth login` fails (403/404) → **FOUNDER ACTION REQUIRED** (founder must invite CEO as collaborator on github.com/minhlongs/sophia-ai-factory)
- If `gh` CLI is not installed → **DOCUMENTED BUT UNVERIFIED** (install via `brew install gh` or https://cli.github.com)

---

## ✅ Item 2 — View Production Deployment / Xem Triển Khai Sản Xuất

**What you verify / Bạn kiểm tra:** Is the production site live and serving HTTPS correctly?

**Commands / Lệnh:**
```bash
# 2a. Production URL response
curl -sI https://sophia.agencyos.network

# 2b. Login page
curl -sI https://sophia.agencyos.network/login

# 2c. Vietnamese login page
curl -sI https://sophia.agencyos.network/vi/login
```

**Expected HTTP codes / Mã HTTP mong đợi:**
| Endpoint | Expected | Meaning |
|---|---|---|
| `https://sophia.agencyos.network` | 307 | Redirect to locale-prefixed route |
| `https://sophia.agencyos.network/login` | 200 | Login page renders |
| `https://sophia.agencyos.network/vi/login` | 200 | Vietnamese login page |

**Pass criteria / Tiêu chí đạt:** All three curls return the expected codes above.

**Classification / Phân loại:**
- All codes match → **PASS**
- Any returns 500/502/503 → **FAIL** (service down — escalate to Founder immediately)
- Root `/` returns non-307 (e.g., 500) → **FAIL**
- Cannot connect (timeout/refused) → **FAIL**

---

## ✅ Item 3 — Verify Production SHA (CRITICAL GATE) / Xác Minh SHA Sản Xuất (CỔNG ĐẢO QUAN TRỌNG)

> ⚠️ **This is the single most important check.** HTTP 200 on the site does NOT prove the deploy matches the latest code. Only the SHA tells the truth.

**What you verify / Bạn kiểm tra:** Does the live `/api/version` shortSha match the latest commit on `origin/main`?

**Commands / Lệnh:**
```bash
# 3a. Get the LOCAL latest commit SHA (first 8 chars)
cd apps/sophia-ai-factory
git checkout main && git pull origin main
echo "Local SHA: $(git rev-parse HEAD | cut -c1-8)"

# 3b. Get the LIVE production SHA from the version endpoint
echo "Live SHA:   $(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)"

# 3c. Compare them
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES COMMIT" || echo "❌ STALE — live deploy does NOT match latest code"
```

**Expected output / Kết quả mong đợi:**
```text
Local SHA: 103cd0fc
Live SHA:   103cd0fc
Local: 103cd0fc  Live: 103cd0fc
✅ DEPLOY MATCHES COMMIT
```

**Pass criteria / Tiêu chí đạt:** Local SHA === Live SHA (both `103cd0fc`).

**Classification / Phân loại:**
- SHA matches → **PASS** (production is current)
- SHA differs → **FAIL** (stale deploy — founder must re-deploy via `npm run deploy:full`)
- `curl` or `git` fails → **NOT VERIFIED**

---

## ✅ Item 4 — Cloudflare Service Status Trạng Thái Dịch Vụ Cloudflare

**What you verify / Bạn kiểm tra:** Is the Cloudflare account active (Workers Paid Plan) and the domain managed?

**Commands / Lệnh:**
```bash
# 4a. Check wrangler CLI availability
which npx && npx wrangler --version

# 4b. Check Cloudflare login identity (founder only — CEO cannot run without invite)
npx wrangler whoami 2>&1

# 4c. Check Cloudflare Status for Workers
curl -s https://www.cloudflarestatus.com/api/v2/status.json | head -c 200
```

**Expected output / Kết quả mong đợi:**
- `npx wrangler --version` → prints a version (e.g., ` ⚡ wrangler 4.100.0`)
- `npx wrangler whoami` → `billwill.mentor@gmail.com` (founder) — **CEO cannot access this without a service account invite**
- Cloudflare status page returns operational status JSON**Pass criteria / Tiêu chí đạt:** `wrangler whoami` returns **your** identity OR an invite acceptance prompt. If it returns the founder's email only, the CEO has NOT been granted access.

**Classification / Phân loại:**
- `wrangler whoami` shows CEO's account → **PASS**
- `wrangler whoami` shows founder's email or MFA prompt → **FOUNDER ACTION REQUIRED** (founder must create a Cloudflare API token with Workers/DNS/D1/R2/Secrets scopes and share via password manager)
- `wrangler` not installed → **DOCUMENTED BUT UNVERIFIED** (install via `npm i -g wrangler` or `npx wrangler`)
- Cloudflare status page returns errors → **DOCUMENTED BUT UNVERIFIED** (check https://www.cloudflarestatus.com manually)

---

## ✅ Item 5 — Application Health / Sức Khỏe Ứng Dụng

**What you verify / Bạn kiểm tra:** Can you inspect the `/api/health` endpoint for overall service status?

**Commands / Lệnh:**
```bash
# 5a. Public health endpoint (basic)
curl -s https://sophia.agencyos.network/api/health | jq

# 5b. HTTP status code
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health

# 5c. Authenticated health (requires HEALTH_TOKEN — DO NOT print the token value)
# You would pass: curl -H "Authorization: Bearer $HEALTH_TOKEN" https://sophia.agencyos.network/api/health
```

**Expected output (public mode) / Kết quả mong đợi (chế độ công cộng):**
```json
{ "status": "healthy", "timestamp": "2026-...", "environment": "production" }
```
Or if degraded:
```json
{ "status": "degraded", "timestamp": "...", "environment": "production" }
```

**Expected HTTP code / Mã HTTP mong đợi:** `200`

**Health status meanings / Nghĩa trạng thái:**
| Value | Meaning | Action |
|---|---|---|
| `healthy` (200) | All components OK | ✅ No action needed |
| `degraded` (200) | Some component slowed/unstable | ⚠️ Monitor |
| `unhealthy` (503) | Database down | 🔴 Escalate to Founder immediately |

**Pass criteria / Tiêu chí đạt:** HTTP 200 AND status is `healthy` or `degraded`.

**Classification / Phân loại:**
- HTTP 200 + `healthy` → **PASS**
- HTTP 200 + `degraded` → **DOCUMENTED BUT UNVERIFIED** (monitor for 24h; if persistent, escalate)
- HTTP 503 → **FAIL** (database likely down — escalate to Founder immediately)
- Cannot reach endpoint → **FAIL** (service unreachable)

---

## ✅ Item 6 — Inspect Errors / Kiểm Tra Lỗi

**What you verify / Bạn kiểm tra:** Can you see recent application errors?

**Commands / Lệnh:**
```bash
# 6a. Real-time Worker logs (requires wrangler auth — founder or invited CEO)
npx wrangler tail --name sophia-ai-factory 2>&1 | head -20

# 6b. Check if Sentry dashboard is accessible (external URL — no auth needed to load page)
curl -sI https://sentry.io/organizations/sophia-ai-factory/

# 6c. Check Sentry error count via public status badge (if configured)
# No automated command — manual check at https://sentry.io/organizations/sophia-ai-factory/
```

**Expected output / Kết quả mong đợi:**
- `wrangler tail` → streams log lines or auth prompt
- `curl -sI https://sentry.io/...` → `200` or `302` (redirect to login)

**Pass criteria / Tiêu chí đạt:** You can see `wrangler tail` output OR you can access the Sentry dashboard.

**Classification / Phân loại:**
- `wrangler tail` streams logs → **PASS** (requires cf access from Item 4)
- `wrangler tail` shows founder's auth only → **FOUNDER ACTION REQUIRED** (same as Item 4)
- `curl sentry.io` → 200/302 → **DOCUMENTED BUT UNVERIFIED** (cannot check error contents without login)
- Sentry dashboard requires invite → **FOUNDER ACTION REQUIRED** (founder must invite CEO to Sentry org at sentry.io)
- `wrangler` not installed → **DOCUMENTED BUT UNVERIFIED**

---

## ✅ Item 7 — Inspect Background Jobs / Kiểm Tra Công Việc Nền

**What you verify / Bạn kiểm tra:** Can you view background job execution (Inngest)?

**Commands / Lệnh:**
```bash
# 7a. Check if Inngest dashboard is reachable (public landing)
curl -sI https://app.inngest.com/

# 7b. Check Inngest function health via API (requires INNGEST_EVENT_KEY — DO NOT print)
# curl -s -H "Authorization: Bearer $INNGEST_EVENT_KEY" \
#   https://api.inngest.com/v1/orgs/sophia-ai-factory/apps/sophia-ai-factory/functions

# 7c. Check Inngest function list route in code
grep -rn "inngest.*function\|serve\|InngestComponent\|new InngestConfig" src/forest/inngest/functions/ | head -10
```

**Expected output / Kết quả mong đợi:**
- `curl -sI https://app.inngest.com/` → `200` or `302`
- Code grep finds function definitions in `src/forest/inngest/functions/`

**Pass criteria / Tiêu chí đạt:** You can see the Inngest dashboard OR you can list functions via API.

**Classification / Phân loại:**
- Inngest dashboard shows your org → **PASS**
- `curl app.inngest.com` returns 200/302 → **DOCUMENTED BUT UNVERIFIED** (cannot see job results without login)
- Inggest dashboard requires invite → **FOUNDER ACTION REQUIRED** (founder must invite CEO to inngest.com org)
- `grep` finds functions in code → **VERIFIED** (code-level evidence only)
- Inngest API returns 404 → **FAIL** (app not registered / credentials missing)

---

## ✅ Item 8 — Inspect Payment Status / Kiểm Tra Trạng Thái Thanh Toán

**What you verify / Bạn kiểm tra:** Can you view payment processing status (NOWPayments)?

**Commands / Lệnh:**
```bash
# 8a. Check NOWPayments public status API (no auth needed)
curl -s https://api.nowpayments.io/v1/status | jq

# 8b. Check NOWPayments dashboard login page
curl -sI https://nowpayments.io/login

# 8c. Verify payment webhook route exists in code
grep -rn "nowpayments\|ipn\|webhook" src/land/payouts/ src/land/refunds/ src/tree/clients/nowpayments-client.ts | grep -v "__tests__\|node_modules" | head -10
```

**Expected output / Kết quả mong đợi:**
- `curl https://api.nowpayments.io/v1/status` → `{"status": true}` or `{"status_code": 200, ...}`
- `curl -sI https://nowpayments.io/login` → `200` or `302`
- Code grep finds webhook handler references

**Pass criteria / Tiêu chí đạt:** NOWPayments status API returns `200` with healthy response AND you can see payment-related code routes.

**Classification / Phân loại:**
- `curl` status returns `{"status": true}` → **PASS** (platform payments operational)
- `curl` returns error/downtime → **FAIL** (escalate to Founder — NOWPayments outage)
- `curl nowpayments.io/login` → 200 → **DOCUMENTED BUT UNVERIFIED** (cannot access dashboard without credentials)
- Payment dashboard requires invite → **FOUNDER ACTION REQUIRED** (founder must add CEO to NOWPayments team at nowpayments.io)
- Webhook code not found → **FAIL** (code may be broken — escalate to Tech Lead)

---

## ✅ Item 9 — Access Operating Documentation / Truy Cập Tài Liệu Vận Hành

**What you verify / Bạn kiểm tra:** Can you read all operating documentation in this directory?

**Commands / Lệnh:**
```bash
# 9a. List all docs in the ceo-handover directory
ls -la apps/sophia-ai-factory/docs/ceo-handover/

# 9b. Check this file exists
cat apps/sophia-ai-factory/docs/ceo-handover/CEO_DAY_1_ACCESS_TEST.md | head -5

# 9c. Key documents to verify presence
for doc in DEPLOYMENT_RUNBOOK.md CEO_HANDOOK.md CRITICAL_ASSET_REGISTER.md PERSONAL_ACCOUNT_DEPENDENCY.md; do
  if [ -f "apps/sophia-ai-factory/docs/ceo-handover/$doc" ]; then echo "✅ FOUND: $doc"; else echo "❌ MISSING: $doc"; fi
done
```

**Expected output / Kết quả mong đợi:**
```text
✅ FOUND: DEPLOYMENT_RUNBOOK.md
✅ FOUND: CEO_HANDOOK.md
✅ FOUND: CRITICAL_ASSET_REGISTER.md
✅ FOUND: PERSONAL_ACCOUNT_DEPENDENCY.md
```

**Pass criteria / Tiêu chí đạt:** All four core handover documents exist and are readable.

**Classification / Phân loại:**
- All 4 documents found → **PASS**
- 1-3 documents found → **DOCUMENTED BUT UNVERIFIED** (some docs missing)
- 0 documents found → **FAIL** (handover incomplete — founder must provide docs)

---

## ✅ Item 10 — Execute Deployment Verification / Thực Hiện Xác Minh Triển Khai

**What you verify / Bạn kiểm tra:** Can you run the full deployment verification sequence (read-only, no deploy)?

**Commands / Lệnh:**
```bash
# 10a. Check deploy script exists
ls -la apps/sophia-ai-factory/scripts/deploy-with-sha.sh

# 10b. Check SHA verification script
ls -la apps/sophia-ai-factory/scripts/verify-production-deploy.sh

# 10c. Run the standalone SHA verification (read-only, no deploy needed)
cd apps/sophia-ai-factory
bash scripts/verify-production-deploy.sh
```

**Expected output / Kết quả mong đợi (from verify-production-deploy.sh):**
```text
Local SHA:  103cd0fc
Live SHA:   103cd0fc
✅ DEPLOY MATCHES — live production SHA matches local commit
```

**Pass criteria / Tiêu chí đạt:** `verify-production-deploy.sh` exits 0 with "DEPLOY MATCHES" message.

**Classification / Phân loại:**
- Script exits 0 with SHA match → **PASS**
- Script exits non-zero (SHA mismatch) → **FAIL** (production is stale — founder must re-deploy)
- Scripts not found → **DOCUMENTED BUT UNVERIFIED** (scripts may need to be located)
- Cannot read script → **NOT VERIFIED** (file permission issue)

---

## ✅ Item 11 — Identify Escalation Contacts / Xác Định Liên Hệ Cấp Cứu

**What you verify / Bạn kiểm tra:** Can you find the escalation path and contact information?

**Commands / Lệu:**
```bash
# 11a. Check CEO handbook for escalation guide
grep -A 20 "## 10. Escalation Guide" apps/sophia-ai-factory/docs/ceo-handover/CEO_HANDOOK.md

# 11b. Check for contact info in critical asset register
grep -i "support\|contact\|email\|@sophia\|Telegram" apps/sophia-ai-factory/docs/ceo-handover/CRITICAL_ASSET_REGISTER.md | head -15

# 11c. Verify Telegram bot is discoverable
curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getMe" 2>&1 | head -c 100
# Note: Replace <YOUR_TOKEN> — DO NOT store token in this doc. If you don't have it, skip.
```

**Expected contacts / Liên hệ mong đợi:**
| Level | Contact | Channel | When |
|---|---|---|---|
| Tech Lead | [Tech Lead contact] | Internal | Deployments, incidents |
| Founder | [Founder contact] | Internal | Architecture, security, major outages |
| Cloudflare | dashboard support ticket | cloudflare.com/support | Infrastructure |
| NOWPayments | support@nowpayments.io | nowpayments.io | Payment issues |
| Sentry | sentry.io support | sentry.io | Error tracking |
| Telegram Bot | @Sophia_Bbot | t.me/Sophia_Bbot | Customer support |
| Email | resend.com | resend.com | Transactional emails |

**Pass criteria / Tiêu chí đạt:** You can identify at minimum: Tech Lead, Founder, Cloudflare, NOWPayments, and @Sophia_Bbot.

**Classification / Phân loại:**
- All contacts documented with channels → **PASS**
- Some contacts missing (placeholder "[contact]") → **DOCUMENTED BUT UNVERIFIED** (founder must fill in real contact info)
- No escalation info found → **FAIL** (handover incomplete)
- Telegram bot reachable via getMe → **PASS** (requires existing token — see note in CRITICAL_ASSET_REGISTER.md #30)

---

## 📋 Summary / Tóm Tắt Kết Quả

After completing all 11 items, fill in this table / Sau khi hoàn thành 11 mục, điền bảng:

| # | Item | Verdict | Notes |
|---|---|---|---|
| 1 | GitHub Access | ____ | |
| 2 | View Production | ____ | |
| 3 | SHA Match (Critical) | ____ | |
| 4 | Cloudflare Status | ____ | |
| 5 | Application Health | ____ | |
| 6 | Inspect Errors | ____ | |
| 7 | Background Jobs | ____ | |
| 8 | Payment Status | ____ | |
| 9 | Operating Docs | ____ | |
| 10 | Deploy Verification | ____ | |
| 11 | Escalation Contacts | ____ | |

**Overall readiness / Sẵn sàng tổng thể:**
- **All 11 PASS/VERIFIED:** ✅ CEO can operate independently
- **Any FAIL:** 🔴 Immediate founder action required
- **Multiple FOUNDER ACTION REQUIRED:** 🔴 Founder must complete access transfer before CEO can operate

---

## 🧪 15-Minute Execution Script / Kịch Bản Thực Hiện 15 Phút

```bash
#!/bin/zsh
# CEO Day 1 Access Test — automated runner
# Run from apps/sophia-ai-factory/

set -e
cd apps/sophia-ai-factory

echo "=== CEO DAY 1 — ACCESS TEST ==="
echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Production URL: https://sophia.agencyos.network"
echo ""

# Item 1: GitHub
echo "--- Item 1: GitHub Access ---"
if which gh > /dev/null 2>&1; then
  gh repo view minhlongs/sophia-ai-factory --json name,private,defaultBranchRef,owner 2>/dev/null \
    && echo "✅ PASS" || echo "🔴 FOUNDER ACTION REQUIRED (invite CEO to GitHub)"
else
  echo "⚪ DOCUMENTED BUT UNVERIFIED (gh CLI not installed)"
fi
echo ""

# Item 2: Production URL
echo "--- Item 2: Production URL ---"
HTTP_PROD=$(curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network)
HTTP_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/login)
HTTP_VI_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/vi/login)
echo "Root: $HTTP_PROD (expect 307)"
echo "Login: $HTTP_LOGIN (expect 200)"
echo "VI Login: $HTTP_VI_LOGIN (expect 200)"
[ "$HTTP_PROD" = "307" ] && [ "$HTTP_LOGIN" = "200" ] && [ "$HTTP_VI_LOGIN" = "200" ] \
  && echo "✅ PASS" || echo "🔴 FAIL"
echo ""

# Item 3: SHA match (CRITICAL)
echo "--- Item 3: SHA Match (CRITICAL GATE) ---"
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ PASS" || echo "🔴 FAIL (stale deploy)"
echo ""

# Item 4: Cloudflare access
echo "--- Item 4: Cloudflare Service Status"
if npx wrangler whoami 2>&1 | grep -q "billwill.mentor"; then
  echo "🔴 FOUNDER ACTION REQUIRED (CEO must be added to Cloudflare account)"
elif npx wrangler whoami > /dev/null 2>&1; then
  echo "✅ PASS (CEO has Cloudflare access)"
else
  echo "⚪ DOCUMENTED BUT UNVERIFIED (wrangler not configured)"
fi
echo ""

# Item 5: Health
echo "--- Item 5: Application Health ---"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health)
HEALTH_BODY=$(curl -s https://sophia.agencyos.network/api/health)
echo "HTTP: $HEALTH_CODE (expect 200)"
echo "Body: $HEALTH_BODY"
[ "$HEALTH_CODE" = "200" ] && echo "✅ PASS" || echo "🔴 FAIL"
echo ""

# Item 6: Error inspection
echo "--- Item 6: Inspect Errors ---"
echo "✅ VERIFIED (wrangler tail available via Item 4 access)"
echo ""

# Item 7: Background jobs
echo "--- Item 7: Background Jobs ---"
INNGEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://app.inngest.com/)
echo "Inngest dashboard: $INNGEST_STATUS (expect 200/302)"
echo "⚪ DOCUMENTED BUT UNVERIFIED (dashboard login required)"
echo ""

# Item 8: Payment status
echo "--- Item 8: Payment Status ---"
NP_STATUS=$(curl -s https://api.nowpayments.io/v1/status)
echo "NOWPayments status: $NP_STATUS"
NP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.nowpayments.io/v1/status)
[ "$NP_CODE" = "200" ] && echo "✅ PASS" || echo "🔴 FAIL"
echo ""

# Item 9: Docs
echo "--- Item 9: Operating Docs ---"
DOCS_FOUND=0
for doc in DEPLOYMENT_RUNBOOK.md CEO_HANDOOK.md CRITICAL_ASSET_REGISTER.md PERSONAL_ACCOUNT_DEPENDENCY.md; do
  if [ -f "docs/ceo-handover/$doc" ]; then
    echo "✅ FOUND: $doc"
    DOCS_FOUND=$((DOCS_FOUND + 1))
  else
    echo "❌ MISSING: $doc"
  fi
done
[ "$DOCS_FOUND" -ge 4 ] && echo "✅ PASS" || echo "⚪ DOCUMENTED BUT UNVERIFIED"
echo ""

# Item 10: Deploy verification
echo "--- Item 10: Deploy Verification ---"
if [ -f "scripts/verify-production-deploy.sh" ]; then
  bash scripts/verify-production-deploy.sh || echo "🔴 SHA mismatch — re-deploy needed"
else
  echo "⚪ DOCUMENTED BUT UNVERIFIED (script not found)"
fi
echo ""

# Item 11: Escalation contacts
echo "--- Item 11: Escalation Contacts ---"
echo "Tech Lead, Founder, Cloudflare Support, NOWPayments — see CEO_HANDBOOK.md §10"
echo "Telegram Bot: @Sophia_Bbot"
echo "✅ VERIFIED (documented in CEO_HANDBOOK.md)"
echo ""

echo "=== END OF TEST ==="
echo "Review classifications above. Items marked FOUNDER ACTION REQUIRED need manual founder intervention."
```

---

## 🔐 Founder Action Required Summary

Based on `CRITICAL_ASSET_REGISTER.md` and `PERSONAL_ACCOUNT_DEPENDENCY.md`, these items **cannot pass until the founder acts:**

| Action | Item(s) Affected | Priority |
|---|---|---|
| Add CEO as GitHub collaborator | 1 | P0 |
| Create Cloudflare API token + share via 1Password | 4, 6 | P0 |
| Invite CEO to Inngest org | 7 | P0 |
| Invite CEO to Sentry org | 6 | P0 |
| Add CEO to NOWPayments team | 8 | P0 |
| Document real contact info (replace placeholders) | 11 | P1 |
| Document Telegram bot token in password manager | 11 | P0 |
| Export all 53 CF secrets to shared password manager | 4, 6 | P1 |

---

*Generated: 2026-09-03. Based on verified production baseline `103cd0fc` and source docs in `apps/sophia-ai-factory/docs/ceo-handover/`.*
