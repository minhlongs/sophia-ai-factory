# Sophia AI Factory Open-Core Company Blueprint

**Prepared:** 2026-10-17  
**Last synced:** 2026-10-21 (`/idea --deep`, see `plans/reports/261021-idea-step1-step2-verdict.md`)  
**Planning horizon:** six months from approval (17 October 2026 – 17 April 2027)  
**Company stage:** Zero → Problem-Solution Fit  
**Business Architecture:** Open-Core Dual-License (`Apache-2.0` Community Core + `Sophia Commercial / FSL-1.1` Managed Cloud & Enterprise RaaS)  

---

## Active bet: Partner-Resell Kit (customer-side affiliate program)

Verified 2026-10-21: the repo's largest subsystem (187 files in `src/land/affiliates` + dual-rail
payouts) is pointed at the **operator**, not the paying customer, and `affiliate_links` /
`click_events` / `conversion_events` are already `tenant_id`-scoped (migrations `0035`, `0079`).
The bet is to re-point that engine so every Cloud customer recruits and pays their own partners.

| Edition | Owns | Why there |
|---|---|---|
| Community (`Apache-2.0`) | `tenant_id`-scoped schema + attribution primitives (click recording, code generation, consent-gated capture, attribution resolver) | Nothing here leaks commercial value; it is what a self-hoster audits for trust |
| Cloud (COMMERCIAL) | Partner-Resell Kit: multi-partner workspace program, dual-rail payout orchestration, anti-fraud risk scoring, payout batching | The customer's money leaves their account here — that is the paid boundary |
| Enterprise (MASTER $4,999) | White-label partner portal per subaccount + custom domain | Agencies reselling to their own clients |

**PLG ceiling that triggers the upgrade:** a self-hoster generates links and records clicks fine;
paying out many partners (batching, VietQR/NAPAS export, risk scoring, clawback, Net-30) stops
working. That is the ceiling `CommercialUpgradeModal` + `/api/open-core/portability` catch.

**Pre-conditions (blockers, not nice-to-haves):**
1. Feature gates must be **enforced**, not documented — `evaluateFeatureGate` is currently called only by `/api/open-core/status` and the 25-step auditor.
2. Founder decides the affiliate payout rail: `payouts/resolve-payout-method.ts` prefers Stripe Connect, which a Vietnamese operator paying partners in VND cannot use.
3. Market claims stay **hypothesis** until a customer pays; `company.json` records $0 MRR / 0 paying customers as of 2026-10-17.
4. Founder decides whether the nightly risk scorer may **stop money** for partners the customer recruited. `payout-disbursement.ts` deliberately treats `under_review` as advisory (only `suspended` blocks) because the scorer has no automatic recovery path and one false positive froze a partner's payouts permanently. Partner-Resell Kit hands unknown partners to non-technical customers, where false positives are likelier — so the Cloud tier's "anti-fraud" promise is currently a notification, not a control.
5. `affiliate_commissions`, `affiliate_payouts` and `affiliate_referrals` (migration `0452`) carry **no `tenant_id`**. A Phase 02 migration adds it; without it a customer's commission ledger is inseparable from Sophia's own.

---

## Executive Summary

Sophia AI Factory is an Open-Core autonomous AI video production and Revenue-as-a-Service (RaaS) platform built for non-technical Vietnamese agency and SMB operators, paired with an open developer ecosystem. 

1. **Community Self-Hosted Core (`Apache-2.0`):** Free Public GitHub repository providing the 4-layer foundation (`seed/`), AES-256-GCM BYOK Setup Wizard, bilingual `/ask` 4-advisor router, Telegram bot (`@Sophia_Bbot`), and single-workspace AI video studio. Serves as our primary Product-Led Growth (PLG) developer wedge and trust anchor.
2. **Sophia Managed Cloud SaaS (`$199 – $799/month`):** Fully managed Cloudflare Workers edge deployment (`https://sophia.agencyos.network`), 24/7 Inngest queues, Direct Social Publisher Cockpit (`/dashboard/social-publisher` with anti-detection pacing), Growth Triad v14 (Thompson Sampling MAB + Half-Kelly), and automated affiliate payouts.
3. **Enterprise / Master Handover (`$4,999 one-time`):** Commercial self-hosted unlock verified by cryptographically signed `RAAS_LICENSE_KEY` (`SOPHIA-RAAS-v1.<payload>.<hmac-sha256>`), unlocking White-Label Agency Subaccount Portals, Custom Domains, Cryptographic Merkle IPO Audit Vault, and Day-1 Master Handover probes.
4. **Community-to-Cloud Conversion Funnel:** Self-hosters export a signed HMAC workspace portability bundle (`/api/open-core/portability`) without exposing raw BYOK keys, and seamlessly import into Sophia Cloud.

