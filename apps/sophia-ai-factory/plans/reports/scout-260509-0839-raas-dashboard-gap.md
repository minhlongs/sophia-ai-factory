# RaaS Dashboard GAP Audit (FREE100 Full-Flow)

**Audit Date:** 2026-05-09 08:39 UTC  
**Auditor:** Claude Scout Agent  
**Codebase:** Sophia AI Factory, Next.js 16, Wave 15  
**Target User:** Non-tech CEO with FREE100 promo (MASTER tier)

---

## Executive Summary

**Current State:** 50% feature complete. User CAN generate AI videos via Inngest workflow. Cannot distribute to social channels via dashboard. SSE live progress works. Tier gating enforces MASTER access.

**Critical Gaps:**
1. **P0.1 — Video-Generate Flow Not Wired to Dashboard** (BLOCKER)
   - `/dashboard/videos/new` uses HeyGen API (legacy, slow, no AI script generation)
   - Modern `video-generate` Inngest workflow exists but unreachable from UI
   - FREE100 users see video creation UI but it calls deprecated endpoint

2. **P0.2 — Zero Distribution/Publishing UI** (BLOCKER)
   - No "Distribute" button post-video
   - Social channel integrations exist (`/dashboard/integrations/channels`) but NOT wired to videos
   - Telegram auto-post missing from dashboard; only available via backend
   - TikTok/YouTube publish UI exists in `/app/api/publish/*` but not surfaced in `[locale]/dashboard/videos`

3. **P1.1 — No Video-to-Channel Flow** (IMPORTANT)
   - `publish-execute` Inngest workflow handles TikTok, YouTube, Instagram, Facebook, Twitter, Pinterest, LinkedIn, Zalo, Threads, Reddit, Bluesky, Mastodon
   - But dashboard has NO way to trigger it post-video
   - No "Pick channels → auto-post" UX

4. **P1.2 — Missing Onboarding SOPs for FREE100** (IMPORTANT)
   - `/dashboard/sop-marketplace` exists (install SOPs)
   - No pre-installed templates for "Generate & Distribute Video Flow"
   - User lands on dashboard after FREE100 activation; no guided playbook

---

## Current State (what exists today)

### 1. Dashboard Routes Map

| Route | Component | Purpose | Who Can Access | Status |
|-------|-----------|---------|-----------------|--------|
| `/dashboard` | `page.tsx:55–144` | Home: hero, stats, setup steps | Auth'd | ✅ Works |
| `/dashboard/videos` | `videos/page.tsx` | Video gallery | Auth'd | ✅ Works |
| `/dashboard/videos/new` | `videos/new/page.tsx:1–40` | Create video wizard | Auth'd | ✅ Works (HeyGen API) |
| `/dashboard/videos/[id]` | `videos/[id]/page.tsx` | Video detail/player | Auth'd | ✅ Works |
| `/dashboard/integrations/channels` | `channels/page.tsx` | Connect TikTok, YouTube, etc. | Auth'd | ✅ Works (OAuth) |
| `/dashboard/sops` | `sops/page.tsx` | Installed workflows | Auth'd | ✅ Works |
| `/dashboard/missions` | `missions/page.tsx:9–63` | RaaS mission launcher | Auth'd | ⚠️ Partial (NL input, no video domain) |

**Key Observation:** Video & distribution pages exist separately; NO integration point.

### 2. FREE100 Activation Flow

**File:** `src/app/api/promo/redeem-free/route.ts:95–221`

**Trace:**
1. User posts promo code `FREE100` to `POST /api/promo/redeem-free`
   - Input: `{ code: "FREE100", email, fullName, tier: "MASTER" }`
   - `validatePromoCode()` → checks `free_full` type
2. `applyPromoCode()` called (file: `src/land/promo/promo-applier.ts:34–138`)
   - Calls `triggerAutoHandover()` (file: `src/tree/handover/auto-handover.ts`)
   - Returns `magicLink` + `handoverId`
