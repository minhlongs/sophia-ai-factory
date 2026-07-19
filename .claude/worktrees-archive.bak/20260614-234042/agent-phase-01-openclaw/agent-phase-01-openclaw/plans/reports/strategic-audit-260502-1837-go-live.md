# Strategic Audit — Sophia AI Factory Go-Live (2026-05-02)

## Brutal Verdict
**KHÔNG sẵn sàng nhận khách thật trong 7 ngày tới.** BYOK shipped 30 phút trước nhưng webhook HeyGen vẫn dùng **1 platform secret duy nhất** — khi customer A cấu hình HeyGen webhook, signature sẽ verify FAIL → mọi event bị 401, video kẹt forever ở "processing" cho tới khi cron 5-phút polling cứu (slow, expensive, fragile). Đây là P0 hard-blocker. Phần còn lại (compensation race, reconcile cron, IPN replay) đã chắc, nhưng pricing $4999/MASTER + zero customers + go-live áp lực = mistake. Khuyến nghị: hoãn 14 ngày, fix 5 P0, soft-launch 5 design partners trước khi public.

## 1. Architecture Vulnerabilities

| Sev | Vulnerability | Impact | Fix Effort |
|---|---|---|---|
| **P0** | HeyGen webhook dùng `process.env.HEYGEN_WEBHOOK_SECRET` (platform-wide) — không per-customer (`webhooks/heygen/route.ts:104`). Mỗi customer BYOK tự config HeyGen dashboard webhook → signature MISMATCH → 401 → 100% events fail. | Mọi video customer bị kẹt; cron polling backup nhưng tăng D1 reads + HeyGen API cost. | 1-2 ngày: thêm `user_webhook_secrets` table + lookup per `heygen_job_id` → user_id → secret |
| **P0** | Onboarding webhook handler dùng raw D1 query `where heygen_job_id = ?` — không scope user. Nếu 2 user có cùng heygen_job_id (HeyGen ID collision rare nhưng possible across accounts BYOK), cross-tenant write. | Cross-tenant data leak/corruption. | 4h: thêm composite index + scope query |
| **P0** | `getHeyGenClientSync()` (deprecated) vẫn export từ `heygen-client.ts:220`, dùng platform key — bất kỳ caller nào quên migrate sẽ silently bill platform's HeyGen account thay vì customer's. | $$$ leak, BYOK promise broken. | 4h: grep all callers, ép migrate, delete export |
| **P1** | `BYOK_MASTER_KEY` chưa có rotation pipeline. Nếu key compromise → toàn bộ user keys cần re-encrypt manually. | Single point of failure. Compliance reject. | 3 ngày: KMS-style versioned key (key_version column trên user_api_keys) |
| **P1** | Tier limits enforced ở UI (`tier-guard.ts`) — chưa thấy server-side gate trên endpoints `api/heygen/*`, `api/videos/*`. User thay localStorage hoặc gọi API trực tiếp có thể bypass. | Free user gen unlimited videos = $$$ leak. | 1 ngày: middleware gate dùng `tier-guard` ở mỗi `/api/videos/create` |
| **P1** | Credential rotation mid-fulfillment: video enqueued với key v1, cron retry sau 2 phút, user đổi key → cron decrypt key v2 + call HeyGen → HeyGen reject (different account, video không tồn tại). | Customer churn, support tickets. | 1 ngày: lưu `heygen_account_fingerprint` cùng video row, abort retry nếu mismatch |
| **P2** | Better Auth session: chưa thấy session rotation on password change / IP fingerprint. | Session hijack via stolen cookie. | 1 ngày: revoke all sessions on credential change |

## 2. Scalability @ 100 Customers

**Throughput audit:**
- **D1 cron storm @ peak**: video-status-sync mỗi 5 phút → SELECT processing rows → at 100 customers × 50 backlog = 5000 rows/run × decrypt per row → ~2-3s CPU per row × 50ms CF limit = **CHẾT**. Cron paid-plan cap = 30s. Will timeout @ ~30 customers backlog deep.
- **HeyGen polling burst**: 5000 GET requests every 5 min = 1000/min. Per-user BYOK isolates rate (50/min HeyGen quota), nhưng worker subrequest limit = 1000/req → **BREAK at ~50 customers** in single cron tick.
- **IPN burst**: NOWPayments retries failed IPN exponentially. Nếu Sophia 5xx 1 phút, bursts 500+ IPN khi recover. KV-based idempotency check OK, nhưng `recordIpnEvent` ghi D1 sync → write contention.
- **R2 download-and-store**: 5MB × 500 concurrent completed videos = 2.5GB egress in 5min — CF Worker 30s subrequest timeout per video → sequential processing → backlog grows.
- **Verdict**: Stack **HOLDS at 25 customers**, **DEGRADES at 50**, **BREAKS at 100**. Bottleneck = video-status-sync cron + R2 transfer.