**Current Baseline:** The founder confirmed zero paying customers. The current business profile records $0 MRR as of 2026-10-17. The $1M ARR path is a directional goal, not a forecast.

**Pricing and billing truth:** BASIC $199/month, PREMIUM $399/month, ENTERPRISE $799/month, MASTER $4,999 one-time; NOWPayments (USDT crypto) and PayOS (Vietnam domestic) are the only customer billing providers. Polar.sh and PayPal are banned.

---

## 25-Step Open-Core Architecture

Each step covers Business, Agentic, and Governance choices. The agentic roles prepare and analyze work; the founder retains approval authority for customer promises, pricing, legal terms, spending, and production risk.

### Phase 1 — Foundation

| # | Topic | Business | Agentic | Governance |
|---:|---|---|---|---|
| 1 | Master framework | Open-Core model: `Apache-2.0` Community Core on GitHub drives PLG adoption; Managed Cloud SaaS ($199–$799/mo) and Master Handover ($4,999) monetize scale and automation. | Founder leads; CTO, CMO, Sales/CS, and COO/CFO agents support their domains. | Apply strict 4-layer architecture (`seed → tree → forest → land`), `open-core-manifest.ts` code partitioning, and <= 180 LOC per executable file constraint. |
| 2 | 2026 plan refresh | Reconcile all company records with the Public GitHub Open-Core repository and canonical pricing; eliminate stale closed-source or unsupported revenue claims. | COO agent maintains canonical source registers and flags conflicts for founder review. | GitHub `README.md`, `LICENSE`, `LICENSE-COMMERCIAL.md`, and `.mekong/company.json` serve as public and operational authorities. |
| 3 | Agentic OS | Solo founder supported by specialized AI agents for research, drafting, code quality, and telemetry analysis under human supervision. | CTO, CMO, Sales/CS, COO, and CFO agents operate under defined least-privilege scopes. | No agent may modify pricing, billing, credentials, legal licenses, or bypass the GitHub Actions deploy gate without founder approval. |
| 4 | IPO-readiness & audit baseline | Baseline is internal planning readiness: score commercial proof, cryptographic Merkle audit ledger, legal dual-license clarity, governance, and CI/CD operations. | CFO/COO agents maintain the Cryptographic Merkle Audit Vault and evidence checklists. | Ensure strict compliance with Vietnam Personal Data Protection Decree (PDPD 13/2023), Law on Cyber Security, and e-commerce regulations. |
| 5 | Gap report and roadmap | Prioritize closing the first paid customer via NOWPayments/PayOS and achieving initial GitHub Open-Core community traction before expanding headcount. | Agents produce monthly gap and OKR reviews grounded in verifiable data. | Escalate payment, secret hygiene, content rights, or license isolation issues immediately. |

### Phase 2 — Business Model

| # | Topic | Business | Agentic | Governance |
|---:|---|---|---|---|
| 6 | Open-Core model & unit economics | Dual-engine monetization: free community self-hosting + paid cloud subscriptions + Master handover. Customer BYOK shifts third-party AI compute costs to users, preserving 85–95% gross margin. | CFO agent tracks pilot unit economics: collected revenue, payment fees, platform edge hosting, and founder support minutes. | Reconcile NOWPayments and PayOS webhooks with D1 activation ledgers; never claim projected margins as historical fact. |
| 7 | Customer & developer personas | Primary commercial ICP: Vietnamese marketing agencies and SMBs needing recurring video campaigns. Secondary developer persona: open-source builders and agencies evaluating the Apache-2.0 core on GitHub. | Sales agent prepares bilingual customer interview guides and developer onboarding feedback forms. | Obtain consent before recording prospect calls; do not publish user quotes or agency names without written approval. |

