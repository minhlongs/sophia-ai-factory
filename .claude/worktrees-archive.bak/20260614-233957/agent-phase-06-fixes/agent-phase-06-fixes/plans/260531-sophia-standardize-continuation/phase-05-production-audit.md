# Phase 5: Production Zero-Gap Audit

## Overview

- **Priority:** P0
- **Status:** pending
- **Mục tiêu:** E2E verification của mọi protected flow, đóng kín 100% trước khi scale

## Requirements

### Functional
- Setup Wizard: end-to-end flow (API key input → validate → save → first run)
- Telegram Bot: @Sophia_Bbot responds to all commands (/campaign, /status, /results)
- Payment Flow: NOWPayments IPN → tier activation → confirmation → access
- Checkout: mỗi tier (BASIC/PREMIUM/ENTERPRISE/MASTER) → payment page → success → redirect
- i18n: all keys present in vi.ts + en.ts, zero raw keys on production
- No-code doctrine: no operator-side credentials required

### Non-functional
- All flows: < 3s response time
- Checkout: < 5s redirect to payment provider
- Zero console errors in production
- Zero `:any` types in production code
- Zero `console.log` in production code

## Architecture

```
Audit Checklist:
1. Setup Wizard E2E
2. Telegram Bot commands
3. Payment Flow (NOWPayments + PayOS)
4. Checkout (all 4 tiers)
5. i18n sync (all keys exist in all locales)
6. Protected flow regression tests
7. Build + test suite (844+ tests)
8. Production deploy + SHA verification
```

## Related Code Files

| Action | Path |
|--------|------|
| Setup Wizard | `app/[locale]/setup-wizard/` |
| Telegram Bot | `tree/telegram/` |
| Payment routes | `app/api/webhooks/nowpayments/`, `app/api/webhooks/payos/` |
| i18n | `messages/vi.json`, `messages/en.json` |
| Tests | `src/__tests__/` |

## Implementation Steps

1. **E2E flow audit** — test mỗi protected flow từ đầu đến cuối
2. **i18n audit** — grep tất cả `t()` calls, verify tồn tại trong cả vi + en
3. **Type audit** — grep `:any`, fix tất cả
4. **Console audit** — grep `console.`, remove production logs
5. **Test suite** — ensure 844+ tests pass
6. **Production deploy** — `npm run deploy:full` + SHA verification + browser check

## Todo List

- [ ] E2E: Setup Wizard (API key input → validate → save → first run)
- [ ] E2E: Telegram Bot (/campaign, /status, /results)
- [ ] E2E: Payment Flow (NOWPayments IPN → tier activation)
- [ ] E2E: Checkout (4 tiers → payment → redirect)
- [ ] i18n audit: grep t() calls, verify all keys in vi + en
- [ ] Fix any missing/broken i18n keys
- [ ] Type audit: grep `:any`, fix all
- [ ] Console audit: grep `console.`, remove production logs
- [ ] Run full test suite (844+ tests must pass)
- [ ] Production deploy + SHA verification
- [ ] Browser verification (checkout each tier)

## Success Criteria

- All 5 protected flows pass E2E
- i18n: zero raw keys, all keys in vi + en
- Zero `:any` types in production code
- Zero `console.` in production code
- 844+ tests pass
- Production: SHA match, HTTP 200

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed i18n key | MEDIUM | Automated grep script |
| Checkout regression | HIGH | Test each tier individually |
| Test suite bloat | LOW | Run targeted tests first |
