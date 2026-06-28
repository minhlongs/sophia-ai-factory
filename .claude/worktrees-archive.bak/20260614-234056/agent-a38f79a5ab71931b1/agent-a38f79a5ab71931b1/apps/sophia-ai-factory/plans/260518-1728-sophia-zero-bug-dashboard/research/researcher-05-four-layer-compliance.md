# Sophia 4-Layer Architecture Compliance — /Dashboard Research

**Researcher:** Layer Architecture Auditor  
**Date:** 2026-05-18  
**Scope:** Import direction violations + /dashboard code placement

---

## Section 1: Current Violations (File:Line + Violation)

### SEED violations (4 total) — **Should be 0**
- `src/seed/types/quota-provider.ts:10` — **Comment only**, safe
- `src/seed/auth/enforce-tier-quota.test.ts:22` — imports `@/forest/quota/video-quota`
- `src/seed/auth/enforce-tier-quota.ts:9-10` — re-exports from `@/forest/auth/enforce-tier-quota`

**Root cause:** Circular dependency prevention gone wrong. `seed/auth` should not know forest quota logic. → Move quota enforcement logic to `seed/quota/` primitives, let forest consume.

### TREE violations (10 total) — **Should be 0**
- `tree/handover/auto-handover.ts:15` — imports `@/forest/outbox/email-outbox`
- `tree/handover/handover-email-service.ts:10-11` — imports `@/forest/email/*`
- `tree/telegram/telegram-bot-campaign-fsm.ts:20` — imports `@/land/affiliates` (getTopPrograms)
- `tree/telegram/telegram-bot-campaign-fsm-confirm.ts:10` — imports `@/forest/inngest/client`
- `tree/telegram/handlers/campaign-handler.ts:3` — imports `@/forest/inngest/client`
- `tree/telegram/dispatch-with-retry-hints.ts:23` — imports `@/forest/publishing/providers/telegram-publisher`
- Tests: 2× `@/forest/publishing`, 1× `@/forest/outbox` re-import

**Root cause:** Tree domain ops (handover, telegram bot) need email delivery & Inngest trigger. Design flaw: tree shouldn't couple to orchestration. → Extract email/Inngest dispatch to seed primitives (async event emitters), let tree emit, forest consume.

### LAND violations (8 total) — **Should be 0**
- `land/payouts/{index,pending-promoter-cron,payout-batcher,reconciliation}.ts` — export re-exports from `@/forest/jobs/*`
- `land/affiliates/{index,offer-sync-cron}.ts` — export re-exports from `@/forest/jobs/offer-sync-cron`

**Root cause:** Land barrel exports delegate to forest job runners (correct orchestration). Problem: re-exporting creates false import dependency in `land/index.ts`. → Extract job shims to `land/__jobs/` private folder with comments "DO NOT IMPORT DIRECTLY", only forest/inngest functions call them.

---

## Section 2: Dashboard Concern → Layer Mapping

| Dashboard Concern | Current Location | Correct Layer | Current Import Chain | Issue |
|---|---|---|---|---|
| **Auth Gate** | `app/dashboard/page.tsx` | seed/tree | seed/auth + land/observability | ✅ Correct (seed + land skip allowed) |
| **Billing Page** | `app/dashboard/billing/*` | forest | seed + forest/components/billing | ✅ Correct |
| **Admin Page** | `app/dashboard/admin/page.tsx` | tree (CEO ops) | seed + land/observability/analytics | ⚠️ Should import tree/admin facade |
| **Agents Page** | `app/dashboard/agents/page.tsx` | forest | seed + forest/components/missions | ✅ Correct |
| **BYOK Page** | `app/dashboard/byok/page.tsx` | tree → forest | seed + tree/byok + forest/components/byok | ✅ Correct (cascading) |
| **SOP Marketplace** | `app/dashboard/sop-marketplace/*` | forest (new) | lib/sop (NOT in 4-layer) | ❌ Stranded in lib/ |
| **Campaigns** | `app/dashboard/campaigns/*` | forest | likely direct lib/campaigns | ❌ Stranded in lib/ |
| **Server Actions** | `app/actions.ts` or local | forest (orchestration) | case-by-case | ⚠️ Scattered, no ownership |

---

## Section 3: Dashboard Code Placement Pattern

**For new /dashboard surfaces:**

```
1. If reading domain state (BYOK keys, agent team config):
   → Route: seed/tree → app/dashboard/[page].tsx
   → Data fetch: tree/X → forest/components → page component
   → Example: /dashboard/byok (seed auth + tree/byok + forest/components/byok)

2. If reading/writing business workflow (tier, billing, payouts):
   → Route: seed/auth → land/X → forest/components → app/dashboard/[page].tsx
   → Data fetch: forest API routes call land business logic
   → Example: /dashboard/billing (forest/components import land/billing)

3. If orchestrating multi-step flows (campaigns, agents, missions):
   → Route: seed/auth → forest/X → app/dashboard/[page].tsx
   → Action: forest/inngest trigger or forest/raas gateway
   → Server Action: land/X facade (if billing gate needed)
   → Example: /dashboard/agents (forest/components/missions)

4. Server Actions (@app/actions.ts or dashboard-local):
   → Minimal direct DB writes
   → Import from forest/inngest (trigger job) NOT forest/jobs
   → Tier gate via @/seed/auth/enforce-tier-quota
   → Zod validate input
```

