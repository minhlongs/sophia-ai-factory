---
phase: 1
title: "External Approvals"
status: pending
priority: P2
dependencies: []
effort: "4h"
---

# Phase 1: External Approvals

## Overview

Register/verify Sophia developer accounts: Facebook, TikTok, YouTube. Telegram bot token already owned — reuse. Goal: each channel API responds with successful publish test before moving to implementation.

## TDD Workflow

**RED**: Mock + contract test mỗi adapter **GREEN**: Implement adapter với real credentials **REFACTOR**: Extract shared HTTP client + auth logic

## Test-First Checklist

**Telegram Adapter**
- [ ] Test: Bot token valid → publish message to channel/group
- [ ] Test: Invalid token → fail gracefully (no crash)
- [ ] Test: Rate limit (1 req/sec) → queue until available

**Facebook Adapter**
- [ ] Test: Page access token → publish post (text only, dev mode)
- [ ] Test: Token expired → return refresh_needed status
- [ ] Test: Graph API error → safe error message

**TikTok Adapter**
- [ ] Test: Developer credentials → sandbox post creation
- [ ] Test: Missing video_url → validation error

**YouTube Adapter**
- [ ] Test: OAuth2 token → authenticate, upload metadata
- [ ] Test: Quota exceeded → graceful degradation

**Channel Adapter Interface**
- [ ] Test: Polymorphic dispatch (publish via any adapter)
- [ ] Test: Response normalization (all adapters return same shape)

## Implementation Steps

1. Verify/register Sophia developer accounts (Facebook, TikTok, YouTube)
2. Build telegram-adapter (reuse existing @Sophia_Bbot token)
3. Build facebook-adapter (Graph API /v18.0)
4. Build tiktok-adapter (TikTok Post API v2)
5. Build youtube-adapter (YouTube Data API v3, OAuth2)
6. Create channel-adapter umbrella interface
7. Write adapter tests (mock HTTP, verify auth)
8. Test live publish against each platform

## Success Criteria

- [ ] Telegram publish test succeeds
- [ ] Facebook publish succeeds (dev mode)
- [ ] TikTok publish succeeds (sandbox)
- [ ] YouTube upload succeeds
- [ ] Adapter interface tests pass (mocked + live)

## Risk Assessment

- Facebook Developer App review is 3-5 days — submit early, implement other channels in parallel.
