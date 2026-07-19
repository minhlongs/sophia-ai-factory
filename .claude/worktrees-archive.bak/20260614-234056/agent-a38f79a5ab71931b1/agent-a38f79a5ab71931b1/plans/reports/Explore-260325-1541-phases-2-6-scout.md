# Scout Report: sophia-ai-factory Phases 2-6 State Analysis
**Date:** March 25, 2026 | **Scope:** /home/user/sophia-ai-factory/apps/sophia-ai-factory

---

## 1. YouTube & TikTok Channel Adapters

**Files:**
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/gateway/adapters/youtube-channel-adapter.ts`
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/gateway/adapters/tiktok-channel-adapter.ts`

**State:**
- Both are **stub implementations** with graceful degradation
- Implement `ChannelAdapter` interface (publish, getStatus, healthCheck)
- Check for API keys in env (`YOUTUBE_API_KEY`, `TIKTOK_API_KEY`)
- Return stub URLs when configured: `https://youtube.com/watch?v=stub-{campaignId}` and `https://tiktok.com/@sophia/video/stub-{campaignId}`
- Last publish timestamp tracked
- **Ready for:** Real YouTube Data API v3 & TikTok Content Posting API integration

**Key Exports:**
- `class YouTubeChannelAdapter implements ChannelAdapter`
- `class TikTokChannelAdapter implements ChannelAdapter`

---

## 2. Smart Resume Engine (Checkpoint/Resume)

**File:**
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/gateway/smart-resume-engine.ts`

**How It Works:**
1. **Pipeline Steps (7 total):** "notify-start" → "generate-script" → "generate-voiceover" → "start-video-generation" → "poll-video-status" → "distribute-channels" → "finalize-campaign"
2. **Checkpoint Recording:** Saves step + metadata (e.g., script, audio_url, video_url) to `campaign_checkpoints` table via Supabase
3. **Resume Logic:** `resumeFrom(checkpoint)` → returns next step index
4. **Fallback:** In-memory Map if Supabase unavailable
5. **Methods:**
   - `checkpoint(campaignId, step, metadata)` — record step completion
   - `getLastCheckpoint(campaignId)` — fetch most recent
   - `getCheckpoints(campaignId)` — fetch all ordered by time
   - `resumeFrom(checkpoint)` — determine next step
   - `clearCheckpoints(campaignId)` — cleanup after finalize
   - `isStepCompleted(campaignId, step)` — check status

**Database:**
- Table: `campaign_checkpoints` (id, campaign_id, step, completed_at, metadata)
- Unique constraint: (campaign_id, step) for upsert support
- RLS policies: User can only manage checkpoints for own campaigns

**Key Exports:**
- `class SmartResumeEngine`
- `type PipelineStep` = "notify-start" | "generate-script" | "generate-voiceover" | "start-video-generation" | "poll-video-status" | "distribute-channels" | "finalize-campaign"

---

## 3. HeyGen Polling (Video Generation)

**File:**
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/inngest/functions/generate-campaign.ts` (lines 220-266)

**Flow:**
1. Step: "poll-video-status" (Inngest step)
2. **Polling Logic:**
   - Max 60 attempts (5 sec intervals = ~5 mins total)
   - Call `checkVideoGenerationStatus(videoJobId, tier)`
   - Check status: 'completed' → return video_url + thumbnail_url
   - Check status: 'failed' → throw error
   - Wait 5 seconds before retry
3. **On Timeout:** Throw "Video generation timed out"
4. **After Poll Success:** Record checkpoint "poll-video-status" with video URLs

**Key Function Calls:**
- `startVideoGeneration(script, tier)` → returns videoJobId
- `checkVideoGenerationStatus(videoJobId, tier)` → returns { status, output?, error? }

---

## 4. Campaign Service & Supabase Integration

