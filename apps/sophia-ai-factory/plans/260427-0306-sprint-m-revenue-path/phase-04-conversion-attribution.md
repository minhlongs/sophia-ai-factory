# Phase M4 — Conversion Attribution

## Context Links
- Synthesis: `plans/reports/synthesis-260427-0250-revenue-pipeline-reality-check.md` (Blocker stages 7-8)
- Track 3: `plans/reports/researcher-260427-0250-track-03-affiliate-attribution-audit.md` (Stage 5 stub, Stage 6 missing)
- Source code (existing pattern): `apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts` (HMAC verification reference)
- Existing affiliate adapter: `apps/sophia-ai-factory/src/lib/ingestion/adapters/shareasale-adapter.ts` (stub — DO NOT use; ClickBank chosen instead)
- Existing discovery: `apps/sophia-ai-factory/src/lib/inngest/functions/auto-discover-affiliates.ts` (ClickBank already integrated for discovery)
- Built in M3: `migrations/0020-affiliate-offers-selected.sql`, `affiliate_clicks` table

## Overview
- **Priority:** P1 (BLOCKER — without this, click data has no monetary outcome)
- **Status:** pending
- **Effort:** ~1 day
- **Description:** ClickBank Instant Notification Service (INS) postback receiver at `/api/webhooks/clickbank` — receives sale events → matches `tid` (clickId from M3) → resolves campaign + user → calculates 70/30 commission split → INSERT `affiliate_conversions`.

