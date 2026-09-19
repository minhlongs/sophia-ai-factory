# BRIEFING — 2026-09-19T17:11:00Z

## Mission
Implement Milestone 2 (M2: Autonomous Multi-Channel Social Publisher Fleet / R3) covering social publishing adapters (YouTube, TikTok, Instagram Reels, Telegram), idempotent scheduler cron with OCC CAS claiming & peak slots, exponential backoff retry queue, and viral performance metrics ingestion (including Instagram Reels harvester).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_worker_m2/
- Original parent: 462719b1-95d2-4d1a-8ebb-6e6e29866e0f
- Milestone: M2 (Autonomous Multi-Channel Social Publisher Fleet / R3)

## 🔒 Key Constraints
- Integrity Mandate: Genuine implementation only, no hardcoded test results, dummy facades, or shortcuts.
- Write Ownership strictly respected:
  - `apps/sophia-ai-factory/src/forest/inngest/functions/publish-execute.ts`
  - `apps/sophia-ai-factory/src/forest/publishing/`
  - `apps/sophia-ai-factory/src/land/video/publishing/`
  - `apps/sophia-ai-factory/src/forest/inngest/functions/analytics-sync.ts`
  - Unit tests in `src/forest/publishing/__tests__/` or `src/land/video/publishing/__tests__/`
- No :any types in TypeScript.
- No console.log/warn/error; use logger utility.
- Preserving CF-direct deployment & Sophia layer architecture.

## Current Parent
- Conversation ID: 462719b1-95d2-4d1a-8ebb-6e6e29866e0f
- Updated: 2026-09-19T17:11:00Z

## Task Summary
- **What to build**: Harden social publishing adapters (YT Shorts, TikTok Shop/Direct Post, IG Reels, Telegram Bot API), scheduler cron with OCC CAS job claiming and peak audience slot / cooldown enforcement, exponential backoff retry in publish-execute, and analytics sync / webhook ingestion + IG Reels metrics harvester.
- **Success criteria**: All vitest tests pass in publishing directories (34 test files, 235 tests pass), 100% clean layer boundary check, zero TypeScript errors (`tsc --noEmit`), zero ESLint errors.
- **Interface contracts**: apps/sophia-ai-factory/CLAUDE.md, PROJECT.md

## Key Decisions Made
- Added container readiness polling loop to `InstagramPublisher` with retry interval and 9007 / 2207027 error code recognition.
- Implemented OCC CAS atomic claim `atomicClaimJob` in `runSchedulerCron` (`apps/sophia-ai-factory/src/forest/publishing/scheduler.ts`) with `alreadyClaimed: true` hint passed to Inngest to avoid duplicate race conditions.
- Upgraded `publish-execute.ts` with `RETRY_BACKOFF_SCHEDULE_SECONDS = [30, 60, 300, 900, 3600]` and `step.sleep` backoff retry delays.
- Built `apps/sophia-ai-factory/src/forest/publishing/instagram-metrics-harvester.ts` with decoupled insights fetcher, token caching, auto-renewal, and idempotent writes to `publishing_results`, `video_analytics`, and `performance_events`.
- Updated webhook handlers (`youtube-notification`, `tiktok-notification`, `tiktok-shop`) to feed `performance_events` for engagement and affiliate/shop revenue.

## Artifact Index
- /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_worker_m2/DISPATCH.md - Dispatch requirements
- /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_worker_m2/progress.md - Progress heartbeat
- /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_worker_m2/handoff.md - Final handoff report

## Change Tracker
- **Files modified**:
  - `src/land/video/publishing/providers/instagram-publisher.ts`: Media container readiness polling loop, shares metric support
  - `src/land/video/publishing/publish-upload.ts`: Telegram publisher fallback & rate limit retry-after extractor
  - `src/forest/publishing/scheduler.ts`: OCC CAS claiming `atomicClaimJob` & peak slot / burst cooldown cron runner
  - `src/forest/inngest/functions/publish-execute.ts`: Exponential backoff schedule `[30, 60, 300, 900, 3600]` and scheduler cron
  - `src/forest/publishing/instagram-metrics-harvester.ts`: Harvests IG Reels metrics into `video_analytics` & `performance_events`
  - `src/forest/inngest/functions/analytics-sync.ts`: Synchronizes YouTube & Instagram analytics into `performance_events`
- **Build status**: Pass (`npm run type-check`: 0 errors; layer boundary script: 0 errors; vitest: 34 files / 235 tests pass)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 34 test files, 235 tests passed
- **Lint status**: 0 errors
- **Tests added/modified**: 4 new test suites (21 new tests)
  - `src/forest/publishing/__tests__/scheduler-cron.test.ts`
  - `src/forest/publishing/__tests__/backoff-retry.test.ts`
  - `src/forest/publishing/__tests__/webhook-metrics-ingestion.test.ts`
  - `src/forest/publishing/__tests__/instagram-harvester.test.ts`

## Loaded Skills
- cook: /Users/macbook/sophia-ai-factory/.agent/skills/cook/SKILL.md
