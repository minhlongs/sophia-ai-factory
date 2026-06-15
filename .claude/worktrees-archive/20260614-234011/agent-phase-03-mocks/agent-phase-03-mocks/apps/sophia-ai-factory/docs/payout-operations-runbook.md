# Payout Operations Runbook

> On-call playbook for the dual-rail affiliate payout system (Stripe Connect Express + NOWPayments USDT).
> Owner: Platform on-call. Last updated: 2026-05-11.

---

## System at a glance

```
conversion-to-ledger (Inngest) ──► commission_ledger (pending → payable @ payable_at)
                                              │
                                              ▼
                                payout-batcher-weekly (cron 0 12 * * 0)
                                              │
                              resolve-payout-method (per affiliate)
                                              │
                                ┌─────────────┴──────────────┐
                                ▼                            ▼
                      Stripe Transfer (fiat USD)    NOWPayments mass payout (USDT)
                                │                            │
                                ▼                            ▼
                      payout_batches.status=confirmed (via IPN/poll)
```

| Concern | Source of truth |
|---|---|
| Stripe Connect account status per user | `user_payout_settings` (cols `stripe_account_id`, `stripe_account_status`, `stripe_payout_enabled`) |
| Crypto wallet rows per affiliate | `payout_methods` (default = `is_default=1`) |
| Per-conversion accrual | `commission_ledger` (status pending/payable/paying/paid/clawback/clawed_back/rejected) |
| Per-batch lifecycle | `payout_batches` (queued/sending/confirmed/failed) |
| Stripe webhook idempotency | `stripe_connect_events.event_id` |

**Routing precedence** (see `src/land/payouts/resolve-payout-method.ts`): Stripe wins if `stripe_payout_enabled=1 AND stripe_account_id IS NOT NULL`, else fallback to default `payout_methods` row, else affiliate skipped.

**Cron schedule:** `payout-batcher-weekly` runs Sunday 12:00 UTC (`0 12 * * 0`) via Inngest.

---

## Common incidents

### 1. Affiliate stuck in Stripe Connect KYC

**Symptoms:** User completed onboarding link but `/dashboard/affiliate` still shows "pending"; `user_payout_settings.stripe_account_status='pending'` after >24h.

**Triage:**
```bash
# Check Stripe-side status (server-only — needs STRIPE_SECRET_KEY)
npx wrangler d1 execute sophia-raas-db --remote --command="\
  SELECT user_id, stripe_account_id, stripe_account_status, stripe_payout_enabled, stripe_last_event_at \
  FROM user_payout_settings WHERE user_id = '<USER_ID>'"
```

**Resolution:**
1. Compare `stripe_last_event_at` with current time. If >24h stale → likely missed webhook.
2. Manual reconcile: open Stripe Dashboard → Connect → Accounts → search by `stripe_account_id` → confirm KYC state.
3. If Stripe shows enabled but DB shows pending → webhook drift. Replay via Stripe Dashboard → Developers → Webhooks → endpoint `/api/webhooks/stripe-connect` → resend last `account.updated`.
4. If KYC truly stuck on Stripe side → ask user to revisit `POST /api/connect/onboard` (generates fresh Account Link, expires in ~5min).

---

### 2. Webhook signature failures spam in logs

**Symptoms:** Sentry shows recurring `[stripe-connect] webhook signature verification failed` from `/api/webhooks/stripe-connect`.

**Root causes (in order of likelihood):**
1. **Wrong secret bound:** Stripe → Developers → Webhooks → endpoint shows different signing secret than wrangler `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. **Body mutation:** middleware/proxy modified the raw body. Confirm `route.ts` reads `await req.text()` BEFORE any parse.
3. **Old retry from rotated secret:** if you just rotated the secret, Stripe retries old events for ~3 days with the old signature.

**Verify secret matches:**
```bash
npx wrangler secret list --name sophia-ai-factory | grep STRIPE
# Compare timestamp with Stripe Dashboard last-rotation timestamp
```

**Resolution:**
- If mismatch → `npx wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET --name sophia-ai-factory` then paste current Stripe signing secret.
- If rotation-related → wait out the retry window (3d). Stripe stops retrying on 2xx.

---

### 3. Payout batch failed mid-dispatch

**Symptoms:** `payout_batches.status='failed'` or batch row stuck in `sending` >1h. Affiliate inquiry: "payout not received".

**Triage queries:**
```bash
# Get batch + linked ledger
npx wrangler d1 execute sophia-raas-db --remote --command="\
  SELECT id, status, payment_method, total_cents, external_payment_id, created_at, finalized_at \
  FROM payout_batches WHERE id = '<BATCH_ID>'"

