---
title: "Phase 1 — Facebook + X Publishers + Sentry DSN"
description: "Add Facebook Reels & X/Twitter publishers to Sophia native pipeline; wire Sentry DSN secret."
status: completed
priority: P2
effort: 4d
branch: main
tags: [publishing, oauth, observability, raas-dashboard]
created: 2026-05-08
---

# Phase 1 — Facebook + X Publishers + Sentry DSN

## Goal

Extend native publishing pipeline (currently 6 providers) with `facebook` and `twitter`, then wire Sentry DSN as a wrangler secret so error forwarding goes live. Ships in 1 sprint.

## Context

- Existing 6 publishers: tiktok, youtube, instagram, pinterest, linkedin, zalo
- Pattern: `Publisher` interface (upload/pollStatus/getMetrics) + OAuth callback + token-crypto + cron refresher
- Registration: `buildPublisher()` switch in `src/forest/inngest/functions/publish-execute.ts`
- UI: `channels-client.tsx` CHANNEL_META map + `/api/v1/integrations/channels` route
- Sentry forwarder already exists at `src/lib/observability/sentry-forwarder.ts` — only needs DSN env var
- D1 table `publishing_channels` has CHECK constraint on `provider` — must extend in migration

## Implementation Notes

**Tests:** 2810/2810 pass (baseline 2796 → +14 new)
**Build:** 0 TypeScript errors
**Code-reviewer:** 9.2/10 SHIP-READY (0 critical, 1 HIGH polished, 4 MEDIUM/4 LOW deferred)
**Optimizations applied:** migration comment fix + isUserAdmin helper swap. Twitter 512MB streaming + STATUS polling deferred to Phase 2 backlog.
**Operator follow-up:** 5 wrangler secrets pending + manual OAuth round-trip smoke per phase.

## Phases

| # | File | Status | Effort |
|---|---|---|---|
| 01 | [phase-01-facebook-publisher.md](phase-01-facebook-publisher.md) | completed | 1.5d |
| 02 | [phase-02-twitter-publisher.md](phase-02-twitter-publisher.md) | completed | 2d |
| 03 | [phase-03-sentry-dsn-config.md](phase-03-sentry-dsn-config.md) | completed | 0.5d |

## Key Dependencies

- D1 migration to add `'facebook'`, `'twitter'` to `publishing_channels.provider` CHECK constraint (Phase 1 + 2 both touch — coordinate single migration `0090`)
- `ChannelProvider` type union + `ChannelStatus` extension in `publisher-interface.ts`
- `buildPublisher()` switch in `publish-execute.ts`
- `oauth-token-refresher.ts` `refreshChannelToken()` switch
- `channels-client.tsx` CHANNEL_META + `SUPPORTED_PROVIDERS` in API route
- Wrangler secrets: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`
- `OAUTH_STATE_SECRET`, `OAUTH_TOKEN_ENC_KEY` already configured

## Success Criteria

- `npm test` passes (existing 844+ tests + new tests for fb/twitter)
- `npm run build` 0 TypeScript errors
- Both publishers work in mock mode without env vars
- Sentry DSN in wrangler secrets; `/api/health` shows sentry status; one test event lands in Sentry dashboard
- Settings UI shows 8 channel cards (was 6)
- Zero `:any`, files under 200 LOC, kebab-case names

## Out of Scope (defer)

- Threads/Reddit/Bluesky/Mastodon (Phase 2)
- Real video gen (Wan 2.1, Fish Speech) — Phase 2
- Credit metering refactor — Phase 3
- Upload-Post NPM (rejected — native publishers preferred)