**Fixes**:
- Batch HeyGen polling per-user (group by user_id, process in parallel với `Promise.allSettled`).
- Move R2 transfer to async queue (CF Queues binding) — separate from cron.
- D1 read replica (CF launched 2025) for cron analytics.

## 3. Payment Flow Risk

| Risk | Likelihood | Mitigation Status |
|---|---|---|
| **IPN replay** | Med | ✅ `recordIpnEvent` + `isPaymentProcessed` idempotency. Solid. |
| **Fake IPN with valid signature** (NOWPayments-side compromise) | Low | ⚠️ Cross-check `invoice_id` ↔ expected price. PARTIALLY done in dispatcher — but `actually_paid` không validate vs `price_amount` → underpayment fulfilled. **FIX: hard-reject `actually_paid < price_amount * 0.99`**. |
| **Customer pays double** (UI button click x2) | High | ❌ Không thấy front-end debounce. NOWPayments sẽ create 2 invoices, both finished → 2 fulfillments. **FIX: idempotency token in `order_id` (already partially) + dedupe on user+sku+24h window**. |
| **Crypto underpayment** (USDT TRC20 gas, exchange fees) | High | ⚠️ `partially_paid` status logged, NO action — customer paid 95%, gets nothing, complains. **FIX: auto-grant if ≥98%, else email manual review**. |
| **Refund flow** | High | ❌ Chỉ có `dispatchRefunded` skeleton. Crypto IRREVERSIBLE — refund = manual USDT send từ ops wallet. CEO chưa có ops wallet, chưa có process. **SHOWSTOPPER cho disputes**. |
| **Vietnam tax + USA customers** | Med | ❌ Zero KYC, zero tax invoice. $1M ARR sẽ trigger Vietnam GTGT 10% + US 1099. Phải có invoice issue. |
| **Operator payouts** (subscription tier earns commission) | Med | ⚠️ `payouts/` module exists, USDT addr validator OK, nhưng manual. At scale → fraud risk (fake operator). |

## 4. MVP → $1M ARR Roadmap

**Reality check on pricing**: Current = $49 one-time + $199/$399/$799/$4999 subscription. **$4999 MASTER là delusional** — agencies mua AI video không trả $5K/mo without enterprise sales motion (chưa có). $1M ARR @ $199/mo = **419 paying agencies**. Realistic? Maybe ở Vietnam SMB market.

**Q2 2026 (May-Jul) — Validate**:
- Soft-launch 5 design partner agencies miễn phí (HCM/Hà Nội). Goal: **3 agencies tạo 50 videos/tuần**.
- Pricing kill: drop $4999 MASTER, replace với "Custom — book demo". Keep 3 tiers: $99/$299/$799.
- Onboarding KPI: signup → first paid bundle <72h. Currently unknown — instrument `posthog-capture` đã có, bật funnel tracking.

**Q3 2026 (Aug-Oct) — Acquire**:
- Channel: Vietnam Facebook Ads agencies (10K+ TAM), TikTok Shop sellers (50K+).
- LTV target: $1500 (12mo × $99 + 3 bundle upsells). CAC budget: $300 (5:1 ratio).
- Content: 10 case study videos showcasing tool eating its own dog food.
- Target: **30 paying customers, $5K MRR**.

**Q4 2026 (Nov-Jan) — Scale**:
- Whitelabel: agencies resell Sophia under own brand, +30% commission. 100% margin since BYOK.
- Add: D-ID + Synthesia fallback (avoid HeyGen lock-in, redundancy).
- Target: **150 customers, $25K MRR**.

**Q1 2027 (Feb-Apr) — Enterprise**:
- $10K+ ACV deals: 5-10 enterprise (Vietcombank, FPT, etc.). Custom features unlock at $799 tier.
- Target: **300 customers, $60K MRR ($720K ARR), trajectory to $1M Q3 2027**.

