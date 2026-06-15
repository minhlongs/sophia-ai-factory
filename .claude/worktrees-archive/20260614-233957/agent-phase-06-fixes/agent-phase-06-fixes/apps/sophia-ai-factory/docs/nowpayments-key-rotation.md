# NOWPayments Key Rotation Procedure / Quy Trình Xoay Khoá NOWPayments

> Sophia AI Factory — operator runbook
> Last updated: 2026-05-18

---

## 1. When to rotate / Khi Nào Phải Xoay

| Trigger | Urgency |
|---|---|
| **Security incident** (key leaked, suspected compromise) | Immediate — within 1 hour of confirmation |
| **Preventive** (calendar policy) | Every 12 months |
| **Operator transition** (handover to new operator) | Before handover completes |
| **NOWPayments-side rotation** (their security policy) | Within 24h of their notice |

---

## 2. Pre-flight checks / Kiểm Tra Trước Khi Xoay

```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory

# 1. Verify current secrets are wired (don't show values)
npx wrangler secret list --name sophia-ai-factory | grep -i nowpayments
# Expected: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, NOWPAYMENTS_WALLET

# 2. Snapshot active payments before rotation
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT count(*) FROM payment_events WHERE created_at > unixepoch() - 86400"
# Note count — should match post-rotation count after 24h

# 3. Verify pre-push hook + deploy guard work
git status   # should be clean before rotation
git rev-parse HEAD | cut -c1-8
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Both should match
```

---

## 3. Rotation procedure / Quy Trình Xoay

### Step 1 — Generate new keys in NOWPayments console
1. Log in: https://account.nowpayments.io
2. Settings → API Keys → **Create new key**
3. **DO NOT delete the old key yet** — keep both active for cutover
4. Settings → Webhooks → IPN Secret → **Generate new** (record both old + new)

### Step 2 — Update CF Worker secrets

```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory

# Interactive prompts — paste each new value when prompted
npx wrangler secret put NOWPAYMENTS_API_KEY      # paste new API key
npx wrangler secret put NOWPAYMENTS_IPN_SECRET   # paste new IPN secret
# NOWPAYMENTS_WALLET typically unchanged unless wallet itself rotated
```

### Step 3 — Redeploy Worker
```bash
npm run deploy:full

# Verify deploy SHA matches local HEAD
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ deploy verified" || { echo "❌ stale"; exit 1; }
```

### Step 4 — Smoke test
```bash
# Health endpoint
curl -sI https://sophia.agencyos.network | head -3   # HTTP 200

# Test payment webhook signature path (admin-only smoke)
# Use NOWPayments admin "Test webhook" feature → verify Sophia accepts
```

### Step 5 — Monitor 24h
```bash
# Tail Worker logs filtered for NOWPayments errors
npx wrangler tail --format pretty | grep -iE "nowpay|webhook|signature"
# Expected: 0 signature mismatches

# Count payment_events to confirm no drop
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT count(*) FROM payment_events WHERE created_at > unixepoch() - 86400"
# Should be ≥ pre-rotation count
```

### Step 6 — Revoke old keys in NOWPayments console
1. **Wait 24h** after Step 3 (ensures no in-flight webhooks signed with old secret)
2. NOWPayments admin → Settings → API Keys → **Revoke** old key
3. Settings → Webhooks → IPN Secret → **Delete** old secret
4. Log rotation in `docs/project-changelog.md` (date + reason + new key fingerprint last-4)

---

## 4. Rollback / Khôi Phục Nếu Hỏng

If post-rotation webhooks fail in volume:

```bash
# Put OLD secret back (you still have it from NOWPayments console)
npx wrangler secret put NOWPAYMENTS_API_KEY      # paste OLD value
npx wrangler secret put NOWPAYMENTS_IPN_SECRET   # paste OLD value

# Redeploy
npm run deploy:full
```

If old secrets already revoked in NOWPayments console → contact NOWPayments support; in the meantime, expect webhook drops until new keys propagate.

---

## 5. Common failure modes / Sai Sót Hay Gặp

| Symptom | Cause | Fix |
|---|---|---|
| Webhooks all reject signature | Wrong `NOWPAYMENTS_IPN_SECRET` set | Re-paste correct value via `wrangler secret put` |
| Some webhooks accept, some reject | Old/new IPN secret mid-cutover | Wait 24h then revoke old in console |
| Worker can't make outbound calls | API key revoked too soon | Restore old key, wait, retry rotation |
| Wallet address mismatch in invoices | `NOWPAYMENTS_WALLET` not updated | `wrangler secret put NOWPAYMENTS_WALLET` |

---

## 6. Security notes / Lưu Ý Bảo Mật

- **NEVER commit secrets to git** — secretlint pre-push hook catches but is last resort
- **NEVER share secrets via email/chat** — paste only via `wrangler secret put` interactive prompt
- **NEVER reuse keys across environments** — staging and PROD must have distinct keys
- **Rotation log** in `docs/project-changelog.md` should record date + reason + last-4 fingerprint only (never full value)

---

## 7. Reference / Tham Khảo

- [SECURITY.md](../../../SECURITY.md) — vuln disclosure policy
- [deployment-guide.md](deployment-guide.md) — full deploy flow
- [incident-response-playbook.md](incident-response-playbook.md) — incident steps if compromise suspected
- [escalation-contacts.md](escalation-contacts.md) — who to notify
- NOWPayments docs: https://documenter.getpostman.com/view/7907941/2s93JusNJt