### Phase 3 — Brand, Open-Source Community & Content

| # | Topic | Business | Agentic | Governance |
|---:|---|---|---|---|
| 8 | Brand positioning | Transparent Open-Core AI Video & RaaS Factory: inspectable security and code on GitHub (`Apache-2.0`), effortless no-code execution on Sophia Cloud. | CMO agent crafts bilingual Vietnamese and English messaging and manages GitHub community announcements. | Prohibit absolute claims ("only", "100% automated ROI", "unbeatable speed"); emphasize verifiable architecture and BYOK security. |
| 9 | Content pillars + GitHub TOF | 4 content pillars: (1) Open-Core codebase walk-throughs, (2) AI video prompt & workflow tutorials, (3) Agency automation playbooks, (4) Direct social publishing & pacing guides. | CMO agent drafts technical blog posts, documentation guides (`docs/SELF_HOSTING.md`), and social snippets. | Verify all code examples and instructions against live repository code before publication. |
| 10 | Website & repository narrative | Dual entrypoint: GitHub `README.md` for developers and self-hosters; `https://sophia.agencyos.network` for non-technical agency buyers, connected by `CommercialUpgradeModal` and `/pricing`. | CMO and UX designer agents maintain page structure, bilingual copies, and clear feature comparison matrices. | Clear separation between Community Apache-2.0 rights and Commercial/Enterprise licensing terms. |
| 11 | Performance ads & creative testing | Small-budget founder-approved creative tests on YouTube, TikTok, and Facebook only after direct organic funnel baseline is established. | Marketing agent drafts ad creative variants focusing on agency time/cost savings. | Never exceed approved ad test budgets; maintain clear synthetic media attribution where required by platform policies. |
| 12 | Advertorial & case study rules | Long-form case studies detailing agency workflow transformations from manual video production to autonomous Sophia pipelines. | Content agent structures problem-solution-result stories based exclusively on consented pilot data. | Case studies must reflect verified customer results; no synthetic or unvalidated testimonials. |

### Phase 4 — Revenue & Conversion Engine

| # | Topic | Business | Agentic | Governance |
|---:|---|---|---|---|
| 13 | Email, lifecycle & upgrade sequences | Bilingual automated sequences: Setup Wizard completion, first video milestone, self-hosted security notices, and Community → Cloud upgrade nudges. | Lifecycle agent manages trigger conditions and message templates via Resend. | Strictly opt-in; respect unsubscribe requests; never include raw API keys, credentials, or sensitive tokens in emails. |
| 14 | Sales process, PLG & protected flows | Two conversion paths: (A) Direct sales: discovery → demo → pilot → paid subscription. (B) PLG: GitHub self-host → signed Workspace Portability export (`/api/open-core/portability`) → Managed Cloud or Master license. | Sales/CS agents qualify leads and prepare demo instances; founder conducts discovery and closes deals. | Protect core customer flows: Setup Wizard, Telegram Bot (`@Sophia_Bbot`), and NOWPayments IPN webhook must never be broken. |
| 15 | GTM experiments & Bullseye | Test 3 primary traction channels: (1) Direct agency outreach in Vietnam, (2) GitHub developer community & Open-Core launches, (3) Affiliate/agency partner referrals. | Growth agent tracks experiment metrics: acquisition channel, conversion rate, CAC, and retention. | Stop experiments that fail to generate qualified customer interest within the agreed evaluation period. |

**2026-10-21 update — the affiliate engine serves the customer, not just the founder.** The
built attribution + payout engine (`src/land/affiliates`, dual-rail VietQR/USDT) is being re-pointed
as the customer-facing **Partner-Resell Kit**, so the paying customer's channel becomes Sophia's
channel. This makes Step 15's third traction channel double as a product feature the $399 tier
sells. See "Active bet" above and `plans/reports/261021-idea-step1-step2-verdict.md`.

