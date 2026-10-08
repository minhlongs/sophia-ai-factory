# Brainstorm Contract & Deep Architecture: Growth Triad v6
## Search-Surge SEO Jacker, Affiliate Smart-Link Yield Engine & Retention Survival Heatmap

### 1. Outcome
Deliver the complete **Growth Triad v6** autonomous growth and video monetization loop for Sophia AI Factory:
1. **Pillar 1: Multi-Modal Search-Surge SEO & Trend Jacker**
   - Real-time search query velocity spike detector via $Z\text{-score} = \frac{V_t - \mu_V}{\sigma_V}$ with surge threshold $Z \ge 2.5$.
   - Automated video metadata generator optimizing titles, descriptions, chapters, and tags using TF-IDF token weighting and cosine semantic relevance.
   - Multi-tier search intent classification (Informational, Commercial Investigation, Transactional).

2. **Pillar 2: Autonomous Affiliate Smart-Link Yield Optimizer**
   - Real-time Expected Yield scoring: $\text{Yield} = \text{EPC} \times \text{Gravity}^{0.5} \times (1 - \text{RefundRate}) \times \text{NicheRelevance}$.
   - Autonomous transcript entity extractor matching video subject to highest-yielding affiliate offer (ClickBank, CJ, Amazon, TikTok Shop).
   - Dynamic Geo-IP Smart-Link failover routing preventing dead link revenue loss.

3. **Pillar 3: Predictive Viewer Retention & Survival Heatmap Auto-Trimmer**
   - Kaplan-Meier viewer survival curve estimator: $S(t) = \prod_{t_i \le t} \left(1 - \frac{d_i}{n_i}\right)$ at 1-second resolution.
   - Cliff detection engine identifying retention drop rate $-\frac{\Delta S}{\Delta t} > 0.08/\text{sec}$.
   - Auto-Trim pacing adjustment FSM (`MONITORING` -> `CLIFF_DETECTED` -> `TRIM_RECOMMENDED` -> `PACING_OPTIMIZED`).

---

### 2. Constraints & Layer Boundaries
- **Seed Layer (`src/seed`)**:
  - Pure schemas & Zod definitions in `src/seed/types/growth-triad-v6-types.ts`.
  - SQLite table schema in `migrations/0463_growth_triad_v6.sql`.
  - Inngest event definitions in `src/seed/inngest/event-types.ts` with compile-time exactness.
- **Tree Layer (`src/tree`)**:
  - `src/tree/seo/search-surge-engine.ts`: Zero-IO $Z$-score calculation and TF-IDF token scoring.
  - `src/tree/affiliate/smart-link-yield-engine.ts`: Pure mathematical EPC yield ranking and fallback routing.
  - `src/tree/retention/survival-retention-engine.ts`: Pure Kaplan-Meier survival estimator & cliff detector.
- **Forest Layer (`src/forest`)**:
  - `src/forest/inngest/functions/seo-surge-monitor-job.ts`: Hourly trend velocity monitor.
  - `src/forest/inngest/functions/smart-link-rebalance-job.ts`: Nightly EPC yield rebalancing.
  - `src/forest/inngest/functions/retention-auto-trim-job.ts`: Video analytics survival trimmer.
- **Land Layer (`src/land`)**:
  - Authenticated Server Actions in `src/land/growth/actions/seo-surge-actions.ts`, `smart-link-actions.ts`, `retention-actions.ts`.
  - Barrel export in `src/land/growth/actions/growth-triad-v6-actions.ts`.
- **Presentation Layer (`src/components/growth-triad-v6`)**:
  - React client cockpits with Amber-400 primary and Indigo accents.
- **Quality Gates**:
  - 100% real code (NO mocks, fake data, or test doubles).
  - All files strictly under 200 lines.
  - `npm run type-check` 0 errors.
  - `bash scripts/check-layer-boundaries.sh` 0 violations.

---

### 3. Non-Goals
- Directly managing external Google Search Console or YouTube Studio OAuth credentials beyond customer BYOK configuration.
- Changing billing or payment checkout gateway mechanisms.
- Altering the existing core video generation pipeline contracts.

---

### 4. Acceptance Criteria
1. Mathematical unit tests verifying $Z$-score calculation, Kaplan-Meier survival curves, and EPC expected value yield ordering.
2. Inngest event registration with compile-time exact key validation.
3. Server Actions fully authenticated with `getCurrentUser()` and synchronous D1 client `createServerClient()`.
4. Responsive UI Cockpits rendering live metrics with zero syntax errors.