3. Magic link sent via email + Telegram DM
4. User clicks link → lands at `/dashboard`

**Landing Page Logic:**
- `DashboardPage` (file: `src/app/[locale]/dashboard/page.tsx:55–144`)
  - Checks `onboarding_completed_at` (line 80)
  - Shows `showFirstTimeSteps = true` if no timestamp
  - Renders `<DashboardSetupSteps>` (line 130)

**GAP 1:** Setup steps guide users to "connect API keys" (BYOK), NOT "create your first video."

### 3. Video Generation UI Status

**Current Path (HeyGen API):**
- File: `src/app/[locale]/dashboard/videos/new/page.tsx:1–40`
- Component: `<VideoCreatorWizard>` (file: `videos/new/components/video-creator-wizard.tsx:1–150`)
- Flow:
  1. Step 1: Script input (topic, audience, duration)
  2. Step 2: Asset picker (avatar, voice ID)
  3. Step 3: Submit to `/api/heygen/create-video` (line 57)
  4. Polls HeyGen job status until done

**Issues:**
- ❌ Does NOT use modern `video-generate` Inngest workflow
- ❌ No AI script generation (user must write script manually)
- ❌ HeyGen API is slow (Wave 14 tech debt)
- ❌ No FFmpeg mux support (Wave 15 added this to Inngest, not HeyGen path)

**Modern Path (Inngest video-generate — Wave 15):**
- File: `src/forest/inngest/functions/video-generate.ts:62–200+`
- NOT REGISTERED in dashboard (see line 3-4: "NOT REGISTERED in inngest/index.ts — defer to next wave")
- Capabilities:
  - Parse input (prompt + voiceover text) ← AI generates script
  - Fish Speech TTS → R2 upload
  - Wan 2.1 video generation
  - Poll until done
  - Mux audio/video via FFmpeg (Wave 15 feature)
  - Upload final.mp4 to R2
  - Record MCU cost
- **Status:** Fully built, NOT wired to dashboard

### 4. Distribution/Publishing Flow Status

**Social Channel Integration (EXISTS):**
- File: `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx`
- Supports: TikTok, YouTube, Instagram, Facebook, Twitter, Pinterest, LinkedIn, Zalo, Threads, Reddit, Bluesky, Mastodon
- OAuth callbacks in place: `/app/api/oauth/{provider}/callback`

**Publishing Inngest Workflow (EXISTS):**
- File: `src/forest/inngest/functions/publish-execute.ts:1–80+`
- Listens: `publish.scheduled` event
- Orchestrates: TikTok, YouTube, Instagram, Facebook, Twitter, Pinterest, LinkedIn, Zalo, Threads, Reddit, Bluesky, Mastodon publishers
- Status machine: scheduled → uploading → processing → live | failed
- Idempotent via CAS (Compare-And-Set) on `publishing_jobs.status`

**API Endpoint (EXISTS):**
- File: `src/app/api/publish/schedule/route.ts`
- POST to schedule video → social channels

**Dashboard Distribution UI (MISSING):**
- ❌ No UI component in `/dashboard/videos/[id]` to trigger publish
- ❌ No "Pick channels → auto-post" form
- ❌ No link between video gallery and publish workflow

**Telegram Auto-Post (PARTIAL):**
- Backend: `src/tree/telegram/telegram-bot-campaign-handlers.ts` handles `/campaign` → posts to user's Telegram
- Dashboard: NOT exposed as "auto-post-to-Telegram" button

### 5. SSE Live Progress Status

**Endpoint (EXISTS):**
- File: `src/app/api/v1/missions/[id]/stream/route.ts:1–130+`
- Type: SSE (Server-Sent Events)
- Auth: Bearer token + optional `x-api-key`
- Features:
  - Polls D1 every 2s for mission status
  - Emits events with cursor (unix-ms timestamp)
  - Supports Last-Event-ID reconnect
  - Heartbeat every 15s (prevents connection timeout)
  - Handles terminal statuses: succeeded, failed, cancelled

