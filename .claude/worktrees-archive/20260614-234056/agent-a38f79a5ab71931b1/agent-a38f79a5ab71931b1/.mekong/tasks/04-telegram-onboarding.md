# Mission 04: Telegram Bot Onboarding Automation

**Priority:** P1 — HIGH
**Stage:** Zero → PSF
**Layer:** Product
**Target:** Self-serve onboarding via @Sophia_Bbot
**MCU Budget:** 15

## Objective

Automate customer onboarding through Telegram bot so users can:
1. Sign up via magic link
2. Set up BYOK keys
3. Generate first video
4. Upgrade subscription

All without human intervention.

## Steps

1. /start command → welcome message + magic link signup
2. /setup command → guide BYOK key entry (step-by-step)
3. /generate command → submit video generation request
4. /status command → check video job progress
5. /upgrade command → send NOWPayments checkout link
6. /help command → FAQ + contact info

## Success Criteria

- [ ] Bot responds to all 6 commands
- [ ] Magic link sent from bot works
- [ ] User can generate video from Telegram
- [ ] Upgrade payment link works

## Agent Assignment

- **CTO:** Bot command implementation
- **CS:** FAQ content + error messages
