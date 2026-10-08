# Sophia AI Factory — Product Development Requirements (PDR)
## Social Direct Publisher & OAuth Cockpit (YouTube Shorts, TikTok v2, Reels)

**Version:** 1.48.0  
**Date:** 2026-10-08  
**Author:** Sophia Engineering Team  
**Status:** Implemented & Verified  

---

### 1. Executive Summary

Sophia AI Factory is a Next.js 16 App Router SaaS platform deployed to Cloudflare Workers for automated AI video generation. This release accomplishes the **Social Direct Publisher & OAuth Cockpit** milestone:

1. **Social Direct Publisher Engine**: Autonomous direct publishing across YouTube Shorts, TikTok Content Posting API v2, and Instagram Reels with anti-detection pacing (180-min cooldown, platform daily limits, and 45–90 min uniform organic jitter).
2. **Web Crypto HKDF Token Vault**: Multi-tenant AES-256-GCM authenticated encryption using edge-native `crypto.subtle` with key derivation bound to `social-vault:${userId}:${platform}:${channelId}`.
3. **Cloudflare D1 OCC Locking**: Atomic token refresh locking with 5-minute stale-lock auto-recovery to prevent multi-isolate token refresh stampedes.
4. **Obsidian Cyber-Glass UI Cockpit**: Unified management interface featuring real-time token expiry counters, 9:16 vertical safe-zone overlay player (TikTok, Shorts, Reels guides), and emergency kill-switch controls.

---

### 2. Architecture & Layer Boundaries

The implementation strictly honors the 4-layer Clean Architecture hierarchy:

```
seed (Foundational primitives)
  ├── src/seed/types/social-publisher-types.ts      (Social platform types, vault contracts, job statuses)
  └── src/seed/security/oauth-token-vault.ts        (Web Crypto AES-256-GCM, RFC 5869 HKDF-SHA256)
tree (Reusable domain logic)
  ├── src/tree/social/publisher/platform-adapters.ts (Chunk calculations, protocol payloads)
  └── src/tree/social/publisher/pacing-engine.ts     (Anti-detection pacing, daily limits, jitter)
land (D1 persistence & OCC locking)
  ├── src/land/social/platform-credentials-store.ts  (Credentials CRUD, atomic OCC refresh locks)
  └── src/land/social/publish-job-store.ts           (Publishing job lifecycle tracking)
forest (Inngest orchestration & Server Actions)
  ├── src/forest/inngest/functions/social-direct-publish-job.ts (5-step durable publishing workflow)
  └── src/forest/actions/social-publisher-actions.ts            (Authenticated Server Actions)
ui (Obsidian Cyber-Glass Frontend)
  ├── src/components/social-publisher/vertical-safe-zone-player.tsx
  ├── src/components/social-publisher/channel-credentials-grid.tsx
  ├── src/components/social-publisher/social-publisher-cockpit.tsx
  └── src/app/(app)/dashboard/social-publisher/page.tsx
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