**Files:**
- `/home/user/sophia-ai-factory/src/lib/services/campaign-service.ts` (very minimal, 26 lines)
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/inngest/functions/generate-campaign.ts` (main orchestrator)

**Campaign Service Exports:**
```ts
export const campaignService = {
  async getCampaigns(userId: string): Promise<Campaign[]>
  async getCampaign(id: string): Promise<Campaign>
}
```

**Supabase Interaction in generate-campaign:**
1. Lazy-init Supabase Admin client (using `SUPABASE_SERVICE_ROLE_KEY`)
2. Updates `campaigns` table: status, progress, script_content, audio_url, video_url, thumbnail_url, error_message
3. Reads from `user_profiles` table: telegram_chat_id, settings
4. Reads from `campaigns` table: script_content (for resume), audio_url, video_url, thumbnail_url
5. Inngest manages orchestration with `step.run()` for each pipeline phase

**Campaign Status Enum:**
- 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed'

---

## 5. OpenClaw Gateway Architecture

**File:**
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/gateway/openclaw-gateway.ts`
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/gateway/gateway-types.ts`

**Key Types:**
```ts
interface CampaignOutput {
  campaignId, videoUrl, thumbnailUrl?, title, description, tags
}

interface PublishResult {
  channelId, success, publishedUrl?, error?
}

interface ChannelAdapter {
  publish(content: CampaignOutput): Promise<PublishResult>
  getStatus(): Promise<ChannelStatus>
  healthCheck(): Promise<boolean>
}

interface GatewayChannel {
  id, name, adapter: ChannelAdapter, enabled, rateLimitPerHour
}
```

**Core Methods:**
- `registerChannel(channel)` — add distribution channel
- `distribute(content)` — publish to all enabled channels with retry (exponential backoff)
- `healthCheck()` → HealthReport
- `selfHeal(content, previousResult)` — retry failed channels only

**Registered Channels (in generate-campaign):**
1. YouTube (rate limit 6/hr)
2. TikTok (rate limit 10/hr)
3. Telegram Notifications (rate limit 60/hr)

**Retry Policy:** maxRetries: 2, baseDelayMs: 2000 (configurable per instance)

---

## 6. Telegram Notification Adapter

**File:**
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/lib/gateway/adapters/telegram-notification-adapter.ts`

**Implementation:**
- Implements `ChannelAdapter` interface
- Uses `TELEGRAM_BOT_TOKEN` + optional `TELEGRAM_ADMIN_CHAT_ID` from env
- `sendNotification(chatId, text)` → POST to Telegram API
- `publish()` → formats campaign info as Markdown message
- `healthCheck()` → calls `/getMe` endpoint

**Key Methods:**
- Constructor accepts optional `chatId` override
- `publish(content)` → sends formatted campaign message
- Messages include: title, campaignId, tags, video URL link

---

## 7. Settings & Integrations UI

