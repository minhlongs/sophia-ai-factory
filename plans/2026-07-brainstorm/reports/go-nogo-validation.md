# Go/No-Go Validation Report — Sophia AI Factory Brainstorm Top-5

**Date:** 2026-07-14
**Stage:** PMF → Early Scale
**Source files:** `plans/2026-07-brainstorm/idea-package.md`, `plans/2026-07-strategic-brainstorm-4dim.md`
**Scoring model:** 6 dimensions (1-5 each), verdict thresholds: GO >= 20, CONDITIONAL GO 15-19, NO-GO < 15

---

## Scoring Summary

| # | Idea | Market | Problem | Diff | Unit Econ | Feasibility | Agentic | **Total** | **Verdict** |
|---|------|--------|---------|------|-----------|-------------|---------|-----------|------------|
| ID-01 | Usage-Based Micro-Pricing | 4 | 5 | 3 | 4 | 4 | 4 | **24** | GO |
| ID-02 | Vietnamese Voice Optimization | 3 | 5 | 3 | 3 | 5 | 4 | **23** | GO |
| ID-03 | AI Support Triage (Telegram) | 3 | 5 | 3 | 4 | 5 | 5 | **25** | GO |
| ID-04 | API Resilience Layer | 3 | 5 | 4 | 4 | 4 | 4 | **24** | GO |
| ID-05 | Agency/White-Label Tier | 4 | 4 | 3 | 5 | 3 | 4 | **23** | GO |

---

## ID-01 — Usage-Based Micro-Pricing (Hybrid Subscription + Credits)

### Dimension Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Market Size | **4** | Vietnam SMBs prefer pay-as-they-go. Addressable pool is the existing subscription gating on BASIC/PREMIUM. Large enough to move ARPU meaningfully. |
| Problem Clarity | **5** | Subscription-only creates both ceiling (big users) and floor (casuals). Quota-hit churn is observable in D1 `usage_events`. Vercel/RunwayML validate the model. |
| Differentiation | **3** | Hybrid credit model itself is table-stakes in modern SaaS. Moat is in execution quality (timing, UX, Vietnam-localized offer messaging), not structure. Any competitor can copy the pricing shape. |
| Unit Economics | **4** | Credit price ($2.90/video at $29/10) is well above marginal cost (OpenRouter + D-ID + TTS tracked via usage events). +35% ARPU from 30% attach rate is realistic. LTV > 3x CAC at standard SMB SaaS parameters. |
| Execution Feasibility | **4** | D1 `user_purchases` already has `credits_total/credits_remaining/expires_at` fields (partial groundwork). Requires: new `credits` table (or reuse purchases table), 90-day expiry cron, NOWPayments IPN coupon-line overlay. **Key constraint:** existing IPN handler (`supabase/migrations/migration-stripe-support.sql` context) must NOT break subscription flow. New hook additions only — safe additive change. |
| Agentic Fit | **4** | AI can predict optimal credit-pack offer timing (usage pattern analysis), personalized pack sizing per user's burn rate, and auto-replenish reminders. |

**Total: 24 → GO**

**Justification:** Highest ARPU/CAGR hypothesis in the package. S effort. Works as additive overlay to existing tiers. Revenue uplift is immediate and measurable. NOWPayments IPN modification is the only real risk, and it's additive (no breaking change to subscription webhook).

---

## ID-02 — Vietnamese Voice Optimization