**Dashboard Consumption (MISSING):**
- `RenderStatus` component (file: `videos/new/components/render-status.tsx`) polls HeyGen API directly
- Does NOT use SSE endpoint
- Not wired to Inngest video-generate mission

**Mission Detail Page:**
- File: `src/[locale]/dashboard/missions/[id]/page.tsx:1–30`
- Component: `<MissionDetail missionId={id}>`
- Status: This page exists for RaaS missions (NL input), NOT for video generation missions

### 6. Tier-Gate Enforcement

**Tier Lookup (EXISTS):**
- File: `src/seed/db/get-user-tier.ts`
- Called by: dashboard page, API routes
- Reads from D1 `subscriptions` table

**Video Quota Per Tier (EXISTS):**
- File: `src/forest/quota/video-quota.ts:18–23`
  ```
  BASIC: 0 (blocked)
  PREMIUM: 30/month
  ENTERPRISE: 200/month
  MASTER: 1000/month
  ```
- Atomic check: `src/seed/auth/enforce-tier-quota.ts:41–66`

**FREE100 User Tier:**
- Promo code sets tier to MASTER (file: `src/app/api/promo/redeem-free/route.ts:161`)
- MASTER users get 1000 videos/month
- ✅ No gating issue for FREE100 users (they are MASTER)

---

## GAPs (P0/P1/P2 with fix path)

### P0.1 — Video-Generate Flow Not Wired to Dashboard
**Severity:** P0 Blocker (breaks core value prop: "generate AI video")

**Current:** User clicks "Create Video" → HeyGen form (no AI script gen, slow)  
**Expected:** User clicks "Create Video" → AI prompt input → Modern Inngest workflow

**Root Cause:**
- `video-generate` Inngest function exists but commented as "NOT REGISTERED in inngest/index.ts"
- Dashboard still calls deprecated HeyGen API endpoint
- No bridge between video creation UI and modern Inngest workflow

**Fix Path:**
1. Register `videoGenerate` in `src/forest/inngest/functions/index.ts`
2. Create new component: `src/app/[locale]/dashboard/videos/new/components/ai-script-wizard.tsx`
   - Input: prompt (e.g., "Create a viral TikTok about AI productivity tools")
   - Call AI to generate script (hook + body + CTA)
   - Display generated script for user approval
3. Modify `VideoCreatorWizard` to emit `video/generate.requested` event instead of HeyGen call
4. Add SSE consumer to `RenderStatus` for live progress
5. **Files to Modify:**
   - `src/forest/inngest/functions/index.ts` — register videoGenerate
   - `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.tsx` — emit Inngest event
   - `src/app/[locale]/dashboard/videos/new/components/render-status.tsx` — consume SSE instead of polling HeyGen

---

### P0.2 — Zero Distribution/Publishing UI
**Severity:** P0 Blocker (breaks "auto-distribute to social channels" feature)

**Current:** Video generated, no way to post to TikTok/YouTube/Telegram from dashboard  
**Expected:** Video detail page has "Distribute" button → pick channels → auto-post

**Root Cause:**
- Publishing workflow exists backend-only
- Dashboard video detail page has NO distribution UI
- No integration between video gallery and `publish-execute` workflow

**Fix Path:**
1. Create component: `src/app/[locale]/dashboard/videos/components/distribution-panel.tsx`
   - Shows connected channels (read from `publishing_channels` table where user_id = current_user)
   - Multi-select: which channels to post to
   - Optional: caption input, scheduling
   - Submit → POST `/api/v1/videos/[id]/distribute` (new endpoint)
2. New API endpoint: `src/app/api/v1/videos/[id]/distribute/route.ts`
   - Auth: current user
   - Input: videoId, channel_ids, caption?
   - Action: create publishing job + emit `publish.scheduled` event
   - Return: job ID for SSE monitoring
