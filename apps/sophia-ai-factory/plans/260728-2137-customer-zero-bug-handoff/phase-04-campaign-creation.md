# Phase 4 — Campaign Creation (Hours 7-12)
- Owner: Customer (CEO) with Telegram guide
- Dependencies: Phase 3 complete (tier activated)

## Requirements
- Customer can reach /create-video
- Form submission succeeds
- Inngest event fires

## Steps
1. Customer navigates to /create-video
2. Fill title, topic, audience (all required)
3. Optionally select template or affiliate offer
4. Submit form → Zod validation passes
5. createCampaign server action returns { success: true }
6. D1: campaigns row inserted with status = queued
7. Inngest: campaign.created event sent
8. (Optional) AB variant generation — best-effort, failure does not block

## Validation
- /dashboard/campaigns shows new campaign with status queued
- Inngest dashboard shows campaign.created event
- D1: SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 1 → status = queued

## Risk: TIER_GUARD_BLOCKS
- Symptom: "Multi-channel distribution requires PREMIUM" or "Monthly campaign limit reached"
- Fix: Confirm customer tier matches expected limits in tiers config

## Risk: ORG_MEMBERSHIP_MISSING
- Symptom: "Forbidden: user is not a member of any organization"
- Fix: Run Phase 2 steps again

## Risk: INNGEST_NOT_FIRED
- Symptom: campaign created in D1 but no event in Inngest dashboard
- Fix: Check Inngest env key, worker deployment, network egress