### Phase 5 — Operations, Security & Readiness

| # | Topic | Business | Agentic | Governance |
|---:|---|---|---|---|
| 16 | AARRR & Open-Core analytics | Track GitHub repo stars/clones, version beacon pings (opt-out respected), Cloud signups, BYOK completions, paid activations, and weekly active video exports (North Star). | Analytics agent aggregates privacy-safe metrics from Cloudflare Workers and D1. | Exclude test and internal accounts from business metrics; respect user privacy and opt-out flags. |
| 17 | Fundraising & VC narrative | Stage-appropriate narrative: Open-Core developer adoption wedge + capital-efficient BYOK SaaS economics + verifiable engineering discipline (zero `:any`, all files <= 180 LOC). | Founder conducts all investor discussions; CFO/CTO agents prepare factual data-room exhibits. | Disclose stage honestly as Zero → PSF with 0 paying customers; never present directional targets as current run rate. |
| 18 | Risk, dual-license IP & secret hygiene | Multi-layer risk management: enforce `open-core-manifest.ts` license boundary, fail-closed auth on portability endpoints, HMAC license keys, and CI secret gates (`secretlint` + `gitleaks`). | Security and CTO agents run automated secret scanning, boundary audits, and regression tests. | Never commit credentials or customer data; maintain strict isolation between open-source and commercial source modules. |
| 19 | Talent & agentic org design | Solo founder leveraging specialized AI agents (CTO, CMO, Sales/CS, COO, CFO); delay human hiring until revenue and support demands clearly justify it. | Agents execute research, drafting, testing, and operational summaries within bounded permissions. | Founder retains sole authority over banking, contracts, hiring, and production deployment policies. |
| 20 | Industry patterns & benchmarks | Study disciplined Open-Core B2B precedents (Supabase, n8n, PostHog, Cal.com) that successfully converted self-hosted developers into high-retention managed cloud customers. | Research agent analyzes conversion rates, community engagement tactics, and pricing tier boundaries. | Ensure licensing compliance; avoid anti-competitive restrictions that violate Apache-2.0 or open-source community standards. |
| 21 | Data room & investor materials | Maintain a clean, evidence-backed data room: GitHub repository, live production URL, audited unit economics, architecture blueprints, and legal/commercial licenses. | CFO and COO agents organize verifiable documents into a structured repository index. | Only include documents that have been verified against source records; update timestamps whenever materials change. |

### Phase 6 — Execution & Governance

| # | Topic | Business | Agentic | Governance |
|---:|---|---|---|---|
| 22 | Agentic execution & quarterly OKRs | Q4 2026 – Q1 2027 OKRs: (1) Close 3 paid agency pilots via NOWPayments/PayOS, (2) Reach 500+ GitHub stars on Community Core, (3) Achieve 5 Community → Cloud portability migrations. | Department agents track task completion against designated phase milestones. | Review OKR progress weekly; reallocate effort if assumptions fail to produce customer evidence. |
| 23 | Board & founder governance | Monthly founder operating review: review collected cash, runway, pilot customer status, community growth, and critical bugs. | COO agent compiles monthly review packs with factual charts and progress summaries. | Maintain written records of key strategic decisions, licensing changes, and major architectural shifts. |
| 24 | ESG, privacy & responsible AI | Strict BYOK data isolation (customer keys stored encrypted in D1 via AES-256-GCM), synthetic content transparency, and Vietnam PDPD compliance. | CTO and compliance agents monitor key management safety and audit trail integrity. | Prohibit deceptive AI impersonation or violation of platform policies (YouTube, TikTok, Meta); provide easy opt-outs for telemetry. |
| 25 | Crisis, rollback & reputation OS | Operational defense runbook: canonical GitHub Actions deployment with bit-for-bit SHA parity check, Wrangler worker rollback, Direct Social Publisher emergency killswitch, and `SECURITY.md`. | Ops and CTO agents monitor real-time worker errors, circuit breaker trips, and security vulnerability reports. | In case of deployment drift or critical defects, execute immediate rollback and notify affected pilot users transparently. |