### Dimension Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Market Size | **3** | All Vietnam users benefit, but MRR impact is zero directly — retention-only signal. The Vietnam AI-video market is small, so TAM ceiling is the current + adjacent user base. |
| Problem Clarity | **5** | Very specific: Vietnamese is tonal (6 tones) + Latin with diacritics; existing ElevenLabs presets are English-phoneme-optimized. Subtitle CSS breaks on diacritic stacking on mobile. Observable by any Vietnam user generating content. |
| Differentiation | **3** | First-mover in VN-local optimization, but structural moat is weak — ElevenLabs improving their VN model would neutralize. Advantage decays as foundation models improve VN coverage. |
| Unit Economics | **3** | Near-zero cost delta (same ElevenLabs calls, different config). Retention lift of +5-8% Vietnam cohort is meaningful at early stage but direct CAC/LTV math is retention-driven, ambiguous to prove quickly. |
| Execution Feasibility | **5** | S effort. Ships behind existing BYOK ElevenLabs integration in `tree/elevenlabs/`. Voice preset = config addition. Script validation = server-side heuristics. Subtitle styling = CSS changes. Zero new vendor contracts. Key validation step: sandbox ElevenLabs VN voice quality before committing API behavior. |
| Agentic Fit | **4** | AI can analyze Vietnamese phonetic patterns to pre-flag problematic script combinations that historically degrade avatar sync. Auto-suggest tone corrections. Low model complexity (rule-based + small classifier). |

**Total: 23 → GO**

**Justification:** Fastest ship in the package (S effort, zero new contracts). Low execution risk with high retention signal. Competitive moat in VN market is real today, even if it decays over time. Ship first, get data, decide whether to invest further in VN-specific tuning.

---

## ID-03 — AI Support Triage (Telegram Bot)

### Dimension Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Market Size | **3** | Operates across all active tiers. Addressable market is entire user base, but revenue impact is indirect (churn prevention, ops cost reduction). |
| Problem Clarity | **5** | Support volume scales linearly with customers. Quota questions, API key resets, billing confusion = low-value human time. Vietnam TZ = async support = slow response = churn. 60-70% deflection target is credible. |
| Differentiation | **3** | Bot already exists (@Sophia_Bbot). Extension is natural. Differentiation lies in depth of triage (L1 deterministic + L2 RAG + L3 human), not concept. Competitors could replicate within months. |
| Unit Economics | **4** | 5-8 hrs/week saved at early stage, 20+ hrs/week at 500-user scale. Direct ops cost reduction. CSAT improvement reduces churn, protecting LTV. The indirect MRR protection is meaningful at this stage. |
| Execution Feasibility | **5** | S effort. Existing Telegram bot already handles `/campaign`, `/status`, `/results` (protected flows must NOT break). Adds: L1 pattern-match handlers, L2 RAG on SOPs (reuses OpenRouter BYOK), escalation pre-fill. Straightforward extension of existing `land/telegram/` module. |
| Agentic Fit | **5** | This IS an agentic feature. The bot IS the agent. L2 uses LLM + RAG for free-form queries. L1 is deterministic triage (no LLM hallucination risk). Clear path to improve accuracy over time as escalation data trains the system. |

**Total: 25 → GO**

**Justification:** Highest GO score in the package. S effort, proven mechanism pattern, unblocks operator time for higher-value P2 work. L2 hallucination containment (RAG scoped to SOPs, no pricing-promise freedom) is the main operational risk — manageable with prompt engineering and eval set.

---

## ID-04 — API Resilience Layer

### Dimension Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Market Size | **3** | Universal — all tiers benefit. But MRR impact is zero directly; it's a retention/trust preservation mechanism. "Market" is the platform's own reliability envelope. |
| Problem Clarity | **5** | Four critical external dependencies (OpenRouter, ElevenLabs, D-ID, NOWPayments). Each a single point of failure. D-ID watermark/glitch artifacts, OpenRouter degraded-mode events are documented. A single failure = "Sophia is broken" to the user = lost trust and unprofitable retry loops burning budget. |
| Differentiation | **4** | In the VN AI-video market, no competitor ships multi-provider fallbacks. Decay latency for this moat is medium — US competitors may add it, but doing it VN-first with local language graceful degradation is a positioning win. |
| Unit Economics | **4** | Extra vendor spend on fallback provider (CF Workers AI free tier for Qwen = near-zero; PlayHT = modest cost). Net effect: saves from wasted retries + avoids chargebacks. Neutral to slightly positive at scale. Protects MASTER tier ARPU (highest value, highest SLA expectation). |
| Execution Feasibility | **4** | M effort. Requires: circuit breaker per provider (thin state layer via Inngest events for degradation state), retry with exponential backoff + jitter, graceful degradation paths (audio-only fallback for BASIC when D-ID fails). **Key constraint:** fallback vendor contracts must satisfy no-tech doctrine — platform-provided credentials only (CF Workers AI free tier). Replicate.com TOS compliance must be confirmed before shipping fallback for video workloads. |
| Agentic Fit | **4** | AI can predict failure patterns (rising error rates triggering pre-queue fallback). Intelligent retry with parameter variation uses LLM to classify failure reason. Anomaly detection per-provider cost burn. |

