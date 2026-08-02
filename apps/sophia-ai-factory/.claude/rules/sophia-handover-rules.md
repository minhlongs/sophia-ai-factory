# Sophia AI Factory — Client Handover Rules

> Authoritative quality bar for any content, workflow, or artifact delivered to a client (customer CEO).
> Effective: 2026-08-02. Supersedes any prior handover checklist.

## Core Invariant

Every client-facing touchpoint must reinforce the **no-code, no-tech positioning**.
Clients see a platform they configure themselves. They never see operator infrastructure, never receive operator credentials, and never need operator assistance to reach a green production state.

## MUST Requirements

### 1. BYOK is the only onboarding path

- The Setup Wizard is the **single entry point** for all third-party integrations.
- Every integration entry (AI providers, payment, affiliates, Telegram) MUST have a self-input form field.
- MUST NOT include "ask your operator" / "contact support to enable" language in any wizard step.
- MUST NOT pre-populate or hardcode operator-owned API keys in client views.
- MUST show progress state (not-configured → configuring → active) so the client can self-serve.

### 2. Bilingual Vietnamese + English

- All client-visible strings MUST exist in both `messages/vi.json` and `messages/en.json`.
- No hardcoded English-only copy in any component reachable by a logged-in client.
- Locale routing via `[locale]` segment; no client-visible URLs without a locale prefix.
- Exception: error codes returned by external APIs (NOWPayments, Inngest) may remain in English — but MUST be wrapped in a Vietnamese-aware error handler.

### 3. No operator-side credential disclosure

- Client dashboards, docs, emails, and onboarding flows MUST NOT reference:
  - `SENTRY_AUTH_TOKEN`
  - `QSTASH_*` (Upstash)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `HEALTH_CHECK_SECRET`
  - `CRON_SECRET`
  - Any Cloudflare Worker binding name
  - Any `wrangler` command or CF console URL
- Deployment status shown to clients MUST be "live" / "syncing" / "error" — NOT "deploying via wrangler" or any CI/CLI reference.
- Support response templates MUST NOT include debug steps requiring CLI access or env inspection.

### 4. Payment flow transparency

- NOWPayments and PayOS are customer-facing; explain them simply ("crypto payments" / "Vietnam bank transfer").
- MUST NOT mention "polar.sh" or "PayPal" — they are banned from the platform.
- MUST display payment status in Vietnamese + English at every step (pending → confirming → paid → failed).
- MUST show tier expiry / renewal in client's active locale.

### 5. License + white-label boundaries

- MASTER tier customers receive white-label configurables (logo, colors, domain).
- Client-controlled assets MUST be stored in customer-scoped R2 (path includes `customerId`), never in a shared operator bucket.
- White-label removal of "Powered by Sophia" MUST be a toggle, not manual CSS injection by the client.

## Prohibited Disclosures (Anti-Patterns)

| Prohibited | Acceptable alternative |
|---|---|
| "Your operator must configure X" | "Configure X in Settings → Integrations" |
| "Contact support to enable payments" | "Add your NOWPayments API key in Setup Wizard" |
| "Deployed via GitHub Actions / wrangler" | "Your site is live at https://..." |
| "We use Sentry for monitoring" | "Errors are tracked and resolved automatically" |
| "Set the STRIPE_SECRET_KEY" | "Connect your payment provider in Billing → Payment Methods" |

## Quality Bars

- **Zero client-facing `console.log`** — use the logger utility (or client-safe toast messages).
- **Zero unhandled promise rejections** in client components.
- **All client API errors** surface through the `useTranslation()` hook so they render in the active locale.
- **Setup Wizard completion rate** is the primary onboarding KPI; any step that drops >30% of users MUST be re-evaluated.

## Cross-references

- `.claude/rules/sophia-no-tech-doctrine.md` — full positioning directive (this file is the execution layer).
- `CLAUDE.md` — Product Doctrine section (BYOK, operator-only-platform).
- `.claude/rules/sophia-handover-rules.md` — operator-facing handover for repeatable client setup.
