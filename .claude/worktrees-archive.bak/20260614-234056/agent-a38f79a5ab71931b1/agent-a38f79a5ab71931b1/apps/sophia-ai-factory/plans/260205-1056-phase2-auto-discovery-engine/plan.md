---
title: "Phase 2: Auto-Discovery Engine"
description: "Strategic implementation of the Hybrid Batch-Index System for intelligent affiliate product discovery."
status: completed
priority: P1
effort: 6 weeks
branch: feat/auto-discovery-engine
tags: [phase2, auto-discovery, binh-phap]
created: 2026-02-05
---

# Phase 2: Auto-Discovery Engine Strategy

**Objective:** Build the "Sophia Index" - a curated, algorithmically scored database of high-potential affiliate products to support the **Option B ($1,200 + $100/mo)** business model.

**Strategy:** Binh-Pháp (The Art of War)
We apply systematic warfare principles to conquer data chaos and deliver high-precision intelligence.

## Strategic Phases

| Phase | Concept | Focus | Status |
| :--- | :--- | :--- | :--- |
| **[Phase 1](./phase-01-core-data-infrastructure.md)** | **始計** (Calculations) | Schema & Infrastructure | Completed |
| **[Phase 2](./phase-02-data-ingestion-service.md)** | **作戰** (Waging War) | Data Ingestion Adapters | Completed |
| **[Phase 3](./phase-03-intelligence-engine.md)** | **謀攻** (Stratagem) | SPS Scoring Algorithm | Completed |
| **[Phase 4](./phase-04-discovery-api-edge-layer.md)** | **軍形** (Disposition) | Edge API & Security | Completed |
| **[Phase 5](./phase-05-frontend-integration.md)** | **兵勢** (Energy) | Top 50 UI & Dashboard | Completed |

## Execution Principles
1.  **Hybrid Batch-Index:** Batch ingest (nightly) -> Score (SPS) -> Real-time Edge Search.
2.  **60/40 Split:** 60% effort on Intelligence Engine (Backend), 40% on UI.
3.  **Hidden Gem Focus:** Prioritize high-ticket, rising velocity items over generic bestsellers.

## Unresolved Questions
1.  ~~**Amazon Access:** Need to verify active Associates account status for PA-API access.~~ ✅ **RESOLVED** - Active account with PA-API access confirmed
2.  **Normalization:** Fine-tuning "Gravity" vs "EPC" normalization requires real data samples.

## Validation Log

### Session 1 — 2026-02-05
**Trigger:** Initial plan creation and strategic review
**Questions asked:** 7

#### Questions & Answers

1. **[Architecture]** The plan assumes Supabase for the database backend. Have you confirmed this choice aligns with your infrastructure and budget?
   - Options: Yes, use Supabase (Recommended) | Switch to Airtable | Use existing Postgres
   - **Answer:** Yes, use Supabase (Recommended)
   - **Rationale:** Supabase provides free tier Postgres with RLS, type generation, and real-time capabilities essential for the Sophia Index architecture.

2. **[Assumptions]** Amazon Associates API access is flagged as 'unresolved'. What's the status of your Amazon Associates account and PA-API approval?
   - Options: Active account with PA-API access | Account exists, no PA-API yet | Skip Amazon for MVP (Recommended)
   - **Answer:** Active account with PA-API access
   - **Rationale:** Confirmed PA-API access means Phase 2 can integrate all 3 networks (Amazon, ClickBank, ShareASale) as planned without scope reduction.

3. **[Architecture]** The SPS algorithm uses configurable weights (Commission: 0.4, Popularity: 0.3, Reliability: 0.3). How should these weights be managed?
   - Options: Environment variables (Recommended) | Admin database table | Hardcoded for MVP
   - **Answer:** Environment variables (Recommended)
   - **Rationale:** Env vars provide simple configuration without adding database complexity, while allowing adjustment without code changes through Vercel dashboard.

4. **[Assumptions]** The plan assumes nightly batch ingestion via cron jobs. Where should these cron jobs run?
   - Options: GitHub Actions (Recommended) | Vercel Cron Jobs | Separate worker service
   - **Answer:** GitHub Actions (Recommended)
   - **Rationale:** Leverages existing CI/CD infrastructure, provides free compute, version control, and avoids Vercel cron job limitations.

5. **[Risk]** Phase 3 targets 'Hidden Gem' detection with a 1.5x multiplier for trending products. How will you define 'trending' without historical data initially?
   - Options: Bootstrap with manual seed data | Start scoring after 7 days (Recommended) | Use external trend APIs
   - **Answer:** Bootstrap with manual seed data
   - **Rationale:** Manual seeding allows immediate algorithm calibration and provides "gold standard" test cases for validation. Research 10-20 known high-performers to establish baseline.

6. **[Scope]** The 'Top 50' UI is planned as a 'Bloomberg Terminal-style dense dashboard'. What's the priority for the initial release?
   - Options: Simple table with filters (Recommended) | Full Bloomberg-style dashboard | Card-based gallery view
   - **Answer:** Simple table with filters (Recommended)
   - **Rationale:** Reduces Phase 5 complexity, enables faster shipping, and allows iteration based on user feedback. Dense dashboard can be Phase 4 enhancement.

7. **[Tradeoff]** The plan estimates 4-6 weeks. Given the scope (5 phases, SPS algorithm, 3 network integrations), does this timeline feel realistic or should we reduce scope for faster delivery?
   - Options: Trim to core MVP (Recommended) | Keep current scope | Aggressive MVP (3-4 weeks)
   - **Answer:** Trim to core MVP (Recommended)
   - **Rationale:** Prioritizes shipping working intelligence engine over feature completeness. Defer non-essential features to Phase 4 to reduce risk and accelerate time-to-value.

#### Confirmed Decisions
- **Database:** Supabase Postgres with RLS and type generation
- **Amazon Integration:** Proceed with PA-API integration in Phase 2
- **Algorithm Config:** Environment variables for SPS weight tuning
- **Cron Infrastructure:** GitHub Actions for batch ingestion jobs
- **Cold Start Strategy:** Manual seed data (10-20 known gems) for algorithm calibration
- **UI Approach:** Simple table with filters for MVP (defer complex dashboard)
- **Scope Commitment:** Trim to core MVP, mark advanced features for Phase 4

#### Action Items
- [ ] Create GitHub Actions workflow files during Phase 2 implementation
- [ ] Research and document 10-20 "known gem" products for manual seed data
- [ ] Mark "Bloomberg-style dashboard" features as Phase 4 in phase-05 file
- [ ] Review Phase 4-5 scope and move non-essential items to future backlog
- [ ] Add environment variable documentation for SPS weights configuration

#### Impact on Phases
- **Phase 1:** No changes needed - Supabase schema design proceeds as planned
- **Phase 2:** Confirmed Amazon PA-API integration - no scope reduction needed
- **Phase 3:** Add manual seed data preparation task before algorithm testing
- **Phase 4:** Simplified - focus on core API functionality, defer advanced features
- **Phase 5:** Reduced scope - simple table UI instead of complex Bloomberg dashboard
