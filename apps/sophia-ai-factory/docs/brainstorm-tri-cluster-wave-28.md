# Brainstorming Blueprint: Wave 28 Tri-Cluster Deep Modularization

**Date:** 2026-10-11
**Version:** 1.63.0 Target
**Target:** 15 High-Density Production Monoliths (~4,076 LOC total, 264L–292L)
**Invariants:**
- Submodules strictly `< 200 LOC`
- Root Facades strictly `< 25 LOC` (100% backward compatible)
- Zero `:any` types, zero `console.log`
- Clean unidirectional 4-layer boundaries (`seed` → `tree` → `forest` → `land`)
- 100% Green Quality Gates (`type-check`, `lint`, `layer-boundaries`, `i18n`, `vitest`)

---

## Target Candidates Breakdown

### Cluster 1: Frontend Views, UI Panels & Client Modals (5 Targets ~ 1,364 LOC)
1. `src/land/marketplace/template-submit-modal.tsx` (292L) → `src/land/marketplace/submit-modal/`
   - Form state management, category selector, validation & preview
2. `src/land/marketplace/creator-royalty-widget.tsx` (289L) → `src/land/marketplace/royalty-widget/`
   - Dual-rail payout request, balance badge, history drawer
3. `src/components/stitch/screens/login/login-form.tsx` (267L) → `src/components/stitch/screens/login/form/`
   - Magic link, password login, rate limit handler, CSRF token
4. `src/forest/components/video-preview.tsx` (266L) → `src/forest/components/video-preview/`
   - Video player viewport, transcript overlay, aspect-ratio switcher
5. `src/app/[locale]/dashboard/youtube/data.ts` (271L) → `src/app/[locale]/dashboard/youtube/data/`
   - YouTube channel analytics queries, video metadata transformers

### Cluster 2: APIs, Admin Handlers & Workflow Operations (5 Targets ~ 1,337 LOC)
6. `src/app/api/schedule/route.ts` (271L) → `src/app/api/schedule/service/`
   - Cron trigger verifier, job queueing, scheduling pipeline
7. `src/app/api/admin/ops/snapshot/route.ts` (267L) → `src/app/api/admin/ops/snapshot/service/`
   - System state capture, worker memory stats, D1 health metrics
8. `src/land/growth/viral-funnel-service.ts` (267L) → `src/land/growth/viral-funnel/`
   - Funnel step analyzer, conversion tracking, attribution attribution
9. `src/land/admin/enterprise-deal-actions.ts` (267L) → `src/land/admin/enterprise-deals/`
   - Enterprise contract actions, custom billing rules, SLA tiering
10. `src/land/gpu/gpu-mesh-actions.ts` (265L) → `src/land/gpu/gpu-mesh/`
    - GPU cluster node registration, health probes, render failover

### Cluster 3: Foundation, AI Engines & Platform Primitives (5 Targets ~ 1,375 LOC)
11. `src/seed/db/d1-client-rpc.ts` (283L) → `src/seed/db/rpc/`
    - D1 RPC query executor, batch statement serializer, failover retry
12. `src/tree/growth-v11/compute-arbitrage.ts` (279L) → `src/tree/growth-v11/arbitrage/`
    - Token price calculator, GPU cost vs margin, arbitrage opportunity detector
13. `src/seed/ai/multi-provider-router.ts` (267L) → `src/seed/ai/router/`
    - Multi-provider fallback router, latency scoring, circuit breaker probe
14. `src/seed/ai/context-window.ts` (273L) → `src/seed/ai/context/`
    - Token counter, sliding window trimmer, multi-message compressor
15. `src/tree/billing/fx-converter.ts` (264L) → `src/tree/billing/fx/`
    - USD to VND rate sync, crypto volatility hedge buffer, quote caching

---

## Quality Gate Protocols
1. File budget verification: `wc -l` check ensuring 0 submodules >= 200 LOC and facades < 25 LOC
2. Type checking: `npm run type-check` (0 errors)
3. Lint checking: `npm run lint -- --quiet` (0 errors)
4. Layer integrity: `bash scripts/check-layer-boundaries.sh` (0 violations)
5. Localization: `npm run i18n:validate` (0 missing keys)
6. Regression test: `npx vitest run` (100% green tests in affected domains)