**Total: 24 → GO**

**Justification:** Highest-scoring P1 in the brainstorm. Foundational for scaling MASTER tier load (which has highest SLA expectations). Ships before ID-05 Agency tier scales. The circuit-breaker + degraded-mode infrastructure also enables the Cost Attribution Dashboard (ID-08) by providing per-provider success/fail telemetry.

---

## ID-05 — Agency/White-Label Tier

### Dimension Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Market Size | **4** | Vietnam digital marketing agencies exploded 2023-25. 20 agencies at $399/month = $8k MRR at 20% SMB conversion rate. 5-20 end clients per agency = compounding distribution multiplier. TAM is real and verifiable. |
| Problem Clarity | **4** | Agencies buying separate AI tools per client, wanting in-house branding — validated pattern. But specific $299-499 price willingness-to-pay for 1 agency managing 5-20 clients is unvalidated assumption requiring customer conversation. |
| Differentiation | **3** | VN-language + existing agent multi-client management (org_branding migration 0142 already exists) + AST config framework (AGENCY_TIERS partial) = partial groundwork. White-label itself is replicable; VN-specific verticalization is the moat. Codebase has `whiteLabel: true` on MASTER already — suggesting this isn't from scratch. |
| Unit Economics | **5** | Highest absolute MRR potential in the top-5. $299-499/agency vs $49-199 individual = 3-10x ARPU per seat. Agencies rarely switch tools managing many clients = low churn. LTV > 3x CAC very likely if 5+ client minimum is enforced. |
| Execution Feasibility | **3** | **Highest implementation risk in the top-5.** The idea-package proposes adding `AGENCY` to the Tier enum: `BASIC \| PREMIUM \| ENTERPRISE \| MASTER \| AGENCY`. But the Tier type is `"BASIC" \| "PREMIUM" \| "ENTERPRISE" \| "MASTER"` (in `seed/types/index.ts`). Adding `AGENCY` is a breaking change across: `TIER_RANK`, `allTiers: Tier[]` in `land/tier-guard.ts:45`, `UNIFIED_TIERS` config in `unified-limits.ts`, every `checkTierFeature` caller, the `TIER_CONFIGS` record, NOWPayments invoice IDs. The existing `AgencyTier` type (`'starter'\|'growth'\|'enterprise'`) is separate — the team already prototyped this but did not merge into Tier enum, likely for this reason. Requires: D1 migration for backfill (the KILL list in Tier Guard), new tenant-scoping for per-client CSS vars, KYC decision pending (blocking question Q2). |
| Agentic Fit | **4** | AI-driven per-sub-client budget forecasting, auto-anomaly detection across agency client portfolios, LLM-powered white-label content customization per end-client brand rules. |

**Total: 23 → GO**

**Justification:** Highest revenue potential in the package when executed, but carries the highest breaking-change risk of any good idea here. The Tier enum change is non-trivial and touches every tier-guard across land and forest layers. KYC decision (blocking question Q2) gates this. Proceed with a phased approach: land/admin wrapper first, defer Tier enum merge until migration strategy is validated.

---

## Overall Verdict: PACKAGE GO

All five ideas score GO. The package should proceed in the planned order.

**Strengths of the package as a whole:**