3. Add to video detail page: `src/app/[locale]/dashboard/videos/[id]/page.tsx`
   - Import `<DistributionPanel videoId={id} />`
   - Show only if video is ready (status = completed)
4. **Files to Modify/Create:**
   - Create: `src/app/[locale]/dashboard/videos/components/distribution-panel.tsx`
   - Create: `src/app/api/v1/videos/[id]/distribute/route.ts`
   - Modify: `src/app/[locale]/dashboard/videos/[id]/page.tsx` — add panel

---

### P1.1 — No Telegram Auto-Post Button
**Severity:** P1 Important (breaks "auto-distribute to Telegram" specifically)

**Current:** Telegram integration exists backend-only; users must use `/campaign` command in Telegram bot  
**Expected:** Dashboard has "Post to Telegram" checkbox (if user paired Telegram)

**Root Cause:**
- Telegram bot handler exists: `src/tree/telegram/telegram-bot-campaign-handlers.ts`
- Dashboard has NO button to trigger it
- User must go back to Telegram, use commands

**Fix Path:**
1. In `DistributionPanel` from P0.2, detect if user has Telegram paired
   - Query `telegram_paired_chats` where `paired_by = user_id`
   - Show checkbox: "Post to Telegram (@YourUsername)"
2. When distributing with Telegram selected, emit event: `telegram/post.requested` (new event)
3. New Inngest handler: `src/forest/inngest/functions/telegram-video-post.ts`
   - Listen: `telegram/post.requested`
   - Action: call `sendHandoverTelegramDm()` with video URL + caption
   - Or: post to user's Telegram channel directly (if paired with channel, not just chat)
4. **Files to Create/Modify:**
   - Create: `src/forest/inngest/functions/telegram-video-post.ts`
   - Modify: `src/app/[locale]/dashboard/videos/components/distribution-panel.tsx` — add Telegram checkbox
   - Modify: `src/app/api/v1/videos/[id]/distribute/route.ts` — emit telegram event if selected

---

### P1.2 — Missing Onboarding SOPs for FREE100
**Severity:** P1 Important (prevents user from self-service)

**Current:** User lands on dashboard, sees "Setup Steps" asking for API keys (BYOK path)  
**Expected:** User sees: "Welcome! Let's create your first AI video" with guided SOP

**Root Cause:**
- `DashboardSetupSteps` guides BYOK setup, not video creation
- No pre-installed SOP for "Generate & Distribute Video"
- FREE100 users don't need BYOK (they use platform defaults); flow is wrong for them

**Fix Path:**
1. Detect FREE100/MASTER tier activation in `DashboardPage`
   - Check: `tier === 'MASTER' && !onboarding_completed_at`
   - OR: check for magic-link activation flag
2. Create SOP template: `src/lib/sop/seeds/playbooks/video/video-generation-starter.ts`
   - Step 1: Generate AI script (prompt input)
   - Step 2: Pick avatar + voice
   - Step 3: Render video (Inngest workflow)
   - Step 4: Distribute to channels
   - Step 5: View analytics
3. Auto-install template on handover: modify `src/tree/handover/auto-handover.ts`
   - After user created, insert into `user_sop_installations` with this template
4. Modify dashboard first-time flow to link to this SOP instead of BYOK steps
5. **Files to Create/Modify:**
   - Create: `src/lib/sop/seeds/playbooks/video/video-generation-starter.ts`
   - Modify: `src/tree/handover/auto-handover.ts` — auto-install SOP
   - Modify: `src/app/[locale]/dashboard/page.tsx` — show SOP for FREE100 instead of BYOK

---

### P2.1 — Missing Analytics Dashboard for Videos
**Severity:** P2 Nice-to-have (not blocking full flow)

**Current:** Videos exist, no per-video analytics (views, engagement, channel performance)  
**Expected:** Video detail shows: "Posted to 3 channels, 1.2K views, 150 likes"

