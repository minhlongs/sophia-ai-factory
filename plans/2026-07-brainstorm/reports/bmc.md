# Business Model Canvas — Sophia AI Factory

> Incorporates top-5 ideas from `plans/2026-07-brainstorm/idea-package.md`: ID-01, ID-02, ID-03, ID-04, ID-05
> Date: 2026-07-14 | Status: DRAFT

---

## 1. Value Propositions

### Current (Prior to Any Idea)

| Job-to-be-Done | Vietnam SMB CEO Context |
|---|---|
| Generate AI avatar videos without video editing skills | "I don't have a cameraman, a studio, or time to shoot 30 talking-head promos per month." |
| Local-language content for Zalo/Facebook/TikTok | "My customers watch on mobile, not YouTube. English-sounding voices read flat on Vietnamese." |
| Scale content production affordably | "Agency costs $300/video. I need 50 product promos for my store and cannot afford $15k." |
| Own the production stack (BYOK) | "I already pay business-class ElevenLabs + OpenRouter. Why pay markup for a platform that secretly resells them?" |

### Per-Idea Job-to-be-Done Additions

**ID-01 — Micro-Pricing (Credits Overlay)**
- Job: "Try one video before committing $199/month." — solves the cold-start conversion wall where trial users hit a pay-wall with no way to verify value.
- Job: "Don't waste my subscription slots on bad takes." — separates "base access" (subscription) from "burst volume" (credits), matching how Vietnam SMB budgets think (pay-small-often).

**ID-02 — Vietnamese Voice Optimization**
- Job: "My grandmother should sound like herself, not Google Translate on a phone call." — solves the uncanny valley of flat, English-phoneme Vietnamese TTS; first-mover moat because Runway, HeyGen, Synthesia are US/EU-first and ignore tractional tonal accuracy.
- Job: "My captions must render on Zalo OA, not just desktop browser." — solves diacritic stacking artefacts that break mobile subtitle renders on the two highest-traffic surfaces in Vietnam.

**ID-03 — AI Support Triage (Telegram Self-Service)**
- Job: "I message at 11 PM Vietnam time and get an answer by 11:05 PM, not next business day." — solves the async-support friction that produces early churn from trial users who fail Setup Wizard and go silent.
- Job: "I don't want to ask a human what my remaining quota is — just show me." — eliminates the top-3 human-answered support question (quota check) entirely.

**ID-04 — API Resilience Layer (Circuit Breakers + Fallback)**
- Job: "My $4,999 MASTER campaign should not silently fail because ElevenLabs had a blip at 2 AM." — solves the single-vendor-SPOF trust gap; graceful degradation gives MASTER tier the SLA posture it pays for.
- Job: "I know how much each video costs me and I know I won't receive a surprise invoice at month-end." — solve runaway-retry cost shock (addressed by per-day cost cap).

**ID-05 — Agency/White-Label Tier**
- Job: "My 12 clients want AI videos. I want one bill, one dashboard, white-labeled under my brand — not 12 logins to Sophia." — solves the internal-tool gap agencies currently fill with duct-taped freelancer + CapCut workflows.
- Job: "Pass my brand colors and logo to Sofia so my clients never see another vendor." — solves the visual identity leakage preventing agencies from white-labeling Runway/HeyGen outputs.

---

## 2. Customer Segments

### Current ICP

| Segment | Tier | Description |
|---|---|---|
| Vietnam SMB Owner | BASIC / PREMIUM | 1–10 employees, runs Facebook/Instagram/Zalo marketing for local business (F&B, retail, services). Non-technical. Budget $200–400/month. |
| Content Creator | PREMIUM | Individual creator, personal brand, TikTok/Facebook, 5–20 videos/month. |
| Enterprise Team | ENTERPRISE | 10–50 seat organization, multi-user org, branded output. $799/month. |
| Power User | MASTER | One-time $4,999. Unlimited. Self-sufficient, low-touch. |

### New Segments Unlocked by Ideas