- ID-01 and ID-03 deliver immediate, independent, low-risk value (both S effort, additive code paths).
- ID-04 is foundational infrastructure that protects everything built afterward — shipping before scalability stress matters.
- The combination of revenue (ID-01), product-market-fit (ID-02), operations (ID-03), and reliability (ID-04) covers all four critical dimensions for a PMF→early-scale SaaS.
- ID-05 has the highest ceiling but the most execution complexity; it benefits from taking longer to validate.

**Package-level gaps:**
- ID-08 (Cost Attribution Dashboard) was not in this top-5 but feeds directly into ID-01's credit pricing. Without it, credit pack price calibration is blind. Recommend drafting ID-08 immediately after ID-01 L-plan locks, as a parallel early-stage data pipeline task.
- The blocking questions (Q1-Q4 in idea-package.md) must be answered before ID-01 and ID-05 L-plans are drafted. Q1 (hybrid vs pure usage-based) and Q3 (fallback vendor credentials vs no-tech doctrine) are critical.

---

## Risk Register — Top 3 Cross-Idea Risks

### RISK-01: Tier Enum Breaking Change (ID-05 dependent, codebase-wide impact)

**Probability:** High | **Severity:** Critical | **Signals from codebase:**

- `export type Tier = "BASIC" | "PREMIUM" | "ENTERPRISE" | "MASTER"` in `seed/types/index.ts:6`
- `const allTiers: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"]` in `land/tier-guard.ts:45`
- `TIER_RANK` only covers 4 tiers
- `TIER_CONFIGS` record is keyed by Tier; NOWPayments invoice IDs inline
- Existing `AgencyTier` type (`'starter'|'growth'|'enterprise'`) is a SEPARATE type in `tier-configs.ts:167` — the team has already separated agency logic from core Tier, likely because merging them is painful

**Impact if realized:** Every `checkTierFeature` call, every `resolveUserTier` lookup, every SWITCH on Tier values across `land/` and `forest/` breaks at build time. D1 backfill for existing user rows required. NOWPayments invoice for new tier must be pre-created in dashboard.

**Mitigation options:**

(a) **Phased approach (recommended):** Keep Agency as `AgencyTier` (already exists), scoped to a separate `agency_orgs` table with `agency_tier` column. DO NOT merge into `Tier` enum. This is the lower-risk, faster-ship option and aligns with the existing partial implementation.

(b) **Full Tier merge:** Requires D1 migration (ALTER TABLE users ...), backfill, NOWPayments new invoice creation, and updating every `Tier[]` reference across the codebase. Feasible but much higher blast radius.

**Decision required from code-review and planner before L-plan drafting.**

---

### RISK-02: NOWPayments IPN Handler Modification Corrupts Subscription Flow (ID-01, ID-05 depended)

**Probability:** Medium | **Severity:** Critical | **Signals from codebase:**

- NOWPayments invoices are static pre-created IDs (`NOWPAYMENTS_INVOICE_IDS` in `tier-configs.ts:12`)
- Credits require a new payment line (credit pack purchase) on top of subscription
- Two payment events for one user now possible; IPN handler must differentiate subscription-status vs credit-status events

**Impact if realized:** Subscriptions stop activating. Revenue flow breaks. Users on existing tiers lose access.

**Mitigation:**

- Additive-only change to IPN handler: new event type `credit_purchased`, existing logic untouched.
- Credits purchased via a SEPARATE invoice (not modifying subscription invoice ID).
- Use existing `user_purchases` table's `kind: PurchaseKind` field (`'subscription' | 'one_time'`) — credit packs are `'one_time'` with `sku: 'CREDIT_PACK_10'` etc.
- Atomic insert via `INSERT ON CONFLICT DO NOTHING` (same D1 pattern used for payment_events) to prevent double-processing on IPN retry.

---

### RISK-03: No-Tech Doctrine Tension with Fallback Vendor Credentials (ID-04)

**Probability:** Medium | **Severity:** High

**The contradiction:** The no-tech doctrine says "no operator-observability tokens, no operator-side credentials required for production." But the API Resilience Layer needs fallback vendor credentials (CF Workers AI Qwen, PlayHT) that must SIT IN PRODUCTION CODE/BINDINGS. These aren't user-facing credentials — they're platform-provided fallback budget.