npx wrangler d1 execute sophia-raas-db --remote --command="\
  SELECT id, status, commission_cents FROM commission_ledger WHERE payout_batch_id = '<BATCH_ID>'"
```

**Resolution paths:**

| `payment_method` | `external_payment_id` | Action |
|---|---|---|
| `stripe_connect` | NULL | Transfer never created. Cron will retry on next Sunday (ledger rows rolled back to `payable`). No manual action unless urgent. |
| `stripe_connect` | `tr_*` set | Transfer reached Stripe. Check Stripe Dashboard → Connect → Transfers → search by ID. If `succeeded` but our DB says `failed` → status drift; manually update `payout_batches.status='confirmed'`. |
| `usdt_*` | NULL | NOWPayments call failed before withdrawal id. Rolled back. Retry next cron. |
| `usdt_*` | `mock_*` | Dev/test mode (`NOWPAYMENTS_API_KEY` unset). Production must have key set — escalate. |
| `usdt_*` | real id | NOWPayments IPN drift. Re-query NOWPayments status API + update via admin tool. |

**Force-retry stuck "sending" batch:**
```sql
-- Rollback paying ledger rows + reset batch (cron will pick up next run)
UPDATE commission_ledger SET status='payable', payout_batch_id=NULL
  WHERE payout_batch_id='<BATCH_ID>' AND status='paying';
UPDATE payout_batches SET status='failed', finalized_at=strftime('%s','now')
  WHERE id='<BATCH_ID>';
```

---

### 4. Cron skipped a Sunday

**Symptoms:** No new `payout_batches` rows for the week; affiliates with `>=$10` payable not paid.

**Triage:**
1. Inngest dashboard → `payout-batcher-weekly` function → check last invocation timestamp.
2. If no invocation: confirm Inngest connection alive via `/api/inngest` health.
3. If invocation present but 0 batches: check `commission_ledger` for `status='payable'` rows — possibly no one met threshold.

**Manual trigger:**
- Inngest dashboard → `payout-batcher-weekly` → "Trigger" button (forces immediate run).
- The cron is idempotent (deterministic `batchId` via ISO week + atomic claim) — safe to fire twice.

---

### 5. Stripe Transfer succeeded but affiliate disputes amount

**Symptoms:** Affiliate reports "I expected $X but got $Y".

**Investigation:**
```bash
# Recompute from ledger
npx wrangler d1 execute sophia-raas-db --remote --command="\
  SELECT id, commission_cents, withheld_cents, status FROM commission_ledger \
  WHERE payout_batch_id = '<BATCH_ID>' ORDER BY created_at"
```

Sum should equal `payout_batches.total_cents = SUM(commission_cents - withheld_cents)`. `withheld_cents` = VN PIT 5% (when `tenant_settings` namespace=`vn_pit` has `{"enabled":true}`).

**Common explanations:**
- VN PIT 5% withheld (`withheld_cents > 0`) — show breakdown.
- Clawback rows (negative `commission_cents`) reducing net — disclose disputed conversions.
- Stripe fees (~0.25% + $2 per payout for Connect Express) deducted by Stripe before deposit. Sophia transfers gross; Stripe nets fees on payout schedule.

---

### 6. Payout reversal (clawback after payment)

**Symptoms:** Conversion proved fraudulent AFTER `commission_ledger.status='paid'`. Need to recover.

**Resolution (carefully — money already left):**

1. **Stripe Transfer reversal** (only within 90d of transfer):
   ```bash
   # Manual via Stripe Dashboard → Connect → Transfers → click transfer → "Reverse"
   # OR Stripe CLI: stripe transfers create_reversal <TRANSFER_ID> --amount <CENTS>
   ```
2. **USDT clawback**: cannot auto-reverse on blockchain. Open ticket with affiliate for voluntary return, then:
   ```sql
   -- Record clawback (negative ledger row offsets next batch)
   INSERT INTO commission_ledger
     (id, tenant_id, affiliate_id, conversion_event_id, offer_id,
      gross_cents, commission_pct, commission_cents, status, payable_at, created_at, updated_at)
   VALUES
     ('clw_<UUID>', '<TENANT>', '<AFFILIATE>', '<ORIG_CONV_ID>_clawback',
      '<OFFER>', 0, 0, -<ORIGINAL_CENTS>, 'clawback',
      strftime('%s','now'), strftime('%s','now'), strftime('%s','now'));
   ```

See `src/land/payouts/clawback-handler.ts` for the programmatic path triggered by `conversion.clawback` Inngest events.

---

## Rollback procedures

### Roll back a deploy that broke payouts

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "payout cron breakage <ref>" --yes
# Confirms by listing recent versions and picking previous
```

