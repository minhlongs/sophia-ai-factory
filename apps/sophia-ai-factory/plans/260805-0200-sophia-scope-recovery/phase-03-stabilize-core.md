# Phase 3: Stabilize Core Flows

**Priority:** P1
**Effort:** 3-4 days
**Status:** completed
**Created:** 2026-08-05

## Overview
Verify protected flows work end-to-end after scope cut. These are customer-facing and non-negotiable.

## Key Insights
- Protected flows: Setup Wizard (BYOK), Telegram Bot (@Sophia_Bbot), Payment Flow (NOWPayments IPN)
- Security audit (53 findings) already completed and verified
- No code changes needed — validation only

## Requirements
- [ ] Run full test suite: confirm 6775/6775 pass
- [ ] Manual verification: Setup Wizard API key onboarding
- [ ] Manual verification: Telegram Bot /campaign, /status, /results
- [ ] Manual verification: NOWPayments IPN → tier activation
- [ ] Verify production SHA match: /api/version shortSha
- [ ] Check lint (pre-existing errors OK if unrelated)

## Architecture
No changes — verification only.

## Non-Goals
- Do NOT modify any protected flow code
- Do NOT add new features
- Do NOT refactor

## Success Criteria
- npm test → all pass
- All 3 protected flows verified working manually
- Deployment verified: local SHA == live SHA
