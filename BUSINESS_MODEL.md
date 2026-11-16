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

### Deployment

Deployment is canonical **GitHub Actions CI/CD** (`.github/workflows/deploy.yml`) on push to `main`. A deploy is only called **verified** when the live `/api/version` `shortSha` matches the deployed commit **bit-for-bit** — edge reachability alone is not verification. Direct local deployment (`npm run deploy:full`) is blocked without the `EMERGENCY_CF_DIRECT=1` break-glass flag and is reserved for CI outages.

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

> **Unverified hypothesis, not a measured result.** With 0 paying customers there is no revenue to measure. The customer's **total** cost also includes third-party API fees billed separately from Sophia — HeyGen confirms its API is priced separately from its web plan — so subscription price alone understates what a customer actually spends. No margin figure may be reported as actual until transaction fees, refunds, infrastructure cost, and founder support hours are all measured.

---

## Three-Stream Strategy: Cloud · Master · Community

Three streams run in parallel. Each has its own customer, its own message, and its own 30-day target. **The targets below are targets, not forecasts.** Baseline `2026-10-17`: **0 paying customers / $0 MRR**.

| Stream | Primary Customer | Message | Target — 30 Days |
|---|---|---|---|
| **Cloud** (Managed Cloud) | Vietnamese agencies and SMBs running recurring content operations without an in-house video team | Video | 1 paying customer who activates the workspace and successfully produces a video |
| **Master** (Handover, white-label) | Technical agencies that want to self-operate and white-label | Partner-Resell | 1 deal at `$4,999` meeting handover scope and passing acceptance |
| **Community** (self-hosted) | Builders, technical agencies, and self-hosters | Combined process (Video + Partner-Resell) | 5 people outside the founder team who self-deploy and produce output |

**Revenue boundary:** Master is a **one-time `$4,999` license** and is never counted toward MRR. MRR is Cloud subscription revenue only.

### Experiment Budget

**25 founder hours per week:** 12 sales & demo · 7 technical verification & Master · 4 Community · 2 operations.

**`$1,000` cash ceiling for 30 days:** `$350` API & demo · `$200` infrastructure & tools · `$150` payment verification & fees · `$300` reserve.

> This is a ceiling, not a spend plan. No paid advertising runs before conversion is measured.

### Experiment Plan

- **Week 1:** standardize evidence across the blueprint set; prepare the three bilingual (VI/EN) messages; build a 40-prospect list (20 Cloud, 10 Master, 10 Community).
- **Week 2:** 12 discovery calls and 6 demos; record each prospect's current process, total cost, the problem to solve, and willingness to pay.
- **Weeks 3–4:** run qualified pilots; support the Community stream; record results per stream.
- **Day 90:** check Cloud renewal, Master support cost, and Community → Cloud conversion.
- **Day 180:** scale only streams with evidence of usage, retention, and positive economic contribution.

Streams are compared on **payment commitment, usability, and support time**. Small samples support **qualitative** conclusions only — never quantitative ones.

### Five Priorities

| # | Owner | Goal |
|---:|---|---|
| 1 | CEO / CTO | Standardize the three-stream strategy |
| 2 | Founder / CSO | Validate Cloud and Master |
| 3 | CMO | Validate Community |
| 4 | CTO | Close the technical gap blocking the Partner-Resell Kit |
| 5 | COO / CFO | Reconcile cash, cost, and acceptance |

### Partner-Resell & Payout Status *(backlog — not built)*

Automatic VND + USDT payout is an **unverified technical goal**. Before it is considered operational it requires tenant isolation across partner, commission, ledger, credential, and withdrawal permission; a commercial gate enforced on the money-sending path; VND through a real payout API (CSV/VietQR is not proof of transfer); USDT through the customer's own NOWPayments account; automation enabled only after the customer configures rules and limits, with `under_review` holding money and `suspended` always blocked; retry that reconciles an unknown-status transaction before re-sending; and Master acceptance requiring explicit handover scope, a valid license, a successful customer deploy, and a completed handover checklist.

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

These are **targets, none reached**. Baseline as of `2026-10-17`: **0 paying customers / $0 MRR / $0 collected revenue**, and no measured GitHub star count or portability conversion count.

- 1st paying customer closed and activated end-to-end via NOWPayments or PayOS.
- 3 referenceable paying agency/SMB customers with positive unit-economics ledger.
- 500+ GitHub Stars on the `Apache-2.0` Open-Core repository.
- 5 Community → Managed Cloud portability conversions verified in D1 (`user_profiles.settings` and `tenant_settings` namespace `misc` via `src/tree/open-core/workspace-portability-store.ts`).

## Business & Operational Risks

- **BYOK Friction:** Non-technical buyers may need guided UX to obtain OpenRouter/HeyGen/ElevenLabs keys during Setup Wizard.
- **License Boundary Drift:** Commercial modules (`forest/`, `land/`) must remain strictly gated by `open-core-manifest.ts` and `raas-license-verifier.ts`.
- **Payment/IPN Reliability:** NOWPayments and PayOS webhooks must maintain 100% atomic lock and tier-activation reliability.
- **Third-Party Provider Downtime:** External AI/social API outages require circuit breakers (`@/seed/security/circuit-breaker`) and clear user feedback.