---

## Section 4: Recommended ESLint Guard (Config Sketch)

```javascript
// eslint.config.mjs — add to no-restricted-imports rule:

const layerRestrictions = {
  'seed/': {
    restricted: ['@/tree', '@/forest', '@/land'],
    message: 'seed is foundational; import direction must be seed → any. Export public API via seed/X/index.ts',
  },
  'tree/': {
    restricted: ['@/forest', '@/land'],
    message: 'tree is domain reusable; cannot import forest orchestrators or land workflows. Use events (seed/events/) to communicate upward.',
  },
  'forest/': {
    restricted: ['@/land'], // forest CAN call land for orchestration (exception)
    message: 'forest cannot import land directly (except forest/inngest functions calling land handlers). Use event-driven or define handler interface in seed/handlers/',
  },
  'land/': {
    restricted: ['@/forest'], // NOTE: land CANNOT import forest (forest orchestrates land)
    message: 'land is business domain; cannot import forest orchestrators. Forest calls land via events or direct handler references.',
  },
};

// Apply to all TypeScript/TSX files except exemptions:
const exemptFiles = [
  'src/app/**/*', // App Router orchestrates all layers (top-level)
  'src/seed/auth/enforce-tier-quota.*', // Special: enforces tier before request
  'src/seed/auth/enriched-jwt*.ts',
  'src/seed/security/api-key-validator-*.ts',
  'src/tree/handover/handover-email-service.ts', // Exemption documented in PR #XX
  'src/tree/telegram/telegram-bot-*.ts', // Exemption documented in PR #XX
];
```

---

## Section 5: Top 5 Refactor Wins (High-violation areas)

### Win 1: Extract async event emitter to seed
**Files:** `seed/events/async-event-emitter.ts` (NEW)
**Impact:** Unlocks tree → forest communication without direct imports
**Violations solved:** tree/handover + tree/telegram (6 violations → 0)
```typescript
// seed/events/async-event-emitter.ts
export function emitAsync(event: string, data: unknown) {
  // Dispatch to forest/inngest via global context (not import)
  globalThis.__inngestEmitter?.emit(event, data);
}
```

### Win 2: Move quota logic to seed
**Files:** `seed/quota/enforcer.ts` (MOVE from forest/auth/enforce-tier-quota)
**Impact:** Eliminate seed → forest imports
**Violations solved:** seed/auth enforce-tier-quota (4 violations → 0)

### Win 3: Consolidate admin observability to tree/admin
**Files:** `tree/admin/observability-facade.ts` (NEW)
**Impact:** Dashboard admin page imports tree/admin, not land/* directly
**Violations solved:** admin page clarity (1 violation → cleaner architecture)

### Win 4: Move SOP logic to forest
**Files:** `forest/sop/` (NEW), move src/lib/sop/*
**Impact:** Dashboard SOP pages resolve to forest layer, not stranded lib/
**Violations solved:** SOP orphan concern (1 domain → proper layer)

### Win 5: Document land/jobs/* as private
**Files:** `land/__jobs/*/README.md` (NEW), refactor land/index.ts
**Impact:** Prevent re-export leakage, clarify forest-only access
**Violations solved:** land → forest re-export confusion (8 violations remain but clarified as intentional)

---

## Section 6: Unresolved Questions

1. **Circular dependency trap:** `seed/auth/enforce-tier-quota.ts` re-exports from `forest/auth/enforce-tier-quota.ts`. Is the forest copy a duplicate or a specialized variant? If duplicate → consolidate. If variant → document why.

2. **Tree → land affiliation import:** `tree/telegram/telegram-bot-campaign-fsm.ts` imports `getTopPrograms` from `land/affiliates`. This crosses 2+ layers. Should this be routed through a forest facade instead (e.g., `forest/raas/affiliate-query-helper.ts`)?

3. **Land → forest re-exports:** 8 violations are intentional (forest jobs called from land). Should we adopt a pattern like `land/__jobs-internal/` with strong comments, or keep as-is with a CI exemption list?

4. **SOP market & campaigns:** Both currently live in `lib/`. Should they move to `forest/` (if multi-tenant orchestrator) or stay in `lib/` as third-party integrations? Decision impacts 2 dashboard pages.

5. **Server Actions placement:** Should we centralize all `/dashboard` actions in `src/forest/actions/` with a barrel export, or keep them co-located per feature route? Current scattering (sop-marketplace/actions.ts, sops/[id]/actions.ts) makes imports harder to audit.

