# Phase 2 — User Provisioning (Hours 2-4)
- Owner: Operator
- Dependencies: Phase 1 complete

## Requirements
- Customer account created and active
- Org membership established
- Onboarding flag set

## Steps
1. Create customer account via /signup (email + password)
2. Verify email delivery (if email verification enabled)
3. Login as customer — confirm session established
4. Verify org_members row exists for customer user_id
5. Run completeOnboardingAction OR set onboarding_completed_at directly in D1
6. Confirm user_profiles row exists with tier field

## Validation
- Login successful → /dashboard redirects (not back to /onboarding)
- D1 query: SELECT * FROM user_profiles WHERE user_id = ? → returns row with onboarding_completed_at NOT NULL
- D1 query: SELECT * FROM org_members WHERE user_id = ? → returns row

## Risk: ORG_MEMBERSHIP_MISSING
- Symptom: createCampaign returns "Forbidden: user is not a member of any organization"
- Fix: Insert org_members row manually or trigger org creation flow
