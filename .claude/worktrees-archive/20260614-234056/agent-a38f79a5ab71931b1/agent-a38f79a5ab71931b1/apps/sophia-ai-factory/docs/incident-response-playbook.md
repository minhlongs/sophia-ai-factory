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

## 4a. Role assignments / Phân Công Vai Trò

> Milestone B deliverable (Enterprise-ready 85). Defined per SOC 2 CC6.1 separation-of-duties requirement.
> Reviewed quarterly. Update when personnel change.

| Role | Name / Contact | Responsibilities | Auth level | On-call rotation |
|------|---------------|------------------|------------|------------------|
| **Incident Commander (IC)** | [NAME] — [contact] | Declares incident, coordinates response, makes go/no-go decisions | Deploy attestation signer (DEPLOY_KEY_1) | Primary |
| **Incident Responder** | [NAME] — [contact] | Executes mitigation steps, runs diagnostics, applies rollback | Deploy attestation signer (DEPLOY_KEY_2) | Secondary |
| **Communications Lead** | [NAME] — [contact] | Customer + internal notifications, status page updates | Read-only prod access | Tertiary |
| **Security Reviewer** | [NAME] — [contact] | Assesses security impact, determines P0/P1 severity, reviews AuthZ fixes | Admin dashboard, D1 direct | On-call |
| **Deploy Operator** | [NAME] — [contact] | Executes deploy + attestation, signs manifest | DEPLOY_KEY holder | Rotating |

**Minimum viable response:** Any two of IC, Responder, or Security Reviewer must be reachable within SLA. If fewer than two are available → escalate to Communications Lead to notify customers of delay.

**Escalation path for unavailability:**
1. Communications Lead pages third-party on-call vendor (CF support, Inngest support)
2. If no vendor SLA → public status page notice + hourly customer email until staffing restored

---

## 4b. Quarterly access review / Rà Soát Quyền Truy Cập Hàng Quý

> Milestone B deliverable. SOC 2 CC6.1, CC6.3 requirement.
> Conducted every 3 months. Document results in `plans/audits/access-review-<YYYY-Q#>.md`.

### Review checklist

- [ ] **CF Worker secret inventory:** Enumerate all secrets via `wrangler secret list`. Verify each secret has a known owner. Revoke any orphaned secrets (no owner, no rotation date).
- [ ] **DEPLOY_KEY holders:** Confirm all `DEPLOY_KEY_N` holders are current operators. Revoke keys for departed personnel immediately.
- [ ] **Admin dashboard access:** Query `user_profiles` D1 table for `role='admin'` entries. Confirm each is an active operator. Downgrade or remove stale admin accounts.
- [ ] **D1 direct access:** List all operators with `wrangler d1 execute` capability (via CF API tokens). Token scoped to minimum required permissions.
- [ ] **GitHub/GitLab deploy permissions:** Review branch protection on `main`. Confirm required reviews (minimum 1) still enforced.
- [ ] **Third-party service accounts:** NOWPayments, Inngest, Telegram, Sentry, Better Stack — confirm each account has >1 admin. Rotate any single-admin accounts.
- [ ] **SSH / machine access:** Review M1 deploy machine access. Rotate any shared credentials.
- [ ] **Service account rotation schedule:** Verify secrets rotated within policy (see `docs/secret-rotation-runbook.md`). Flag overdue rotations.

### Review output template

```markdown
# Access Review <YYYY> Q<#>

Date: <YYYY-MM-DD>
Reviewer: <role + name>

## Secrets reviewed: <count> total, <count> overdue for rotation

## DEPLOY_KEY holders: <count> (expected: 2-4)

## Admin accounts: <count> active, <count> revoked this quarter

## Third-party admins: <count per service>

## Actions taken:
- Revoked: <list>
- Rotated: <list>
- Downgraded: <list>

## Next review: <YYYY-MM-DD> (Q<#> + 3 months)
```

### Integration with deploy attestation

The deploy attestation system (`scripts/deploy-with-sha.sh` Step 0.7) records separation-of-duties evidence at deploy time:
- Audit mode is default: logs verified signature count and continues
- Strict mode: set `REQUIRE_DEPLOY_ATTESTATION=1` to require ≥2 distinct `DEPLOY_KEY_N` signatures per deploy
- Emergency bypass (`SKIP_ATTESTATION=1`) MUST be re-attested within 24h or next business day when strict mode is active
- Bypass events logged in deploy manifest → surfaced in quarterly access review

### Integration with incident response

When P0/P1 incidents occur:
1. IC verifies all responders have current access before granting emergency credentials
2. Post-incident review includes access audit: "Were all responders authorized? Any privilege escalation observed?"
3. Findings feed into next quarterly access review action items

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
