# Sophia AI Factory — Product Development Requirements (PDR)
## Reality Loop v1.2 Telemetry Hardening & Autonomous E-Commerce Video Engine

**Version:** 1.2.0  
**Date:** 2026-10-07  
**Author:** Sophia Engineering Team  
**Status:** Implemented & Verified  

---

### 1. Executive Summary

Sophia AI Factory is a Next.js 16 App Router SaaS platform deployed to Cloudflare Workers for automated AI video generation. This release accomplishes two major architectural milestones:

1. **Reality Loop v1.2 Telemetry Hardening**: All 13 canonical performance event emitters are now fully wired into production call sites (`13 wired, 0 deferred`). Added the `editCreativeArtifact` Server Action for human-in-the-loop artifact refinement, resolved the FNV-1a telemetry idempotency hash collision hazard via disambiguated revision counters, and classified contingent event types to prevent false-positive degradation alerts.
2. **Autonomous E-Commerce Product-to-Video Engine**: Scaffolds self-service Shopify Admin GraphQL and WooCommerce REST v3 catalog synchronizers with per-store circuit breaker protection, unified catalog normalization, and autonomous creative mission dispatching.

---

### 2. Architecture & Layer Boundaries

The implementation strictly honors the 4-layer Clean Architecture hierarchy:

```
seed (Foundational primitives)
  └── src/seed/types/ecommerce.ts          (Zod schemas, store configs, unified product items)
tree (Reusable domain logic)
  ├── src/tree/ecommerce/shopify-client.ts     (GraphQL client, circuit breaker, failure classification)
  ├── src/tree/ecommerce/woocommerce-client.ts (REST v3 client, Basic Auth, circuit breaker)
  └── src/tree/performance/emitter-health.ts   (Static registry, 13 wired, contingent classification)
land (Domain workflows & Server Actions)
  ├── src/land/creative-mission/edit-artifact-action.ts (Human artifact edits, provenance, telemetry)
  ├── src/land/commerce/catalog-mapper.ts               (Shopify/WooCommerce to Unified mapper, prompt builder)
  └── src/land/commerce/mission-trigger.ts              (Bridge dispatching creative video missions)
```

---

### 3. Reality Loop v1.2 Specifications

- **Canonical Event Types (13/13 Wired)**:
  - `mission.created`, `mission.abandoned`
  - `agent.started`, `agent.failed`
  - `approval.requested`, `approval.approved`, `approval.rejected`
  - `creative.accepted`, `creative.rejected`, `creative.edited`
  - `memory.used`, `memory.corrected`
  - `mission.cost_recorded`
- **Telemetry Disambiguation**: `loopEventId` now disambiguates human iterations using `${missionId}:${assetId}:${editCount}` to prevent sequential rework collisions under SQLite FNV-1a `INSERT OR IGNORE`.
- **Contingent Staleness Suppression**: Events triggered only on errors or human interventions (`creative.edited`, `memory.corrected`, `mission.abandoned`, `agent.failed`, `approval.rejected`, `creative.rejected`) are tracked with metrics but suppressed from 24h staleness calculations.

---

### 4. E-Commerce Video Pipeline Specifications

- **Platforms Supported**:
  - Shopify Admin GraphQL API (2024-04)
  - WooCommerce REST API (v3)
- **Circuit Breaker Protection**: Integrates `shouldAllowRequest`, `recordSuccess`, and `recordFailure` with per-domain/store isolation.
- **Unified Product Model**: Normalizes titles, descriptions (HTML-stripped), variants, pricing, and imagery.
- **Autonomous Mission Trigger**: Automatically maps catalog metadata into high-converting video generation prompts with headline hooks, 3 selling points, call-to-action, target audience, and multi-channel aspect ratios.

---

### 5. Verification & Quality Gates

- `npm run type-check`: 0 errors
- `npm run lint`: 0 errors
- `bash scripts/check-layer-boundaries.sh`: 100% clean
- `npm run i18n:validate`: 0 missing keys
- Vitest Test Suites: 12 test files passed, 80 tests green
- File size policy: All newly added modules strictly under 200 LOC.
