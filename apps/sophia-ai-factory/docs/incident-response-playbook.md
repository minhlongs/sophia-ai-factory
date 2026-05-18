# Incident Response Playbook / Sổ Tay Ứng Phó Sự Cố

> Sophia AI Factory — operator + on-call reference
> Last updated: 2026-05-18

---

## 1. Severity classification / Phân Loại Mức Độ

| Code | Definition (EN) | Định nghĩa (VI) | First-response SLA |
|---|---|---|---|
| **P0 Critical** | Production down OR data loss OR payment flow broken | Production sập HOẶC mất dữ liệu HOẶC luồng thanh toán hỏng | **15 minutes** |
| **P1 High** | Major feature broken (auth, checkout, redeem) OR security HIGH disclosed | Tính năng chính hỏng (đăng nhập / thanh toán / redeem) HOẶC lỗ hổng HIGH | **1 hour** |
| **P2 Medium** | Minor feature broken OR degraded performance | Tính năng phụ hỏng HOẶC chậm | **4 hours** business hours |
| **P3 Low** | Cosmetic / non-blocking | Lỗi hiển thị / không chặn | **next business day** |

---

## 2. P0 response steps / Quy Trình Ứng Phó P0

### 1️⃣ Detect / Phát hiện
- Alert from CF Worker `wrangler tail` panic
- Customer report via Telegram or email
- Uptime monitor pager (if wired)
- `curl -sI https://sophia.agencyos.network` returns non-200

### 2️⃣ Triage / Đánh giá nhanh (≤5 min)
```bash
# Quick health check
curl -s https://sophia.agencyos.network/api/version | jq .
curl -sI https://sophia.agencyos.network | head -3

# Worker live tail
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory
npx wrangler tail --format pretty
```

### 3️⃣ Communicate / Thông báo
- Email operator + customer support
- Status note: what / when / scope / next-update-time

### 4️⃣ Mitigate / Khắc phục

**Option A — Rollback (fastest, 2-5 min):**
```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory \
  --message "rollback: <one-line incident description>" --yes
curl -s https://sophia.agencyos.network/api/version | jq .shortSha  # confirm older SHA
```

**Option B — Hotfix branch (15-30 min):**
```bash
git checkout -b hotfix/<incident-slug>
# edit fix
git add . && git commit -m "fix(<area>): <message>"
git push origin hotfix/<incident-slug>
# After review:
git checkout main && git merge --no-ff hotfix/<incident-slug>
git push origin main && git push gitlab main
npm run deploy:full
# Verify SHA match
```

### 5️⃣ Postmortem / Phục hồi (within 48h)
Write to `docs/postmortems/INC-<YYYY-MM-DD>-<slug>.md` with:
- Timeline (UTC + GMT+7)
- Root cause
- Impact (users affected, duration, revenue)
- Action items (preventive)
- Lessons learned

---

## 3. Common scenarios / Tình Huống Phổ Biến

### A. Worker 5xx errors / Worker lỗi 500
```bash
npx wrangler tail --format pretty | grep -E "exception|error"
# If pattern emerges → identify failing route → rollback OR hotfix
```

### B. D1 corruption or data inconsistency / D1 hỏng hoặc lệch dữ liệu
1. **STOP writes** — disable affected route via feature flag OR rollback
2. Snapshot current D1: `npx wrangler d1 export sophia-raas-db --remote --output /tmp/d1-pre-restore-$(date +%s).sql`
3. Invoke DR procedure → see [disaster-recovery.md](disaster-recovery.md)
4. Restore from last good R2 backup
5. Verify integrity: row counts + sample queries on critical tables

### C. NOWPayments webhook rejection storm / Webhook NOWPayments bị reject hàng loạt
1. Verify `NOWPAYMENTS_IPN_SECRET` matches NOWPayments admin console
2. If mismatch → key may have been rotated externally → see [nowpayments-key-rotation.md](nowpayments-key-rotation.md)
3. If signature algorithm changed → check NOWPayments docs for breaking changes
4. Manual replay of stuck payments from `payment_events` table (admin endpoint)

### D. Tier not granted after successful payment / Khách trả tiền nhưng không lên tier
1. Query `payment_events` table for the transaction
2. Check `subscriptions` table for the user
3. If event present but subscription missing → manual grant via admin tools
4. File P1 bug report — automation should not require manual grant

### E. FREE100 redemption fails after admin generates code / FREE100 không redeem được
1. Verify code in `promo_codes` table: status='active', valid_from past, valid_until future
2. Check `coupon_redemptions` table for prior use by same user
3. If `applies_to_tier` mismatch with handover flow target → check `applies_to_tier='MASTER'` (uppercase)
4. If error in `customer_handovers` insert → check `subscriptions` FK constraint

### F. Telegram bot unresponsive / Bot Telegram không phản hồi
1. Check `INNGEST_*` secrets are set on Worker
2. `npx wrangler tail` filtered for `telegram` or webhook source IP
3. Verify Telegraf webhook URL via Telegram BotFather: `/setwebhook` to https://sophia.agencyos.network/api/telegram/webhook

---

## 4. Communication templates / Mẫu Thông Báo

### To customers (P0)
```
🚨 Service Disruption Notice

Some Sophia AI Factory features are temporarily unavailable.
Affected: <feature>
ETA to resolution: <time>
Workaround: <action or "none, please wait">

We will update at <YYYY-MM-DD HH:MM GMT+7>.

— Sophia AI Factory Operator
```

### To operator (internal)
```
[INC-<DATE>-<SLUG>] P<N>

What: <one-line>
When detected: <UTC time>
Current status: triaging / mitigating / resolved
Suspected cause: <hypothesis>
Mitigation in progress: <action>
Estimated impact: <user-count or %>
```

---

## 5. Escalation contacts / Liên Hệ Cấp Cao

→ See [escalation-contacts.md](escalation-contacts.md)

---

## 6. Reference docs / Tài Liệu Tham Khảo

- [disaster-recovery.md](disaster-recovery.md) — DR procedure
- [dev-sops.md](dev-sops.md) — SOPs 1-13
- [deployment-guide.md](deployment-guide.md) — deploy flow
- [sophia-deploy-verify.md](../.claude/rules/sophia-deploy-verify.md) — deploy SHA match rule
- [known-issues.md](known-issues.md) — outstanding defects
