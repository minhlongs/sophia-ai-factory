---
title: "Wave 16 — FREE100 RaaS Dashboard Full-Flow"
description: "Ship FREE100 user end-to-end: AI video gen → multi-channel distribution → guided onboarding."
status: complete (gated)
priority: P1
effort: 8-12d
branch: main
tags: [wave16, dashboard, video-generate, distribution, telegram, onboarding, free100]
created: 2026-05-09
---

# Wave 16 — FREE100 RaaS Dashboard Full-Flow

## Goal
FREE100 (MASTER tier) user can: log in → guided onboarding → AI prompt → live progress → finished video → pick channels → auto-publish (TikTok/YouTube/Telegram/etc.). Reuse existing Inngest backend (`videoGenerate`, `publishExecute`); ship UI + thin API only. No new providers, no Polar.

## Audit Source
`plans/reports/scout-260509-0839-raas-dashboard-gap.md` (read first). Audit correction: `videoGenerate` IS registered (`src/forest/inngest/functions/index.ts:36`). True P0.1 = UI calls deprecated HeyGen (`/api/heygen/create-video`); rewire to emit Inngest event.

## Phases

| # | Phase | Priority | Effort | Status | Note |
|---|---|---|---|---|---|
| 01 | Rewire video generation (HeyGen → Inngest + SSE) | P0.1 | 2-3d | done | Shipped 2026-05-09 |
| 02 | Distribution UI + API | P0.2 | 2-3d | done (gated) | Behind NEXT_PUBLIC_DISTRIBUTE_ENABLED=1; Wave 17 unlocks |
| 03 | Telegram auto-post checkbox | P1.1 | 1-2d | done (gated) | Shipped — behind NEXT_PUBLIC_DISTRIBUTE_ENABLED=1 |
| 04 | FREE100 onboarding + auto-install SOP | P1.2 | 2d | done | Shipped 2026-05-09 |

Total: 7-10 dev-days (+1d buffer = 8-12d wallclock).

**Wave 16 COMPLETE — phases 01 + 04 + 02 + 03 shipped 2026-05-09 (commit TBD). Phases 02 + 03 gated by NEXT_PUBLIC_DISTRIBUTE_ENABLED. Wave 17 unlocks: bridge HeyGen→R2 pipeline, flip flag, Phase 04 onboarding hotfix bundled.**

## Dependency Graph
```
01 ──► 02 ──► 03
04 (parallel, independent)
```
Phase 01 unblocks 02 (distribution needs working video missions); 02 unblocks 03 (Telegram is a channel checkbox inside distribution UI). Phase 04 (onboarding) is independent — can run in parallel with 01.

## Token Budget (per phase, est.)
| Phase | Read | Write | Test | Total |
|---|---:|---:|---:|---:|
| 01 | 25k | 18k | 12k | 55k |
| 02 | 20k | 22k | 12k | 54k |
| 03 | 12k | 10k | 8k  | 30k |
| 04 | 18k | 14k | 8k  | 40k |
| — | — | — | — | **~180k** |

## Constraints (Sophia)
- Layer rules: tree no forest/land imports; forest may CALL land for orchestration (none needed here).
- Files <200 LOC; modularize via barrel re-exports.
- Zero `:any`; Zod on all API inputs; Server Actions for mutations where possible.
- Tier enum uppercase: `BASIC|PREMIUM|ENTERPRISE|MASTER`.
- Canonical imports only: `@/lib/better-auth-session`, `@/lib/db/get-user-tier`, `@/lib/db/client` (sync), `@/config/tiers`.
- Banned: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`, Polar.sh.
- Bundle <10MB compressed (current 7.11MB) — no heavy deps; reuse existing clients.

## Acceptance (Wave 16 done)
- FREE100 magic-link land → `/dashboard/onboarding` (Phase 04)
- 1 prompt → live SSE progress → playable video (Phase 01)
- "Distribute" → multi-select channels (incl. Telegram) → published (Phase 02 + 03)
- `npm run build` 0 TS errors; `npm test` all pass; SHA-match deploy verified per `sophia-deploy-verify.md`.

## Out of Scope (defer Wave 17+)
- Per-video analytics dashboard (P2.1)
- Scheduled publishing UI (P2.2)
- Bulk multi-video distribution
- HeyGen path cleanup (keep deprecated route until Wave 17)

## Phase Files
- [phase-01-rewire-video-generation.md](./phase-01-rewire-video-generation.md)
- [phase-02-distribution-ui.md](./phase-02-distribution-ui.md)
- [phase-03-telegram-auto-post.md](./phase-03-telegram-auto-post.md)
- [phase-04-onboarding-sop.md](./phase-04-onboarding-sop.md)