After rollback, verify cron stops emitting errors in Inngest dashboard.

### Roll back a migration (last resort)

D1 has no transaction-level migration rollback. For destructive changes only:

```bash
# Snapshot first (D1 admin → Backups)
# Then issue inverse SQL manually:
npx wrangler d1 execute sophia-raas-db --remote --file=migrations/<NNNN>-rollback.sql
```

Migration `0106-revenue-split-tables.sql` is `CREATE TABLE IF NOT EXISTS` → idempotent, no rollback path needed. To remove tables would require `DROP TABLE` (will delete data).

---

## Secrets reference

Required for full payout pipeline (CF Workers wrangler secrets):

| Secret | Used by | Failure mode if missing |
|---|---|---|
| `STRIPE_SECRET_KEY` | `getStripeClient()` lazy init | Throws on first Connect API call; Stripe rail completely unavailable |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `verifyWebhookSignature()` | All webhooks rejected; account status frozen at last-known |
| `NOWPAYMENTS_API_KEY` | `queueBatch()` | Falls back to mock mode (`mock_<batchId>_<ts>`) — INVALID in prod |
| `PAYOUT_ENC_KEY` | `decryptSecret()` for crypto addresses | NOWPayments rail fails (cannot decrypt recipient) |

```bash
# Audit
npx wrangler secret list --name sophia-ai-factory | grep -E "STRIPE|NOWPAYMENTS|PAYOUT_ENC"
```

---

## Monitoring touchpoints

- **Inngest dashboard:** `payout-batcher-weekly` invocation history, per-step durations, retry counts.
- **Sentry:** filter `tag:module=payouts` for ledger/batch errors.
- **D1 quick stats:**
  ```sql
  SELECT status, COUNT(*), SUM(commission_cents) FROM commission_ledger GROUP BY status;
  SELECT status, COUNT(*), SUM(total_cents) FROM payout_batches GROUP BY status;
  ```
- **Stripe Dashboard:** Connect → Overview shows aggregate transfer volume; Reports → Connect → Reconciliation for fee breakdown.

---

## Escalation

| Severity | Trigger | Action |
|---|---|---|
| P0 | Payouts blocked across all affiliates >24h | Page on-call, post in #incidents, rollback last deploy |
| P1 | Single rail (Stripe or USDT) broken | Disable that rail in resolver (force fallback), notify affected users |
| P2 | Individual stuck batch/account | Triage per section above, no broadcast needed |
| P3 | Webhook retries / docs gap | Ticket for next sprint |

---

## Seealso

- `src/land/payouts/resolve-payout-method.ts` — rail precedence logic
- `src/land/payouts/payout-batcher.ts` — weekly cron orchestrator
- `src/land/payouts/stripe-connect.ts` — Stripe SDK wrappers
- `src/land/payouts/nowpayments-mass-payout.ts` — NOWPayments client
- `migrations/0105-affiliate-stripe-connect.sql` — Connect schema additions
- `migrations/0106-revenue-split-tables.sql` — ledger/batches/methods tables
- `docs/disaster-recovery.md` — broader DR procedures
- `~/plans/260510-0603-sophia-gap-plan/phase-03-stripe-kyc.md` — phase tracking

---

## Unresolved

- No automated reconciliation job comparing Stripe Dashboard transfers vs `payout_batches` — drift detected only on customer complaint.
- USDT clawback flow requires manual affiliate cooperation; no smart-contract escrow yet.
- VN PIT remittance to tax authority is not automated; `withheld_cents` accumulates in ledger but no monthly export job exists.
