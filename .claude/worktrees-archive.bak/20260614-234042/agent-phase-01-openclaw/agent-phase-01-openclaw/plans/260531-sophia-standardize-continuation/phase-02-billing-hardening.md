# Phase 2: Billing Hardening

## Overview

- **Priority:** P0
- **Status:** pending
- **Mục tiêu:** Đảm bảo IPN reliability, dunning workflow, overage billing, reconciliation — zero revenue loss

## Requirements

### Functional
- NOWPayments IPN: idempotent processing, retry on failure, dead-letter queue
- PayOS backup: fallback khi NOWPayments fail, VN domestic payment flow
- Dunning: auto-suspend sau 3 lần payment fail, restore khi payment thành công
- Overage billing: track usage vượt tier limit, invoice tự động
- Reconciliation: daily report match payment gateway records vs DB

### Non-functional
- IPN processing < 5s
- Dunning cycle: 3 attempts × 3 days = 9 days trước khi suspend
- Reconciliation: nightly batch, alert nếu mismatch > 1%
- Zero duplicate charges (idempotency key per payment)

## Architecture

```
IPN Flow:
NOWPayments → /api/webhooks/nowpayments → Idempotency Lock → D1 Update → Inngest Event
                                                                         ↓
PayOS Backup → /api/webhooks/payos → Idempotency Lock → D1 Update → Inngest Event

Dunning: Inngest cron → check overdue → email → suspend → restore

Overage: Usage metering → quota enforcer → invoice → notify
```

## Related Code Files

| Action | Path |
|--------|------|
| IPN handlers | `land/billing/nowpayments-ipn-*.ts` |
| PayOS route | `app/api/webhooks/payos/route.ts` |
| Dunning | `land/billing/dunning/*` |
| Usage metering | `forest/usage-metering/` |
| Quota enforcer | `forest/quota/` |

## Implementation Steps

1. **IPN idempotency** — verify lock mechanism, add dead-letter queue
2. **Dunning state machine** — implement full lifecycle (active → overdue → suspended → restored)
3. **Overage billing** — track usage beyond tier, generate invoices
4. **Reconciliation** — nightly batch compare gateway vs DB
5. **Monitoring** — alert on payment failures, dunning actions, billing mismatches

## Todo List

- [ ] Audit NOWPayments IPN idempotency locks
- [ ] Add dead-letter queue for failed IPN
- [ ] Implement dunning state machine (3-attempt lifecycle)
- [ ] Wire dunning → Inngest cron
- [ ] Build overage billing tracker
- [ ] Build reconciliation batch job
- [ ] Add billing alerts (Slack/Telegram/email)
- [ ] E2E test: full payment → tier activation → dunning → restore

## Success Criteria

- IPN: zero duplicate processing, < 5s latency
- Dunning: auto-suspend after 3 failures within 9 days
- Reconciliation: nightly batch with < 1% mismatch threshold
- All billing flows pass E2E test

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| IPN replay attacks | HIGH | Idempotency lock + timestamp validation |
| Double charges | HIGH | Idempotency key per NOWPayments payment ID |
| Dunning false-positive suspend | MEDIUM | Grace period + manual override |
| Payment gateway downtime | MEDIUM | PayOS backup flow active |

## Security Considerations

- Verify IPN signatures (NOWPayments HMAC)
- Validate PayOS webhook headers
- Encrypt payment records at rest
- No raw payment amounts in logs
