---
title: "Phase 4: Revenue Activation"
description: "First paying customer, affiliate links, Telegram bot go-live"
status: pending
priority: P1
effort: 3h
branch: master
tags: [revenue, affiliate, telegram, go-live]
created: 2026-06-06
---

# Phase 4: Revenue Activation

**Priority:** P1 — business-critical
**Status:** pending
**Effort:** 3h
**Depends on:** Phase 2 (FREE100 + cash payment ready)

## Context Links
- Telegram bot: `tree/telegram/`
- Affiliates: `land/affiliates/`
- Billing: `land/billing/`
- Protected flows: `.claude/rules/sophia-handover-rules.md`

## Requirements
1. First paying customer acquired and onboarded
2. Affiliate links configured + tracked
3. Telegram bot (@Sophia_Bbot) operational
4. Revenue dashboard visible to operator

## Implementation Steps

### Step 1: First Paying Customer (1h)
**Action:** Convert CEO or external test customer to first REAL paying customer

Options:
- A: CEO uses FREE100 → MASTER tier $0 (validates promo flow)
- B: External customer pays via NOWPayments (real revenue)

Steps:
1. Share checkout link: https://sophia.agencyos.network/pricing
2. Walk through Setup Wizard
3. Verify tier activation via NOWPayments IPN
4. Confirm in admin panel

**Acceptance:** Customer record in DB with active tier + payment confirmed

### Step 2: Affiliate Links Setup (45 min)
**Files:** `land/affiliates/`

1. Verify affiliate tracking code exists:
```bash
grep -rn "affiliate\|referral" apps/sophia-ai-factory/src/land/affiliates/
```
2. Generate affiliate link template:
   - Base: https://sophia.agencyos.network?ref=<AFFILIATE_ID>
3. Configure commission rate (default: 20% of first payment)
4. Test affiliate attribution flow

**Acceptance:** Affiliate link tracks referral, commission recorded

### Step 3: Telegram Bot Go-Live (45 min)
**Files:** `tree/telegram/`

1. Verify @Sophia_Bbot webhook:
```bash
grep -rn "webhook\|botToken" apps/sophia-ai-factory/src/tree/telegram/
```
2. Test commands: `/campaign`, `/status`, `/results`
3. Verify Inngest jobs trigger from bot commands
4. Check bot responds in <5s

**Acceptance:** All 3 commands respond correctly, jobs execute

### Step 4: Revenue Dashboard (30 min)
Verify admin dashboard shows:
- Active customers count
- Revenue by tier
- Payment history
- Affiliate commissions pending

**Acceptance:** Dashboard loads at https://sophia.agencyos.network/admin (auth required)

## Success Criteria
- [ ] First customer onboarded + tier active
- [ ] Affiliate tracking functional
- [ ] Telegram bot all commands working
- [ ] Revenue dashboard accurate

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NOWPayments IPN not firing | Low | High | Check webhook URL in NOWPayments dashboard |
| Bot webhook expired | Medium | Medium | Re-register webhook via Telegram API |
| Affiliate tracking broken | Low | Medium | Verify ref param in checkout flow |

## Rollback
Revert customer tier via admin. Disable affiliate links. Bot: set webhook to empty.
