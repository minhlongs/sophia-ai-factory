# Real-Money Smoke Playbook — STARTER_BUNDLE One-Time ($49 USDT)

**For:** Sophia AI Factory CEO / ops team
**When:** After cron infra (P01) + latent fixes (P04) shipped + cron_run_log shows fresh entries
**Risk:** $49 USDT (real money). NOT reversible if smoke succeeds. Refund flow tested separately.
**Goal:** Prove the full chain Pay → IPN → Queue → HeyGen → Email → Dashboard works for a real human.

---

## Pre-flight Checklist

- [ ] Production HTTP 200: `curl -sI https://sophia.agencyos.network`
- [ ] `/api/version` shortSha = current `git rev-parse HEAD | cut -c1-8` (proves latest deploy)
- [ ] cron_run_log has fresh rows for `fulfillment-retry` (within last 5 min) — proves CF Workers schedules firing
- [ ] HeyGen webhook URL registered on HeyGen dashboard: `https://sophia.agencyos.network/api/webhooks/heygen` (Settings → Webhooks → Add)
- [ ] Test wallet funded with ≥$60 USDT TRC20 (NOWPayments uses TRC20 by default; $49 + ~$2 network fee + buffer)
- [ ] Browser: incognito session OR clean cookies
- [ ] Screenshots dir: `plans/reports/screenshots-real-smoke-260502/`
- [ ] Test email account: a real inbox you can check (e.g., yourself@gmail.com — NOT a spam-trap)

## Step 1 — Sign Up / Login

1. Go to `https://sophia.agencyos.network/vi/login` (or `/en/login`)
2. Sign up with REAL email you control + password
3. Login → land on `/dashboard`
4. **Capture:** screenshot `01-logged-in.png`

## Step 2 — Pricing Page

1. Navigate to `https://sophia.agencyos.network/vi/pricing`
2. Confirm **Gói Mua Lẻ** card visible:
   - Price: $49 USD
   - "10 video · Hiệu lực 12 tháng"
   - Features list (6 bullets)
   - "Mua ngay" CTA button
3. **Capture:** `02-pricing-bundle-card.png`

## Step 3 — Click Checkout

1. Click **Mua ngay** on STARTER_BUNDLE card
2. Browser should redirect to `https://nowpayments.io/payment?iid=…&order_id=sophia_<userid>_<ts>&success_url=…&cancel_url=…`
3. **Capture:** `03-nowpayments-invoice.png` (full URL bar visible)

## Step 4 — Pay via NOWPayments

1. NOWPayments page shows:
   - Amount: $49.00 USD
   - Crypto: USDT (TRC20)
   - Wallet address (copy this)
   - QR code (alternative)
   - Countdown timer (~20 min)
2. From your wallet (TronLink, Trust Wallet, exchange, etc.):
   - Send the EXACT amount of USDT shown (NOWPayments will compute $49 → USDT rate)
   - To the displayed TRC20 address
   - With ENOUGH gas (TRX) for the transaction
3. Wait for blockchain confirmation (1-3 minutes typically)
4. NOWPayments page updates: "Payment received" → "Confirmed"
5. Page auto-redirects to `/payment-success?sku=STARTER_BUNDLE&order_id=…`
6. **Capture:** `04-payment-confirmed.png` + `05-success-redirect.png`

**Failure modes to watch:**
- Wallet sends wrong amount → NOWPayments shows "underpayment"; will refund minus fees automatically
- Network congestion → confirmation may take 5-10 min
- Wrong network (TRC20 vs ERC20) → funds lost, NOT recoverable

## Step 5 — IPN Arrives + Fulfillment Triggers

Within ~30 seconds of NOWPayments confirming, IPN should hit `/api/webhooks/nowpayments` → `dispatchFinished` → `handleOneTimeFinished` → `triggerOneTimeFulfillment`:

1. Inspect via SSH-equivalent (Cloudflare Workers tail):
   ```bash
   npx wrangler tail sophia-ai-factory --format pretty | grep -E "(IPN|OneTime|Fulfillment|HeyGen)"
   ```
2. Expected log lines:
   - `[IPN/Dispatch] Routing to one-time handler invoiceId=…`
   - `[IPN/OneTime] Purchase paid userId=… purchaseId=… credits=10`
   - `[OneTimeFulfillment] Video queued userId=… purchaseId=… heygenJobId=…`

If NO IPN within 2 minutes:
- Check NOWPayments dashboard → Webhooks → recent deliveries (status, response)
- Verify `NOWPAYMENTS_IPN_SECRET` env var matches dashboard config

## Step 6 — Verify D1 Rows

