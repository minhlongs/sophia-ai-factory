# Sophia Handover Rules

> Rules for maintaining client-facing quality in Sophia AI Factory.

## Client Profile
- Client is NON-TECH CEO — all docs must be simple, bilingual (Vietnamese + English)
- No developer jargon in any client-facing content
- Step-by-step instructions with emoji for clarity

## Protected Flows (DO NOT BREAK)
1. **Setup Wizard** — The onboarding flow where clients enter API keys (OpenRouter, ElevenLabs, D-ID). Must always work end-to-end.
2. **Telegram Bot** — @Sophia_Bbot must respond to commands (/campaign, /status, /results). Never break webhook integration.
> Why: The Telegram bot is the primary customer interface for campaign management. Breaking the webhook silently disables all bot commands with no alerting, leaving customers unable to manage their campaigns.
3. **Payment Flow** — NOWPayments IPN webhook → tier activation. Must be reliable. (Polar REJECTED this product — do NOT use Polar for Sophia)
> Why: Polar rejected this product category during integration review. Using Polar again will waste another integration cycle and delay billing go-live.

## Change Rules
- Every code change MUST be tested before commit
- Docs MUST remain bilingual (Vietnamese + English)
- Never remove or break existing API routes
- Never hardcode API keys — use environment variables + encryption
> Why: Hardcoded keys are committed to git history permanently, even after removal. In a BYOK platform serving non-technical CEOs, a leaked key means direct financial exposure for the customer.
- UI changes must maintain responsive design

## Quality Gates
- `npm run build` must pass with 0 errors
- `npm test` must pass all tests
- No `:any` types in TypeScript
- No `console.log` in production code