| Idea | Segment Opened | ICP Details | Estimated Addressable Size | Priority |
|---|---|---|---|---|
| ID-01 | **Casual / One-off User** | Trial users who churn at subscription gate. Willing to pay $29–99/video as they learn platform value. Conversion path: credits → subscription upgrade. | 2–3× current trial base. High churn rate at trial gate; micro-pricing captures some. | P1 |
| ID-05 | **Vietnam Digital Marketing Agency** | 5–20 end clients, >$2k/month agency billings, white-label requirement, Zalo/Facebook/TikTok hands-on management. No existing competitor ships VN-language + white-label. | 20–50 agencies in VN SMB market. First-mover window: 12–18 months before Runway/HeyGen catch up. | P2 |
| ID-02 | (deepens) **Vietnam-Localized Creator** | Already in BASIC/PREMIUM but double-churning because English-VN TTS produces embarrassing output. Voice optimization reduces churn + creates word-of-mouth in VN creator communities (Zalo groups, FB MMOs). | Overlaps existing BASIC/PREMIUM. Churn reduction, not net-new segment. | P1 |
| ID-03 | (deepens) **After-Hours User** | Users who message outside Vietnam working hours (09:00–18:00 ICT). Self-service bot removes the "wait until tomorrow" friction. Overlaps all active tiers. | All Vietnam-based users. 60–70% of support messages historically arrive outside working hours (estimate — validate from Telegram message timestamps). | P1 |
| ID-04 | (deepens) **MASTER / SLA-Sensitive User** | Enterprise + MASTER users whose operations depend on reliability. Graceful degradation maintains trust during vendor outages. | ENTERPRISE + MASTER (~10–15% of base at early stage). | P1 |

---

## 3. Channels

### Current Acquisition Channels

