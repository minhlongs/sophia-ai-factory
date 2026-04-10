# Mission 01: First Paying Customer

**Priority:** P0 — CRITICAL
**Stage:** Zero → PSF
**Layer:** Business
**Status:** READY TO EXECUTE
**Target:** 1 paying customer within 2 weeks
**MCU Budget:** 50

## Objective

Get the first customer to pay via NOWPayments (USDT) or PayOS (VND).
This validates the entire stack: auth → BYOK setup → payment → tier activation → video generation.

## Prerequisites — ALL DONE (2026-04-10)

- [x] Auth system (magic link + password login)
- [x] BYOK settings page (5 API keys, Vietnamese UX)
- [x] NOWPayments checkout flow (USDT crypto)
- [x] Tier activation via IPN webhook
- [x] Video generation pipeline (HeyGen E2E)
- [x] Campaign dashboard with preview/download
- [x] Email delivery (mekongmind.com verified, Resend)
- [x] Production live (sophia.agencyos.network HTTP 200)
- [x] 863 tests passing

## Steps

1. Identify 3-5 warm leads (Vietnamese marketing agencies, content creators)
2. Personal demo via Telegram/Zoom — show video generation E2E
3. Offer BASIC tier ($199) with 1-month free support
4. Guide through: signup → magic link → BYOK key setup → first video
5. Close payment via NOWPayments checkout link
6. Verify: IPN webhook → tier activated → dashboard access

## Success Criteria

- [ ] 1 customer paid and active
- [ ] Customer completed BYOK setup (at least 1 API key)
- [ ] Customer generated first AI video
- [ ] Retention: customer logs in within 7 days of payment

## Agent Assignment

- **Sales:** Lead qualification + outreach
- **CTO:** Technical demo + onboarding support
- **CS:** Post-sale BYOK setup guidance