**Fix Path:**
- Extend publishing job schema to track engagement metrics
- Create dashboard component: `src/app/[locale]/dashboard/videos/components/distribution-analytics.tsx`
- Files: Add to video detail page

---

### P2.2 — Scheduled Publishing UI
**Severity:** P2 Nice-to-have

**Current:** Publish happens immediately  
**Expected:** "Schedule for 3pm tomorrow" option

**Fix Path:**
- Modify `DistributionPanel` to accept `scheduledAt` timestamp
- `publish-execute` already supports scheduling
- Just expose UI in distribution form

---

## Recommended Wave 16 Scope (top 3-5 P0/P1 items)

**Rank by Impact + Effort:**

### Wave 16.1 (Critical Path)
**[P0.1] Inngest video-generate wiring + new video creation UX**
- Register `videoGenerate` in Inngest index
- Create AI prompt input form → emits event
- Consume SSE for live progress
- **Effort:** 3–4 days
- **Impact:** Unblocks core "generate video" feature with AI script
- **Files:** ~5 modified, ~2 new

### Wave 16.2 (Core Distribution)
**[P0.2] Distribution panel + API endpoint + social publishing integration**
- Dashboard distribution UI (pick channels)
- New `/api/v1/videos/[id]/distribute` endpoint
- Emit `publish.scheduled` event
- **Effort:** 2–3 days
- **Impact:** Unblocks "auto-distribute to TikTok/YouTube/Instagram"
- **Files:** ~2 modified, ~2 new

### Wave 16.3 (Telegram-Specific)
**[P1.1] Telegram auto-post from dashboard**
- Detect Telegram pairing in distribution panel
- New Inngest handler + event
- **Effort:** 1–2 days
- **Impact:** Closes "Telegram auto-post" gap
- **Files:** ~2 modified, ~1 new

### Wave 16.4 (Onboarding)
**[P1.2] Auto-install video generation SOP + redirect first-time users**
- Create SOP template + auto-install logic
- Modify dashboard first-time flow
- **Effort:** 1–2 days
- **Impact:** Guides FREE100 users to success
- **Files:** ~2 modified, ~1 new

**Total Wave 16 Effort:** ~7–11 days (3 dev + 1 QA + 1 prod support)

---

## Unresolved Questions

1. **Video Job Polling:** Should `RenderStatus` use new SSE endpoint or continue polling HeyGen?
   - Answer: Use SSE for Inngest path (Wave 16), keep HeyGen polling for backward compat (wave 17 cleanup)

2. **Telegram Channel vs Chat:** Does user have paired channel (for public posts) or just chat?
   - Answer: Check `telegram_paired_chats.is_channel` flag; branch UI accordingly

3. **Analytics Backend:** Where to store published video engagement (views, likes)?
   - Answer: Extend `publishing_jobs` table with `metrics` JSON column; poller syncs from social APIs

4. **Multi-Video Distribution:** Can user batch-post multiple videos to same channels?
   - Answer: Out of scope for Wave 16; flag for Wave 17 (multi-select gallery + bulk distribution)

5. **Video Quota Enforcement:** Does distribution count toward MCU quota?
   - Answer: No; only video GENERATION counts. Distribution is free (only social API calls count, not enforced yet)

---

## Summary Table

| GAP | Severity | Current | Expected | Fix Effort | Wave |
|-----|----------|---------|----------|------------|------|
| Video-generate not wired | P0 | HeyGen form | AI prompt → Inngest | 3–4d | 16.1 |
| No distribution UI | P0 | N/A | Pick channels button | 2–3d | 16.2 |
| Telegram not in dashboard | P1 | Bot-only | Checkbox in UI | 1–2d | 16.3 |
| No video onboarding SOP | P1 | BYOK flow | Guided video SOP | 1–2d | 16.4 |
| No video analytics | P2 | N/A | Views + engagement | 2–3d | 17+ |
| No scheduled publishing | P2 | Immediate | Calendar UI | 1d | 17+ |

---

**End Report**