Run from local dev machine:
```bash
cd apps/sophia-ai-factory
# Check user_purchases
npx wrangler d1 execute sophia-raas-db --remote --config wrangler.toml --command \
  "SELECT id, kind, sku, status, credits_remaining, payment_id FROM user_purchases WHERE user_id='<YOUR_USER_ID>' ORDER BY created_at DESC LIMIT 1;"
# Expected: kind='one_time', sku='STARTER_BUNDLE', status='paid', credits_remaining=10

# Check videos
npx wrangler d1 execute sophia-raas-db --remote --config wrangler.toml --command \
  "SELECT id, status, attempt_count, last_attempt_at, heygen_job_id FROM videos WHERE user_id='<YOUR_USER_ID>' ORDER BY created_at DESC LIMIT 1;"
# Expected initially: status='queued' OR 'processing', heygen_job_id=<set>
```

## Step 7 — "Generating" Email Lands

Within ~5 seconds of fulfillment trigger:

1. Check inbox (and spam folder)
2. Subject: `[Sophia AI] Đơn hàng đã nhận — video đang tạo` (Vi) or `Order received — your video is being created` (En)
3. Body has `/dashboard/orders` link
4. **Capture:** `06-generating-email.png`

## Step 8 — Status Page Auto-Updates

1. Open `https://sophia.agencyos.network/vi/dashboard/orders` in browser
2. Card shows STARTER_BUNDLE order with timeline:
   - **Paid** ✓ (timestamp)
   - **Đang tạo video** (loading spinner)
   - **Hoàn thành** (greyed out, pending)
3. SWR auto-refreshes every 30s
4. **Capture:** `07-orders-page-pending.png`

## Step 9 — HeyGen Renders (~3-5 min)

Either:
- **Path A (webhook):** HeyGen calls `/api/webhooks/heygen` with `event_type='avatar_video.success'` → handler updates videos row to `status='completed'` + downloads to R2 + sends ready email
- **Path B (cron):** `video-status-sync` (every 5 min) polls HeyGen → finds completed → same as above

Watch tail logs:
- `[HeyGenWebhook] avatar_video.success videoId=…`
- `[VideoStorage] downloadAndStore success r2Key=…`
- `[BundleReadyEmail] Sent userId=…`

## Step 10 — "Ready" Email + Dashboard Updates

1. Inbox: subject `[Sophia AI] Video của bạn đã sẵn sàng!`
2. Body has watch link OR direct video URL
3. Click `/dashboard/orders` link in email
4. Page now shows: timeline 4/4 done, "Xem video" button
5. Click button → video plays in `<video>` tag
6. **Capture:** `08-ready-email.png`, `09-orders-completed.png`, `10-video-playing.png`

## Step 11 — Verify Streaming + Auth Gate (F10 test)

1. While logged in: `curl -i 'https://sophia.agencyos.network/api/videos/<VIDEO_ID>/url' -H 'Cookie: <YOUR_SESSION>'`
   - Expected: HTTP 200 + `Content-Type: video/mp4` + body bytes
2. Logout, retry without cookie:
   - Expected: HTTP 401 unauthorized
3. From a different user's session, try same URL:
   - Expected: HTTP 404 (not 403 — we don't leak existence)

## Step 12 — Refund Test (optional, separate $1-5 transaction)

If you want to verify F10 revoke flow:
1. From NOWPayments dashboard, initiate a refund for the $49 transaction (or do this with a smaller test)
2. Wait IPN `payment_status='refunded'`
3. Tail: `[IPN/OneTime] Purchase refunded — credits zeroed userId=…`
4. Check D1: `SELECT access_revoked FROM videos WHERE purchase_id=…` → should be 1
5. Hit video URL endpoint → expect 403 forbidden
6. /dashboard/orders shows "Access Revoked" banner

## Sign-off Criteria

- [ ] All 10 screenshots captured
- [ ] Total elapsed time Pay → Email Ready ≤ 10 minutes
- [ ] Zero error logs in `wrangler tail` during the flow
- [ ] D1 rows match expected states
- [ ] Cleanup: optional — can keep the test purchase as proof, or refund test (Step 12)

## Failure Recovery

If any step fails:
1. Take screenshot of error state + console errors
2. Tail logs: `npx wrangler tail sophia-ai-factory --format pretty 2>&1 | tee /tmp/smoke-fail-$(date +%s).log`
3. Snapshot D1: `SELECT * FROM user_purchases WHERE user_id=...; SELECT * FROM videos WHERE user_id=...;`
4. File issue with: state, logs, screenshots, last successful step
5. The retry cron (every 2 min) will autonomously attempt to recover queued videos that didn't reach HeyGen

## Open Questions

1. Is HeyGen webhook URL ALREADY registered on the HeyGen dashboard? (If not, F4 won't fire — fall back to cron at 5 min latency)
2. Has CRON_SECRET been set as Worker secret? (Currently scheduled handler uses `x-cf-cron: true`, but external probes need it)
3. Test wallet funding — who has TRX gas in the test wallet?
4. Refund test: do we want to test on the $49 smoke transaction itself, or a separate small one?
