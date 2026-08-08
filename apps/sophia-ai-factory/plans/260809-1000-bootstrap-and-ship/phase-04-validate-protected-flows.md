# Phase 04: Validate Protected Flows

**Priority:** CRITICAL
**Status:** Pending
**Dependencies:** Phase 03

---

## Context Links
- Protected flows per CLAUDE.md:
  1. Setup Wizard — BYOK onboarding (OpenRouter, ElevenLabs, D-ID, HeyGen)
  2. Telegram Bot — @Sophia_Bbot commands (/campaign, /status, /results)
  3. Payment Flow — NOWPayments IPN webhook → tier activation

---

## Overview
Manually or via E2E tests verify all three protected flows work end-to-end. These must NEVER break.

---

## Protected Flow Details

### 1. Setup Wizard (BYOK Onboarding)
- **Files:** `src/app/[locale]/setup/`, `src/tree/byok/`, `src/tree/credentials/`
- **Test:** Complete wizard flow with mock API keys
- **Verify:** Keys stored encrypted, validation works, redirect to dashboard

### 2. Telegram Bot (@Sophia_Bbot)
- **Files:** `src/tree/telegram/`, webhook handler at `src/app/api/telegram/webhook/`
- **Commands:** `/campaign`, `/status`, `/results`
- **Test:** Send commands to bot, verify responses

### 3. Payment Flow (NOWPayments IPN)
- **Files:** `src/app/api/webhooks/nowpayments/`, `src/land/billing/`
- **Test:** Simulate IPN payload, verify tier activation
- **Verify:** Idempotency (event_id dedup), tier upgrade, webhook signature validation

---

## Implementation Steps
1. Run E2E tests for setup wizard: `npm run test:e2e -- --grep "setup"`
2. Test Telegram bot webhook locally with mock payloads
3. Test NOWPayments IPN with sample payload
4. Verify database state changes for each flow

---

## Todo List
- [ ] Setup Wizard: complete onboarding flow test
- [ ] Setup Wizard: verify encrypted key storage
- [ ] Telegram Bot: /campaign command works
- [ ] Telegram Bot: /status command works
- [ ] Telegram Bot: /results command works
- [ ] Payment Flow: NOWPayments IPN processes correctly
- [ ] Payment Flow: idempotency verified (duplicate IPN ignored)
- [ ] Payment Flow: tier activation works

---

## Success Criteria
- All 3 protected flows work end-to-end
- No data loss or corruption
- Proper error handling for invalid inputs

---

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Webhook signature validation fails | Medium | Critical | Test with real NOWPayments test payload |
| Telegram bot token not configured | High | Critical | Use mock/test token |
| BYOK encryption key rotation | Low | High | Verify current encryption still works |

---

## Next Steps
→ Phase 05: Verify Build & Deploy Readiness