| Channel | Role | Notes |
|---|---|---|
| Telegram Bot (@Sophia_Bbot) | Primary support + activation touchpoint | Users discover via Setup Wizard invitation. Organic virality via `/results` shared results. |
| Landing Page (sophia.agencyos.network) | Top-of-funnel + trust anchor | Direct traffic, organic SEO (Vietnamese long-tails around "AI video generation Vietnam"), word-of-mouth links. |
| Word-of-Mouth / Referral | Secondary acquisition | Powered by visible output (the "made with Sophia" badge path — ID-16 KILL'd, but implicit attribution already converts in FB/Zalo content feeds). |

### How Each Idea Changes Distribution

**ID-01 — Credits create a lower-friction conversion loop**

- Trial users who hit the $199 subscription wall get a $29 credit path instead of churning.
- Credit buyers who convert to a subscription after experiencing the product → new customer rate +15–20%.
- Effect: landing page CTA shifts from "Subscribe $199/mo" to "Pay what you use. Start at $29." —降低 the commitment barrier.

**ID-02 — Voice optimization → organic VN creator word-of-mouth**

- Vietnamese creators on Zalo OA groups, TikTok, and Facebook MMOs start sharing "this actually sounds Vietnamese" clips.
- Unlockable effect: a VN creator with 50k followers making videos with Sophia → free distribution reach into their audience.
- No additional marketing spend; content performs the channel work.

**ID-03 — Telegram triage bot → extended Telegram engagement + reduced friction**

- Existing `@Sophia_Bbot` becomes a daily touchpoint (quota checks, billing answers, regeneration triggers) on the same app the user already has open.
- Support deflection → operator can spend time on high-ROI tasks (agency onboarding, strategic partnerships) instead of quota-question answers.
- Effect: Telegram transitions from "support channel" to "primary operating surface" — increasing daily active touchpoints.

**ID-04 — Resilience Layer → MASTER-tier trust for larger accounts**

- Enterprise buyers evaluating AI-video platforms prioritize "what happens when it goes wrong?" — resilience narrative (graceful degradation, per-day cost cap) is a sales asset.
- Changes the evaluation bar from "does it work?" to "what happens when it fails?" — and Sophia now has a better answer than competitors.

**ID-05 — Agency/White-Label → B2B reseller channel (new)**

- Direct-to-end-user acquisition (Telegram, landing) becomes the lead volume source.
- Agencies become the **volume converter**: one agency with 15 clients = 15 accounts under one commercial relationship.
- Agency partnership channel requires separate onboarding flow + operator relationship (not pure self-serve).
- Sales motion shifts: for agencies, it is a seated demo + onboarding call (high-touch). For direct users, it remains self-serve.

---

## 4. Revenue Streams

### Current Revenue (Baseline)

| Tier | Price | Model | Volume | Est. Revenue |
|---|---|---|---|---|
| BASIC | $199/mo | Subscription | ~35% of base | $69.65 average/active user |
| PREMIUM | $399/mo | Subscription | ~30% of base | $119.70 |
| ENTERPRISE | $799/mo | Subscription | ~15% of base | $119.85 |
| MASTER | $4,999 one-time | Perpetual | ~20% of base | $999.80 (amortized at ~$41.66/mo over 2yr) |
| **Blended ARPU (est.)** | | | | **~$150–180/user/month** |

*Estimates. Signups and cancellation data are in D1 `subscriptions` + `user_purchases` tables. Validate against actuals before making pricing decisions.*

### Revenue After Top-5 Ideas

| Revenue Source | Mechanism | Per-Unit Rate (Est.) | Volume Assumption | Est. Revenue |
|---|---|---|---|---|
| **Subscription base (unchanged)** | 4 tiers as-is | see baseline | same base | same base contribution |
| **Credit packs (ID-01)** | Additive overlay. 1 credit = 1 generation. 90-day expiry. | $29/10 cr, $99/50 cr, $299/200 cr | 30% of BASIC+PREMIUM buy ≥1 pack/quarter | +$8–18/user/month on affected tier |
| **Agency seat (ID-05)** | New AGENCY tier | $299–499/month per agency | 20 agencies at $399 avg (2yr model) | +$7,980/month at scale; +$7.98/AGENCY-user |
| **Blended ARPU with Ideas (est.)** | | | | **~$165–200/user/month** at early scale |

### Revenue Concentration Risk

| Risk | Severity | Mitigation |
|---|---|---|
| MASTER one-time creates ARPU cliff after 2 years | Medium | Credit packs (ID-01) + Agency (ID-05) diversify toward recurring. Add MASTER renewal/upgrade path (future P2). |
| Subscription base is binary (upgrade or churn) | High | ID-01 credits solve: users who would churn at subscription gate can stay at BASIC + top-up. |
| Credits + subscription overlap could double-count conversion | Medium | NOWPayments SKU branching keeps subscription and credit purchase events separate. |
| Agency concentration: a few agencies = disproportionate revenue | High | 20 agencies at $399 = same MRR as 440 BASIC users. Diversify with ID-01 casual segment. |

### Revenue Diversification Table (Before → After)

| Revenue Axis | Before | After (with all 5 ideas) |
|---|---|---|
| Recurring subscription | ~90% of MRR | ~75% of MRR |
| Recurring add-on (credits) | 0% | 8–12% |
| New recurring tier (agency) | 0% | 10–15% |
| One-time (MASTER) | last-leg cohort revenue | declining; replace with subscription-style AGENCY |
| **Revenue concentration in top 2 tiers** | HIGH (PREMIUM+MASTER carry most) | Lower — credits + agency spread the base |

---

## 5. Cost Structure

### Current Costs (Baseline)

| Cost Item | Amount/Month | Notes |
|---|---|---|
| Cloudflare Workers compute | ~$250–600 | CPU + bandwidth for generation + API |
| D1 + R2 + KV | Included in CF Workers bundle or minimal add-on | D1 152 migrations, R2 stores generated videos |
| AI APIs (OpenRouter + ElevenLabs + D-ID) | **$0 directly** — BYOK model | Platform does NOT pay AI API costs; customers bring their own keys. Platform only pays Workers CPU for orchestration. |
| Inngest workflows | ~$0–50 | Runs inside Workers/CF; minimal incremental at early scale |
| Domain + infra misc (CF email, monitoring) | ~$20–50 | Resend (email), Better Stack (logs), domain |
| **Total monthly infra** | **~$300–700** | |

*Note: The BYOK model shifts AI API unit costs directly to the customer. This is the single largest structural moat in the cost structure — competitor platforms (HeyGen, Runway) pay these costs themselves.*

### Cost Delta from 5 Ideas

| Idea | Cost Change | Notes |
|---|---|---|
| ID-01 Credits | **+0 to -$50/mo** | Credits are marginal-cost priced (customer pays via their own BYOK keys). Only additional cost: D1 `credits` table + expiry cron (Inngest). Near-zero compute overhead. COGS tracked via existing instrumented LLM/media calls. |
| ID-02 VN Voice | **+$0** | Ships within existing ElevenLabs BYOK channel. No new vendor. May marginally reduce retry rate (fewer "bad voice" regeneration requests = fewer ElevenLabs calls = lower customer cost). |
| ID-03 Support Triage | **+OpenRouter spend for L2 LLM** | L1 (pattern match) is free. L2 (free-form → RAG) uses OpenRouter LLM. Rate-limited to ~50–100 calls/day total across all users. Estimate: $5–15/mo at early stage, $50–150/mo at 500-user scale. Still a fraction of ops savings (5–20 hrs/week). |
| ID-04 API Resilience | **+Second-vendor spend** | Fallback providers (CF Workers AI Qwen for LLM, PlayHT for TTS). CF Workers AI is free within generous limits; PlayHT BYOK adds near-zero platform cost. Circuit breaker state in D1: negligible. |
| ID-05 Agency Tier | **+Inngest cron overhead** | Thin agency wrapper, per-org scoping reuses existing tenant infrastructure. Per-client Inngest runner: ~1 workflow automation per agency. Negligible at 20-agency scale (~$0–10/mo additional). |
| **Total delta** | **+$5–30/mo net** | All ideas revenue-positive or cost-neutral. Main variable is ID-03 L2 LLM spend at scale. |

### ARPU Economics at Scale (With All 5 Ideas)

```
Revenue per average user/month      ~$165–200
- AI API costs (BYOK, paid by user) ~$0
- CF Workers compute                ~$0.50–2.00
- Inngest/overhead                  ~$0.10–0.50
= Contribution margin               ~$160–198 per user/month (95–99%)

COGS is close to 0 because:
1. AI APIs are BYOK — user pays vendor directly
2. CF Workers provides generous free tier at early scale
3. AI generation runs in user's own compute envelope, not Sophia's
```

This is a ** Software Margin** business — gross margins that SaaS platforms typically target at ~80%+ arrive here at 95%+ because the heavy unit cost is amortized to the customer.

---

## 6. Key Resources

| Resource | Why Critical | Existing or New |
|---|---|---|
| **Cloudflare Workers + D1 + R2 + KV** | Execution runtime for entire platform. All generation, orchestration, bot handlers, Inngest adapters run here. Zero Cold starts for Worker API; D1 holds all customer + operational state. | Existing. ID-04 adds circuit-breaker state columns to D1. |
| **Inngest** | Long-running workflow engine: video generation, credit expiry cron, agency client orchestration, campaign scheduler. Separates async from request-path. | Existing. |
| **BYOK key management** | Core trust moat. Security model where API keys live encrypted per-user, never accessible to platform. Basis for operator's "no-tech doctrine" credibility. | Existing (`@/tree/credentials/`, `CREDENTIALS_MASTER_KEY` + `BYOK_MASTER_KEY`). |
| **Telegram Bot (@Sophia_Bbot)** | Primary support channel, distribution surface, activation touchpoint. ID-03 extends this into self-service triage without adding a new interface. | Existing (`land/telegram/`). ID-03 adds triage handlers. |
| **NOWPayments + PayOS** | Payment layer. NOWPayments primary (crypto-capable, global); PayOS Vietnam domestic backup (bank transfer, Momo, ZaloPay). Does NOT touch revenue logic — just payment routing. | Existing. ID-05 adds agency invoice support (monthly, not per-video). |
| **ElevenLabs + OpenRouter + D-ID (BYOK)** | Core generation capabilities. Through BYOK, costs flow to the customer — platform does not carry AI COGS. | Existing. ID-02 optimizes ElevenLabs Vietnamese preset. ID-04 adds PlayHT fallback for ElevenLabs outage. |
| **Bilingual VN+EN Infrastructure** | `next-intl` + `[locale]` segment + translation files. All customer-facing content must be bilingual. Non-negotiable for non-tech CEO trust. | Existing. Ideas extend, not replace. |
| **Telemetry / usage_events table** | Per-call instrumentation: required by ID-01 (credit deduction), ID-04 (cost cap enforcement), ID-08 (cost attribution). Already partially instrumented from Phase 10 lineage. | Existing. ID-01, ID-04, ID-08 extend. |
| **Team capacity (operator 1 person)** | The business runs on Founder-as-Operator. ID-03 (triage) buys back 5–20 hrs/week → reinvest in agency partnerships (ID-05) and product quality (ID-04). | Existing. Ideas reduce, do not increase, human ops. |

---

## 7. Key Activities

### Current Core Activities

| Activity | Priority | Owner |
|---|---|---|
| Platform maintenance (D1 migrations, CF Workers deploys, BYOK security) | Must-do daily | Founder/Ops |
| Setup Wizard BYOK onboarding (OpenRouter, ElevenLabs, D-ID) | Must-do — protected flow | Ops (15–30 min/user cohort) |
| Payment/Subscription reconciliation (NOWPayments IPN) | Must-do — protected flow | Ops (30 min/day) |
| Telegram support responses | Daily (currently human; ID-03 reduces this) | Ops → L1 bot takes over |

### Priority Shift Given 5 Ideas

| Activity | ID Driven | New Priority | Why Shifted Up |
|---|---|---|---|
| **Deploy credit system + expiry cron** | ID-01 | P1 — ship within 30 days | ARPU growth. Migration MUST NOT break tier enum or `getUserTier`. |
| **VN voice preset sandbox validation** | ID-02 | P1 — ship within 2 sprints | S effort. Zero new contracts. Retention moat. |
| **Deploy Telegram triage bot** | ID-03 | P1 — ship within 30 days | Frees 5–20 hrs/week ops. Activates async support coverage. |
| **Circuit-breaker architecture design + fallback vendor onboarding** | ID-04 | P1 — after ID-01, ID-02, ID-03 ship | Foundational for P2: required before MASTER tier load grows. Also required for ID-05 (agencies expect reliability). |
| **Agency tier schema migration + onboarding flow** | ID-05 | P2 — after ID-04 green deploy | Highest MRR potential. Dependent on KYC decision from founder (Blocking Question Q2). |
| **Credit COGS tracking via usage_events** | ID-01 + ID-04 | P2 (parallel) | Required to validate credit pricing = marginal cost + healthy margin. |
| **Marketing / word-of-mouth amplification** | ID-02 (organic) | Ongoing — low-budget | Creator community in VN is reachable organically; no paid spend required at early stage. |
| **Cost Attribution Dashboard** | ID-08 (adjacent) | P2 | Feeds credit pricing decisions (ID-01) and tier profitability model. |

### Time Budget After ID-03 Triage Deploys

```
Before ID-03: ~20–25 hrs/week support + ops
After ID-03:  ~5–10 hrs/week support + ops
Freed 15–20 hrs → reinvest in:
  - ID-04 resilience design (5–10 hrs)
  - ID-05 agency partnership (8–12 hrs)
  - Customer quality assurance / Setup Wizard assistance (remaining)
```

---

## 8. Key Partnerships

| Partner | Role | Dependency Relationship |
|---|---|---|
| **NOWPayments** | Primary payment processor; handles subscription + one-time capture. IPN webhook → D1 updates. | Platform-level account. NowPayments handles PCI compliance; Sophia never touches raw card data. ID-05 needs expanded invoice support (monthly, not per-video). |
| **PayOS** | Vietnam domestic payment backup: bank transfer, Momo, ZaloPay. | Customer-level BYOK or platform-level fallback. Lower usage than NOWPayments; safety net for VN customers who cannot use crypto/gateway options. |
| **OpenRouter** | LLM API gateway. Used BYOK (customer provides their own key via Setup Wizard). Also powers ID-03 L2 support triage at platform cost (minimal). | BYOK customer direct. Platform uses its own token for L2 — low volume. |
| **ElevenLabs** | TTS API. Customer BYOK. ID-02 optimizes usage for Vietnamese voice preset. ID-04 fallback: PlayHT or Amazon Polly. | BYOK customer direct. |
| **D-ID** | Avatar video generation. Customer BYOK. ID-04 fallback: audio-only still image + TTS for BASIC tier. | BYOK customer direct. |
| **Inngest** | Workflow orchestration: video generation pipeline, credit expiry cron, campaign steps, quality gate. | Platform account. Self-hosted fallback not required at current scale. |
| **Telegram (Bot API)** | @Sophia_Bbot. Support channel, activation touchpoint, ID-03 triage extended surface. | Free API. Rate-limited; manageable at current scale. |
| **Cloudflare (Workers, D1, R2, KV)** | Execution runtime + storage. Free tier available; id-04 resilience benefits directly (CF Workers AI Qwen fallback). | Platform account. Second-largest monthly spend after domain. |
| **Resend** | Transactional email: dunning notices, receipt delivery, campaign completion alerts. | Platform account. Small monthly spend. |
| **CF Workers AI (Qwen 2.5-14B)** | ID-04 fallback LLM provider. Free within CF plan. No new vendor contract. | Included in CF Workers plan. |

### Partnerships NOT in Scope

| Vendor | Why |
|---|---|
| **Polar.sh** | REJECTED for Sophia billing. Polar is a known product risk for this buyer profile. Banned per SOP. |
| **PayPal** | Banned for Sophia billing. NOWPayments + PayOS cover all target-market needs. |
| **User-provided API keys for fallback tier** | ID-04 fallback tier must use platform-credentialed vendors (CF Workers AI, PlayHT) — per BYOK + no-tech doctrine. Sub-contracting fallback responsibility to the user would violate "operator manages platform only." |

---

## 9. Customer Relationships

### Current Relationship Model

| Segment | Touch Model | Churn Driver |
|---|---|---|
| BASIC | Self-serve + Telegram support | Quota hit → no upgrade path → churn. Free trial → subscription wall → churn. |
| PREMIUM | Self-serve + Telegram support | Same as BASIC but higher tolerance. Invoices payable via crypto/card. |
| ENTERPRISE | Self-serve + low-touch operator check-ins | SLA risk. If generation fails silently (ID-04 gap), enterprise evaluates alternatives. |
| MASTER | Self-serve, minimal touch | Low churn by definition (one-time high-value). Churns on need-expiration or competitor migration. |

### Relationship Model Shifts from 5 Ideas

| Idea | Relationship Change | Before → After |
|---|---|---|
| **ID-01 Credits** | Moves BASIC + PREMIUM closer to **pay-as-you-go self-serve** | Before: binary (subscribe or leave). After: subscription protects baseline access; credits handle burst volume = lower friction + higher stickiness. Users feel in control of spend. |
| **ID-02 Voice Optimization** | Deepens **Vietnam-native trust bond** | Before: user adapts to the platform's English-first voice. After: platform adapts to the user's language. Emotional shift: "this product respects my audience" → word-of-mouth loyalty. |
| **ID-03 AI Triage** | Moves BASIC–MASTER toward **async self-service** | Before: support is email/Telegram message → human response (next business day for after-hours). After: L1 bot resolves 60–70% instantly (any hour). Only ambiguous cases escalate to human. Relationship shifts from reactive to self-service. |
| **ID-04 Resilience Layer** | Creates **contractual trust layer** for ENTERPRISE + MASTER | Before: trust is implicit ("it usually works"). After: degradation is visible and graceful — user receives "your video will resume automatically" rather than opaque error. Changes the brand perception to enterprise-grade. |
| **ID-05 Agency/White-Label** | Creates **2.5-tier relationship stack**: Sophia → Agency → End-client | Before: Sophia → End-user only. After: Sophia sells to agency as B2B (seat license), agency manages end-client as B2B2C. Sophia relationship with end-client becomes indirect (branded white-label). Key implication: end-client support goes through agency first — Sophia's support triage (ID-03) must support agency admin as well as direct users. |

### Multi-Tier Relationship Diagram (ID-05 Impact)

```
ID-05 adds:

[Sophia]  ←B2B－－ [Agency Admin]
   |                         |
   |－－seat license－－－   |－－white-label－－－> [End Client A]
   |                         |－－white-label－－－> [End Client B]
   |                         |        ...
   |
   |－－telegram L1/L2 triage－－> [Agency Admin]   ← extended to support agency
   |－－same bot triage－－－－－－> [End Clients?]  ← decision: do end-clients contact Sophia bot?
   |
Support rule: end-clients contact agency first. Agency escalates to Sophia if needed.
Sophia's L1/L2 triage is optimised for agency admin persona (billing, quota per sub-client).
```

**Support flow decision required:** End-clients on AGENCY tier contacting `@Sophia_Bbot` directly — either routed to their agency admin contact (telegram deep-link), or served via triage with context about their agency parent org.

---

## Appendix: ARPU Math Detail

### Before (4-Tier Baseline)

```
Tier              Price/mo    Est. Mix    Weighted ARPU
-----------------------------------------------------------
BASIC             $199        35%         $69.65
PREMIUM           $399        30%         $119.70
ENTERPRISE        $799        15%         $119.85
MASTER            $4,999 1x   20%         $41.66  (amortized @ $416/mo over 12 months)
-----------------------------------------------------------
Blended ARPU                   100%        ~$350 ARPU (raw pool)
Blended ARPU/active user                   ~$150–180/mo
  (accounting for trial non-payers, gaps in billing)
```

### After (With All 5 Ideas)

```
Tier              Base/mo    Add-ons/mo             Est. Mix    Weighted ARPU
---------------------------------------------------------------------------------
BASIC             $199        + $7.50 (credits avg)  30%         $62.25 base + $2.25 add = $64.50
PREMIUM           $399        + $14 (credits avg)    25%         $99.75 base + $3.50 add = $103.25
ENTERPRISE        $799        $0                     10%         $79.90
MASTER            $4999 1x    $0                      8%         $33.33 (amortized)
AGENCY            $399        $0 (per seat)          12%         $47.88
Casual (new!)     $0–199      + $29/10cr pack        15%         ~$36 (avg quarterly spend/visit)
---------------------------------------------------------------------------------
Blended ARPU                                               ~$365 gross pool
Adjusted for churn + trial gaps                             ~$165–200/mo active/user
```

### Revenue Growth Illustration (With All 5 Ideas)

| Metric | Now | +6 months (with P1 shipped) | +18 months (with P2 shipped) |
|---|---|---|---|
| Avg active users | ~50–100 (est.) | ~150–300 | ~400–600 |
| ARPU/user/month | ~$150 | ~$165 (+10% from credits) | ~$185 (+agency contribution) |
| Est. MRR | ~$7,500–15,000 | ~$25,000–50,000 | ~$75,000–110,000 |
| Revenue concentration (top 2 tiers) | ~60% | ~50% (credits + agency diversify) | ~40% |

*All figures estimates. Validate against D1 subscriptions + user_purchases + usage_events tables before using for pricing decisions.*

---

## Key Metrics to Track (Per Idea)

| Idea | Leading Indicator | Lagging Indicator |
|---|---|---|
| ID-01 | Credit pack purchase rate (% of BASIC+PREMIUM buying ≥1/quarter) | ARPU uplift, promo-to-subscription upgrade rate |
| ID-02 | VN voice preset adoption rate (% of Vietnam users enabling) | Vietnamese cohort churn rate vs global cohort |
| ID-03 | Bot deflection rate (% of Telegram messages resolved without human) | Avg support response time (hrs), support message volume trend |
| ID-04 | P95 API reliability per vendor (OpenRouter / ElevenLabs / D-ID) | Churn rate of ENTERPRISE/MASTER users citing reliability |
| ID-05 | Agency signup rate, agency→end-client conversion rate | Agency MRR as % of total MRR, agency 90-day retention |

---

## Unresolved Questions

1. **Q1 (from blocking questions):** Hybrid pricing (ID-01) — keep subscription base + credits overlay, or migrate to usage-primary with minimum-commit? Affects ID-01 migration path.
2. **Q2:** Agency tier pricing — single bracket $399 or tiered by client count? KYC: self-declared or third-party? Directly impacts ID-05 scope.
3. **Q3:** API resilience fallback — CF Workers AI (Qwen, free) acceptable for OpenRouter fallback? PlayHT NEEDS a platform key (no-tech doctrine: user provides via BYOK or Sophia provides? — need decision).
4. **Q4:** Template marketplace (ID-15, not in Top-5 but adjacent) — curated-only first or open from day one?
5. **Actuals:** Actual blended ARPU, churn rate by tier, credit purchase propensity — all must be logged from D1 tables before these estimates become planning inputs. Suggest a telemetry audit as the first step after locking this package.