**Churn levers (tier features that hook)**: avatar custom training (PREMIUM), multi-language (ENTERPRISE), API/webhooks (MASTER), SSO+audit log (MASTER).

## 5. Tech Stack 6mo Roadmap

**30 days**:
- ✅ Fix 5 P0 (BYOK webhook secret per-user, tier server gate, getHeyGenClientSync removal, IPN underpayment, double-pay dedupe).
- ✅ Sentry + CF Workers Analytics dashboards (currently silent).
- ✅ Synthetic monitor: end-to-end signup→bundle→video flow, run 4x/day.
- ✅ Refund SOP doc + ops USDT wallet (TRC20).

**90 days**:
- Cloudflare Queues for video R2 transfer (decouple from cron).
- D1 → keep (limit = 10GB, OK till 5K customers). Pre-emptive: Postgres (Supabase) for analytics-heavy modules (`signals`, `usage-export`) at 1K customers.
- BYOK key versioning + rotation pipeline.
- Email: Resend works at <50K/mo; SES fallback ready by 200 customers.

**180 days**:
- Multi-provider video: D-ID + Synthesia routing (`provider-router.ts` skeleton ready). Failover when HeyGen down or customer key invalid.
- Internationalization: Add `id` (Indonesian) + `th` (Thai) — SEA agencies are TAM. Skip Chinese until enterprise pull.
- Compliance: SOC 2 Type 1 ($15K, 4mo) — needed for enterprise deals Q1 2027.
- Mobile: SKIP. Agencies use desktop. Save $50K dev cost.

**Build vs Buy**: Stay with CF Workers + D1. Buy Sentry, PostHog (already have), Resend. Don't build observability platform.

## P0 Fixes Required Before First Real Customer

1. **HeyGen per-customer webhook secret** (1-2 days, F-stack engineer). Schema migration + lookup logic + customer onboarding doc update.
2. **Server-side tier limit gate** (1 day). Middleware on `/api/videos/*`, `/api/heygen/*`. Block if monthly count > tier limit.
3. **Remove `getHeyGenClientSync()`** (4h). Audit callers, force migration. Each leftover call = $$ leak.
4. **IPN underpayment guard** (4h). Reject if `actually_paid < price_amount * 0.99`; auto-fulfill if ≥0.99.
5. **Double-pay dedupe** (4h). Front-end loading state + back-end window check `user+sku+24h → skip`.
6. **Refund SOP + ops wallet** (1 day). Document manual flow, create TRC20 multisig, train CEO.
7. **Drop MASTER $4999 from public pricing** (1h). Replace with "Contact sales".

**Total: ~6-7 engineering days.**

## P1 — Within 30 Days

1. BYOK key versioning + rotation runbook.
2. Credential-rotation-mid-fulfill abort logic (`heygen_account_fingerprint`).
3. Cron batch-by-user HeyGen polling (split user_id groups).
4. Sentry alert thresholds: error rate >1%, p95 latency >2s, cron failure.
5. Synthetic monitor (Better Stack or Checkly) — end-to-end every 15min.
6. Better Auth session revoke on password/key change.
7. Cloudflare Queues for R2 transfer (decouple from cron).

## P2 — Within 90 Days

1. D-ID + Synthesia provider routing (HeyGen failover).
2. Postgres mirror for analytics (read replica from D1 dump).
3. Whitelabel mode for resellers.
4. KYC + tax invoice (Vietnam GTGT compliance).
5. SOC 2 readiness audit kickoff.
6. Operator payout fraud detection (velocity + addr blacklist).
7. i18n: Indonesian + Thai.

## Open Questions

- CEO's go-live deadline: pháp lý gì? Đã ký contract 1 customer chưa? (Nếu rồi → must talk to them about delay).
- Ops USDT wallet ai control? Multisig hay single key? Backup recovery plan?
- Vietnam tax: đăng ký kinh doanh dạng gì (TNHH/CT cổ phần)? VAT invoice cho customers VN?
- HeyGen contract: BYOK có vi phạm ToS HeyGen không? Một số AI vendors cấm reseller.
- Có agencies design partner sẵn chưa? Nếu chưa, làm sao test flow trong 14 ngày?
- $1M ARR là personal goal CEO hay đã pitch investors? Áp lực thực tế?
- Stack lock-in: Cloudflare account ai own? Bus-factor 1?