**Existing Pages:**
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/page.tsx` — **SettingsForm** (with ProfileSection, ApiKeysSection, NotificationsSection, AppearanceSection)
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/guide/integrations/page.tsx` — **Integration guide page** (OpenRouter, HeyGen, ElevenLabs, YouTube)
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/user/integrations` — likely API endpoint

**Settings Form Sections:**
- ProfileSection
- AppearanceSection
- ApiKeysSection
- NotificationsSection

**Integration Guide Content:**
- 4 platform cards: OpenRouter, HeyGen, ElevenLabs, YouTube
- Each has: emoji, what, pricing, setup time, video tutorial, step-by-step instructions

---

## 8. Guide Routes

**Directories:**
- `/home/user/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/guide/` — **guide hub**
  - `page.tsx` — guide home
  - `layout.tsx` — guide layout wrapper
  - `integrations/page.tsx` — integration guides
  - `commands/` — (subdirectory exists)
  - `faq/` — (subdirectory exists)
  - `how-it-works/` — (subdirectory exists)
  - `screens/` — (subdirectory exists)
  - `telegram/` — (subdirectory exists)

**Status:** Guide routes exist and are live, ready for expansion

---

## 9. Supabase Tables & Migrations

**Key Tables:**
1. `campaigns` — campaign metadata, status, assets
   - Columns: id, user_id, title, topic, audience, status, progress, error_message, script_content, video_url, thumbnail_url, audio_url, created_at, updated_at
   - Enum: campaign_status ('draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed')
   - RLS: Users can view/update own campaigns

2. `campaign_checkpoints` — pipeline checkpoints for resume
   - Columns: id, campaign_id, step, completed_at, metadata
   - Unique constraint: (campaign_id, step)
   - RLS: Users can view/manage checkpoints for own campaigns

3. `user_integrations` — network credentials (ClickBank, ShareASale, Amazon)
   - Columns: id, user_id, network_id, api_key, api_secret, is_active, created_at, updated_at
   - Check: network_id IN ('clickbank', 'shareasale', 'amazon')
   - Unique: (user_id, network_id)

4. `user_profiles` — telegram_chat_id, settings, api_keys, subscription_tier, subscription status
   - api_keys stored as JSONB (not encrypted at DB level, needs encryption in app)
   - settings stored as JSONB (notifications settings here)

5. **Additional tables:** payment_events, usage_events, quota_limits, audit logs, export_jobs, etc. (50+ tables for metering/billing)

**Migrations Location:**
- Main: `/home/user/sophia-ai-factory/apps/sophia-ai-factory/supabase/migrations/`
- Docs: `/home/user/sophia-ai-factory/apps/sophia-ai-factory/docs/migrations/`

---

## 10. Package.json Dependencies

**Key Installed:**
- `inngest@^3.50.0` — workflow orchestration (for generate-campaign)
- `@supabase/supabase-js@^2.94.1` — Supabase client
- `@supabase/ssr@^0.8.0` — SSR helpers
- `@polar-sh/sdk@^0.42.5` — Polar payment integration
- `next@16.1.6` — Next.js framework
- `react@19.2.3` — React
- `react-hook-form@^7.71.1` — Form handling
- `zod@^4.3.6` — Validation
- `telegraf@^4.16.3` — Telegram bot framework
- `stripe@^14.0.0` — Stripe payments
- `resend@^6.9.4` — Email service
- `sonner@^2.0.7` — Toast notifications

---

## Summary: Current Implementation State for Phases 2-6

| Phase | Component | Status | Notes |
|-------|-----------|--------|-------|
| **Phase 2** | Script Generation | Ready | Factory pattern in place, Inngest step configured |
| **Phase 3** | Voice-over (TTS) | Ready | ElevenLabs integration in settings, Inngest step ready |
| **Phase 4** | Video Rendering | Ready | HeyGen polling loop @ 5s intervals, max 60 attempts |
| **Phase 5** | Distribution | **Stub** | YouTube/TikTok adapters are stubs with env check, Telegram works |
| **Phase 5** | Resume Logic | Ready | SmartResumeEngine fully implemented with Supabase persistence |
| **Phase 6** | Settings UI | Ready | Form sections exist, integrations guide live |

**Blocker for Phase 5:** YouTube & TikTok adapters need real API implementation (currently stub)

---

## Unresolved Questions

1. **Which video service does "start-video-generation" call?** — Assume HeyGen based on context, but could verify in `/src/lib/ai/video-generator.ts`
2. **Are API keys encrypted at rest in user_profiles?** — Currently JSONB, need app-level encryption per CLAUDE.md rules
3. **What handles the "Polar webhook → tier activation" flow?** — Need to find webhook handler for payment integration
4. **Is the "distribute-channels" step fully integrated with real YouTube/TikTok?** — Currently returns stubs
5. **Does TelegramNotificationAdapter need per-user chat IDs?** — Currently uses TELEGRAM_ADMIN_CHAT_ID, may need user-scoped routing

