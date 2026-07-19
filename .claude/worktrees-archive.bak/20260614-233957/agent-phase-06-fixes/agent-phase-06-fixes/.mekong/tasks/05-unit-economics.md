# Mission 05: Unit Economics Validation

**Priority:** P1 — HIGH
**Stage:** Zero → PSF
**Layer:** Business (Finance)
**Target:** Prove positive unit economics at BASIC tier
**MCU Budget:** 10

## Objective

Validate that Sophia can operate profitably at $199/mo BASIC tier
with BYOK model (customers pay their own API costs).

## Analysis

### Revenue per Customer (BASIC)
- Subscription: $199/mo
- Platform cost: $0 (CF Workers free tier)
- Email cost: ~$0.001/email (Resend free tier 3k/mo)
- D1 storage: $0 (5M reads free)
- R2 storage: $0 (10GB free)

### Cost per Customer (BYOK)
- API costs: $0 (customer pays their own HeyGen/MuAPI/ElevenLabs)
- Support: ~$10/mo (Telegram bot automated)
- Infrastructure: ~$0/mo (Cloudflare free tier covers early scale)

### Gross Margin
- Revenue: $199
- COGS: ~$10
- Gross margin: **~95%**

## Success Criteria

- [ ] Validate cost assumptions with first 3 customers
- [ ] Track actual support time per customer
- [ ] Confirm zero infrastructure cost at < 50 customers
- [ ] Document real customer API spend (for ROI calculator accuracy)

## Agent Assignment

- **CFO:** Cost tracking + margin analysis
- **Data:** Usage analytics + cost breakdown