## Key Insights
- ClickBank uses INS v6.0 postback; signs with HMAC-SHA1 of payload using vendor secret key
- `tid` (tracking ID) param in affiliate URL becomes `cvendthru` field in postback (custom tracking variable)
- ClickBank fires ONE postback per transaction: sale, refund, chargeback events (`transactionType` field)
- `transactionType=SALE` → credit user balance pending; `REFUND/CHARGEBACK` → reverse balance
- 60-day refund window (ClickBank policy) → `payout_status='pending_clearance'` for 60 days, then `payout_status='available'`
- Default split 70% user / 30% Sophia is NET commission (after ClickBank's own ~7.5% fee already removed from `amount` field)
- Idempotency required: same `receipt` (transaction ID) seen twice → skip duplicate insert

## Requirements

### Functional
- D1 schema: `affiliate_conversions` table
- Endpoint: `POST /api/webhooks/clickbank` — receives INS postback
- HMAC-SHA1 signature verification using `CLICKBANK_INS_SECRET` env var
- Parse postback: `receipt` (txn id), `transactionType`, `amount`, `currency`, `cvendthru` (= our `tid` = `affiliate_clicks.click_id`)
- Lookup chain: `tid` → `affiliate_clicks` → `campaign_id` + `user_id` + `offer_id`
- Commission calc: `commission_user = amount * 0.70`, `commission_sophia = amount * 0.30`
- INSERT `affiliate_conversions` row (idempotent on `receipt` + `event_type`)
- For SALE → `payout_status='pending_clearance'`, set `available_at = ts + 60 days`
- For REFUND/CHARGEBACK → INSERT reverse row with negative amount; if matching SALE present, mark its `payout_status='reversed'`
- Telegram notification to user: "💰 You earned ${commission_user} from your campaign!"

### Non-Functional
- Webhook responds 200 within 3s (ClickBank retries on timeout)
- Idempotent: same `receipt+event_type` re-delivery → no duplicate insert
- Files <200 LOC each
- Zero `:any` types
- Zod validation on parsed payload
- HMAC-SHA1 timing-safe comparison (prevent timing attacks)

## Architecture

### Webhook Flow
```
ClickBank merchant sale
  → ClickBank INS POST /api/webhooks/clickbank
    Headers: X-ClickBank-Signature: <hmac-sha1>
    Body: receipt=ABC123&transactionType=SALE&amount=120.00&cvendthru=<click_id>...
  → Verify HMAC-SHA1(body, CLICKBANK_INS_SECRET) === header
  → Parse + Zod validate
  → Idempotency check: SELECT 1 FROM affiliate_conversions WHERE receipt=? AND event_type=?
  → If exists → return 200 (skip)
  → SELECT campaign_id, user_id, offer_id FROM affiliate_clicks WHERE click_id = ?
  → If click not found → log + return 200 (cannot attribute, but ack to ClickBank)
  → Calculate commission_user = amount * 0.70 (or refund_amount * -0.70 for refund)
  → INSERT affiliate_conversions (receipt, click_id, campaign_id, user_id, offer_id, gross_amount, commission_user, commission_sophia, event_type, payout_status, available_at)
  → If SALE: notify user via Telegram (fire-and-forget)
  → Return 200
```

### Schema design

#### `migrations/0021-affiliate-conversions.sql`
```sql
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  receipt TEXT NOT NULL,                   -- ClickBank txn ID
  click_id TEXT,                            -- FK to affiliate_clicks.click_id (NULL if unattributed)
  campaign_id TEXT REFERENCES campaigns(id),
  user_id TEXT REFERENCES users(id),
  offer_id TEXT,
  network TEXT NOT NULL DEFAULT 'clickbank',
  event_type TEXT NOT NULL CHECK (event_type IN ('SALE','REFUND','CHARGEBACK','TEST')),
  gross_amount REAL NOT NULL,              -- merchant-net commission ClickBank reports
  currency TEXT NOT NULL DEFAULT 'USD',
  commission_user REAL NOT NULL,           -- 70% of gross_amount
  commission_sophia REAL NOT NULL,         -- 30% of gross_amount
  payout_status TEXT NOT NULL DEFAULT 'pending_clearance'
    CHECK (payout_status IN ('pending_clearance','available','paid','reversed','unattributed')),
  available_at INTEGER,                    -- Unix seconds: ts + 60 days for SALE
  paid_at INTEGER,                         -- Set when admin marks paid (M5)
  payout_id TEXT,                          -- Reference to payout batch (M5)
  raw_payload TEXT,                         -- Full INS payload for audit
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(receipt, event_type)              -- idempotency
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON affiliate_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_campaign ON affiliate_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conv_click ON affiliate_conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conv_payout ON affiliate_conversions(payout_status, available_at);
CREATE INDEX IF NOT EXISTS idx_conv_created ON affiliate_conversions(created_at DESC);
```

## Related Code Files

### Modify
- `apps/sophia-ai-factory/src/lib/inngest/functions/generate-campaign-db.ts` — extend `notifyUserByTelegram` import or add `notifyConversionEarned(userId, amount, campaignId)` helper

### Create
- `apps/sophia-ai-factory/migrations/0021-affiliate-conversions.sql`
- `apps/sophia-ai-factory/src/app/api/webhooks/clickbank/route.ts` — main handler (<150 LOC)
- `apps/sophia-ai-factory/src/lib/affiliates/clickbank-postback-parser.ts` — Zod schema + URL-encoded body parser (<100 LOC)
- `apps/sophia-ai-factory/src/lib/affiliates/clickbank-signature-verifier.ts` — HMAC-SHA1 timing-safe verify (<60 LOC)
- `apps/sophia-ai-factory/src/lib/affiliates/conversion-attributor.ts` — click→campaign→user lookup (<120 LOC)
- `apps/sophia-ai-factory/src/lib/affiliates/commission-calculator.ts` — 70/30 split (<60 LOC); split percentage from `@/config/revenue-share` constant
- `apps/sophia-ai-factory/src/config/revenue-share.ts` — `USER_SHARE_PCT = 0.70`, `SOPHIA_SHARE_PCT = 0.30` (<20 LOC)
- Tests: `clickbank-signature-verifier.test.ts`, `conversion-attributor.test.ts`, `commission-calculator.test.ts`, `route.test.ts`

### Delete
- None (leave `shareasale-adapter.ts` stub for future Sprint)

## Implementation Steps
1. Apply `migrations/0021-affiliate-conversions.sql` local + remote
2. Create `src/config/revenue-share.ts` with constants
3. Create `commission-calculator.ts`: pure function `calcCommission(grossAmount: number): {user, sophia}`
4. Create `clickbank-signature-verifier.ts`: HMAC-SHA1(body, secret) using Web Crypto API; timing-safe compare via `crypto.subtle.timingSafeEqual`-equivalent
5. Create `clickbank-postback-parser.ts`:
   - Zod schema for INS v6.0 fields: `receipt`, `transactionType`, `amount` (string→number), `currency`, `cvendthru`, `vendor`, `affiliate`
   - Parse URL-encoded body
6. Create `conversion-attributor.ts`:
   - `attributeClick(clickId: string)` returns `{campaignId, userId, offerId} | null`
   - SELECT FROM `affiliate_clicks` WHERE `click_id=?`
7. Create `src/app/api/webhooks/clickbank/route.ts`:
   - POST handler
   - Read raw body text
   - Verify signature header `X-ClickBank-Signature`
   - Parse + Zod validate
   - Idempotency check
   - Attribute click
   - Calculate commission
   - INSERT `affiliate_conversions`
   - If SALE + attributed → fire-and-forget notify user
   - Return 200 always (after sig check) so ClickBank doesn't retry-storm on app errors
8. Set CF Secret: `npx wrangler secret put CLICKBANK_INS_SECRET`
9. Configure ClickBank vendor account (manual in dashboard):
   - INS URL: `https://sophia.agencyos.network/api/webhooks/clickbank`
   - Secret key: same as CF Secret
10. Write 4 test files
11. `npm test` + `npm run build`
12. Deploy + SHA verify
13. Test live: ClickBank dashboard has "Send Test INS" → trigger → verify D1 row inserted with `event_type='TEST'` (filter out from real metrics later)
14. Wait for first real conversion from M3 short-link click → verify attribution chain end-to-end

## Todo List
- [x] Apply `migrations/0022-affiliate-conversions.sql` local (remote: pending deploy)
- [x] Create `src/config/revenue-share.ts`
- [x] Create `commission-calculator.ts` + tests
- [x] Create `clickbank-signature-verifier.ts` + tests
- [x] Create `clickbank-postback-parser.ts`
- [x] Create `conversion-attributor.ts` + tests
- [x] Create `src/app/api/webhooks/clickbank/route.ts` + tests
- [x] Add `notifyConversionEarned` helper to telegram notifications
- [ ] Set CF Secret `CLICKBANK_INS_SECRET` (manual: `npx wrangler secret put CLICKBANK_INS_SECRET`)
- [ ] Configure ClickBank vendor INS URL + secret in dashboard
- [x] `npm test` all green (1486 pass)
- [x] `npm run build` 0 errors
- [ ] Deploy + SHA-match verify
- [ ] Trigger ClickBank "Send Test INS" → verify D1 row appears
- [ ] E2E: real click on M3 short-link → real ClickBank sale → verify attribution

## Success Criteria
- Test INS postback from ClickBank dashboard inserts row in `affiliate_conversions` with `event_type='TEST'`
- Real SALE postback inserts row with `commission_user = 0.70 * gross_amount`
- Idempotent: re-deliver same `receipt` → no duplicate row
- Webhook responds 200 within 3s
- Invalid signature → 401, no insert
- User receives Telegram message "💰 You earned $X" within 30s of sale
- 4 test files all green; existing tests still green

## Risk Assessment + Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ClickBank INS retries up to 24x with backoff if 5xx returned | High | Med | Always return 200 after sig check; log internal errors but don't expose |
| `tid` truncated to 24 chars → click lookup fails | Med | High | M3 already noted; either use 16-byte UUIDv7 (24 chars hex) or store both full + truncated forms |
| Refund 60 days later — user already paid out | Med | High | `payout_status='pending_clearance'` 60d hold; M5 only pays from `available` status |
| Unattributed conversions (click_id mismatch) | Med | Med | Insert with NULL FKs + `payout_status='unattributed'`; admin dashboard surfaces these for manual review |
| ClickBank dashboard misconfigured (wrong URL) | Med | High | Document setup in `docs/clickbank-setup.md`; include in M4 todo |
| HMAC-SHA1 weak crypto | Low | Med | ClickBank uses SHA1 — not changeable; accept; future migrate to other networks with SHA256 |
| Test events pollute production metrics | Low | Low | `event_type='TEST'` filterable; M5 wallet excludes TEST |

## Security Considerations
- `CLICKBANK_INS_SECRET` rotation requires updating both CF Secret AND ClickBank dashboard atomically
- Timing-safe HMAC compare prevents timing oracle attacks
- Always return 200 AFTER signature verification (not before) — prevents amplification/probing
- Raw payload stored in `raw_payload` for audit; redact before sharing externally (may contain merchant PII)
- `cvendthru` is user-controlled (we set it during M3 redirect) — validate format before DB lookup (prevent SQL injection — use parameterized queries)
- Webhook endpoint is PUBLIC; no auth (signature is the auth) — must validate signature on EVERY request
- Rate-limit per IP (1000/min) to prevent DoS — use `sql-rate-limiter.ts`
- Do NOT log full secret in any error message
- `payout_status='paid'` transition (M5) must be atomic — one row at a time, no batch update without txn

## Next Steps (Dependencies)
- M5 (wallet) reads `affiliate_conversions WHERE payout_status='available' AND user_id=?` for balance calc
- Future Sprint: ShareASale postback receiver (similar pattern, MD5 sig instead of SHA1)
- Future Sprint: Amazon Associates report poller (no postback; daily report download)

## Unresolved Questions
1. ClickBank vendor account ownership: who in team has dashboard access to set INS URL? Need to confirm before M4 step 9.
2. Does `cvendthru` survive ClickBank's hop-link redirect, or is it stripped? Test required during M3+M4 integration.
3. What is exact ClickBank refund payment direction — does ClickBank reverse the original commission, or send a separate negative-amount postback? Affects whether to UPDATE original row or INSERT reverse row.
4. Should `payout_status='unattributed'` conversions be assignable manually by admin (claim-by-receipt UI)? Defer to Sprint O.
5. ClickBank charges affiliate a $1 fee on first sale per affiliate (after 5 refunds) — should this affect commission_user calc? Per docs, the `amount` field is post-fees so no — but verify.
6. Currency conversion: ClickBank can pay in non-USD; should `commission_user` always normalize to USD? MVP: store as-reported; M5 wallet sums in USD only.