**Impact if unresolved:** Ship fallback and violate doctrine. Don't ship fallback and degraded-mode = "Sophia is broken."

**Mitigation:**

- CF Workers AI (Qwen) free tier = no credential required, uses Workers AI binding already in `wrangler.toml`. This is compliant — it's a CF binding the operator already manages.
- PlayHT/other fallback: credential must live in wrangler secret (operator-managed), NOT hardcoded. This satisfies doctrine (operator manages platform bindings; users don't provide them).
- Document the platform-provided fallback credentials as part of the deployment contract, not operator action.
- If founder rejects platform-provided fallback credentials entirely, ship degraded-mode with clear user messaging ("third-party service unavailable — your video will be generated once service resumes") rather than silent failure.

---

## Recommended Execution Order

| Order | Idea | Rationale |
|-------|------|-----------|
| 1 | **ID-01 Micro-Pricing** | S effort, highest independent revenue uplift. Credits infrastructure is a dependency for ID-05 and ID-14. NOWPayments IPN additive change. Ship fast, measure, iterate. |
| 2 | **ID-02 Vietnamese Voice** | S effort, zero new contracts, fastest validation cycle (sandbox voice test → ship). Builds VN-market credibility while other P1s execute. Independent — can run in parallel L-plan. |
| 3 | **ID-03 AI Support Triage** | S effort. Unblocks operator time needed for P2 oversight. L2 LLM cost is a BYOK OpenRouter line item — no new budget required. Protected flow guard (don't break /campaign, /status, /results) is the single important constraint. |
| 4 | **ID-04 API Resilience** | M effort. Foundational for scaling MASTER tier load. Ship AFTER ID-01/02/03 in production for one week — observe real error rates before tuning circuit-breaker thresholds. This sequencing avoids deploying resilience for problems you haven't yet hit. |
| 5 | **ID-05 Agency/White-Label** | M effort, highest revenue potential, highest breaking-change risk. Must answer blocking questions Q2 (KYC model) before L-plan. **Recommend APPROACH-A** (AgencyTier stays separate from Tier enum) to minimize blast radius. Ship admin wrapper + org branding first; add Tier enum merge only after proven agency demand. |

**Parallel opportunities:** ID-02 and ID-03 can L-plan simultaneously with ID-01 (different file ownership). ID-04 depends on ID-01 production data for circuit-breaker threshold calibration but architecturally independent — L-plan can start in parallel, lock after ID-01 ships.

---

## Unresolved Questions

1. **Q1 (ID-01, ID-05):** Hybrid vs pure usage-based pricing. Blocks ID-01 L-plan credit pack design. Answer required before L-plan lock.
2. **Q2 (ID-05):** Agency KYC model — self-declared or third-party checker? This determines whether the feature violates no-tech doctrine.
3. **Q3 (ID-04):** Platform-provided fallback credentials acceptable? CF Workers AI (no credential) is preferred; PlayHT needs wrangler secret. This is a founder doctrine decision.
4. **Q1 (ID-05 additional):** Agency pricing — single bracket or tiered (25/50/100-client)? Blocks L-plan pricing model.
5. **ID-08 dependency:** Cost Attribution Dashboard not in top-5 but is a hard dependency for ID-01 credit-pricing calibration. Recommend L-plan immediately after ID-01 locks, even if execution is sequenced behind. Otherwise credit pack pricing is uninformed.
6. **ID-05 enum question:** Does the team adopt APPROACH-A (keep AgencyTier separate, no Tier enum merge) or APPROACH-B (merge into Tier)? This decision changes the entire L-plan architecture for ID-05. The existing `AgencyTier` type + `AGENCY_TIERS` partial implementation strongly suggests APPROACH-A was the intended path — confirm before L-plan.

---

*End of GO/NO-GO validation. All five ideas are GO. Package proceeds to L-plan stage pending blocking question answers.*
