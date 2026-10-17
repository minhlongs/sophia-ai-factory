# BUSINESS_MODEL.md

## One-Line Model

Sophia AI Factory operates an **Open-Core B2B SaaS + Revenue-as-a-Service (RaaS)** model: developers and technical teams can self-host the **Apache-2.0 Community Core** for free from Public GitHub, while non-technical CEOs and agencies pay monthly subscriptions (`$199 / $399 / $799`) for **Sophia Managed Cloud** or `$4,999` one-time for the **Enterprise Master Handover (`RAAS_LICENSE_KEY`)**. Customers bring their own third-party AI API keys (BYOK), keeping platform gross margin high.

## Target Customer & Personas

1. **Primary Commercial Buyer (Managed Cloud):**
   - Vietnamese and English-speaking non-technical CEOs and marketing managers.
   - Marketing agencies and SMBs (3–20 staff) running repeatable short-form video and faceless YouTube/TikTok/Reels channels without an in-house video team.
2. **Product-Led Growth (PLG) Persona (Community Self-Hosted → Cloud/Enterprise):**
   - Developers, technical founders, and automation builders who discover and deploy the `Apache-2.0` repository on GitHub, then upgrade to Managed Cloud via signed Workspace Portability (`/api/open-core/portability`) or purchase a `$4,999` Master license for multi-client white-label agency operations.

## Open-Core Editions & Product Offers

| Edition / Offer | Tier / Flag | License | Price | Billing | Target & Core Scope |
|---|---|---|---:|---|---|
| **Community Core** | `SOPHIA_EDITION=community` | `Apache-2.0` (`LICENSE`) | **$0** | Free self-hosted | 4-layer `seed/` foundation, AES-256-GCM BYOK Setup Wizard, bilingual `/ask` 4-advisor router, Telegram Bot (`@Sophia_Bbot`), single-workspace AI video studio |
| **Cloud Starter** | `BASIC` (`cloud`) | `Sophia Commercial` (`FSL-1.1-style`) | **$199/mo** | Subscription | Small businesses testing managed AI video & campaign automation |
| **Cloud Growth** | `PREMIUM` (`cloud`) | `Sophia Commercial` (`FSL-1.1-style`) | **$399/mo** | Subscription | Growing teams producing weekly multi-channel video with Direct Social Publisher |
| **Cloud Scale** | `ENTERPRISE` (`cloud`) | `Sophia Commercial` (`FSL-1.1-style`) | **$799/mo** | Subscription | Agencies running high-volume automation, Growth Triad v14, and affiliate workflows |
| **Master Handover** | `MASTER` (`enterprise`) | `Sophia Commercial` + Signed `RAAS_LICENSE_KEY` | **$4,999** | One-time license | White-label/source-code buyers unlocking multi-tenant Agency Portal, Custom Domains, Merkle IPO Audit Vault, and Day-1 Handover probes |

Source of truth: `.mekong/company.json`, `src/seed/config/open-core-manifest.ts`, `src/seed/config/edition-config.ts`, `src/seed/config/tiers/tier-configs.ts`.

## Payment Providers

- **NOWPayments:** Primary USDT/crypto checkout.
- **PayOS:** Vietnam domestic bank/VietQR backup.
- **Banned for customer billing:** Polar.sh and PayPal.
- **Stripe:** Restricted to approved affiliate payout/KYC flows only, not standard customer subscription billing.

## Revenue Streams

1. **Managed Cloud Monthly Subscriptions** (`BASIC $199/mo`, `PREMIUM $399/mo`, `ENTERPRISE $799/mo`).
2. **One-time MASTER Enterprise License & Handover** (`$4,999` one-time, verified by HMAC-SHA256 `RAAS_LICENSE_KEY`).
3. **Optional one-time MCU video credit top-ups** if enabled per canonical tier config.
4. **Future affiliate revenue share** only after payout obligations are modeled and verified.

## Cost Structure

### Platform COGS
- **Cloudflare Workers / D1 / R2 / KV:** Near-zero marginal cost per tenant at early scale.
- **Email via Resend:** Low per transactional message.
- **Inngest & AI/Video Provider APIs:** Customer BYOK shifts third-party AI/video compute costs (OpenRouter, ElevenLabs, HeyGen, D-ID, fal.ai, Replicate) directly to the customer.
- **Customer Support:** Primary variable cost until onboarding is 100% self-serve.

### Business Costs
- Founder sales, discovery, and demo time.
- Open-source community maintenance and documentation.
- Payment gateway fees and ledger reconciliation.
- Legal, tax, and compliance reviews as revenue scales.

## Unit Economics Hypothesis

Baseline as of `2026-10-17`: **0 paying customers / $0 MRR** (all figures below are hypotheses to be validated with real pilot actuals):
- **BASIC Tier Revenue:** `$199/mo`.
- **Platform Infra COGS:** Near-zero per workspace on Cloudflare edge.
- **AI Compute Cost:** `$0` to platform under customer BYOK.
- **Support Cost Target:** `< $10–$30/mo/customer` once Setup Wizard onboarding is stable.
- **Target Gross Margin:** `85%–95%` on subscription revenue (excluding founder time).

## Dual-Funnel Sales & Conversion Motion

### Funnel A: Founder-Led Direct Agency Sales
1. Identify warm leads: Vietnamese marketing agencies, SMBs, and content operators.
2. Demo the live production flow: signup → BYOK Setup Wizard → payment → tier activation → first video → Direct Social Publisher (`/dashboard/social-publisher`).
3. Close `BASIC` ($199/mo) or `PREMIUM` ($399/mo) pilot with white-glove onboarding.
4. Expand multi-client agencies to `ENTERPRISE` ($799/mo) or `MASTER` ($4,999 one-time).

### Funnel B: Open-Core Product-Led Growth (GitHub → Cloud/Enterprise)
1. Developers and technical agencies clone the `Apache-2.0` Community Edition (`SOPHIA_EDITION=community`) and self-host locally via `docs/SELF_HOSTING.md`.
2. When they need 24/7 managed Inngest scheduling, multi-channel anti-detection social publishing, or multi-tenant white-label subaccounts, the in-app `CommercialUpgradeModal` and Settings Portability Panel present the upgrade path.
3. Users export a signed HMAC Workspace Portability bundle (`POST /api/open-core/portability`, excluding raw BYOK keys) and import it into Sophia Managed Cloud or unlock self-hosted Enterprise features with a signed `RAAS_LICENSE_KEY`.

## Validation Milestones

- 1st paying customer closed and activated end-to-end via NOWPayments or PayOS.
- 3 referenceable paying agency/SMB customers with positive unit-economics ledger.
- 500+ GitHub Stars on the `Apache-2.0` Open-Core repository.
- 5 Community → Managed Cloud portability conversions verified in D1 (`user_profiles.settings` and `tenant_settings` namespace `misc` via `src/tree/open-core/workspace-portability-store.ts`).

## Business & Operational Risks

- **BYOK Friction:** Non-technical buyers may need guided UX to obtain OpenRouter/HeyGen/ElevenLabs keys during Setup Wizard.
- **License Boundary Drift:** Commercial modules (`forest/`, `land/`) must remain strictly gated by `open-core-manifest.ts` and `raas-license-verifier.ts`.
- **Payment/IPN Reliability:** NOWPayments and PayOS webhooks must maintain 100% atomic lock and tier-activation reliability.
- **Third-Party Provider Downtime:** External AI/social API outages require circuit breakers (`@/seed/security/circuit-breaker`) and clear user feedback.
