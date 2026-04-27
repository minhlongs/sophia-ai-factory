# Sophia AI Factory — E2E Video Campaign Pipeline Audit
**Status:** CRITICAL BLOCKERS DETECTED | **Date:** 2026-04-27 02:50 UTC

---

## SUMMARY

**Verdict: Pipeline CANNOT SHIP.** Paying user attempting `/campaign` via Telegram bot will hit **2 CRITICAL blockers** before any video renders. Real integrations exist (HeyGen, ElevenLabs, YouTube, TikTok, Telegram), but foundational DB schema missing + auto-fallback to mock services on empty env vars.

**Estimated user friction:** User creates campaign → Inngest triggers → generate-campaign flow → ServiceFactory detects no API keys → **silently returns MOCK script** (hard-coded 3 scenes). No error. No alert. Video "succeeds" with fake data.

---

## CRITICAL BLOCKERS (Severity: BLOCKER)

### 1. 🔴 **Missing `campaigns` Table Migration (BLOCKING)**
- **Impact:** Campaign creation fails at D1 insert
- **Location:** `campaigns` table referenced in 6+ places but NOT in migrations/0001-init.sql
  - `src/lib/inngest/functions/generate-campaign-db.ts`: `db.from('campaigns').update()`
  - `src/app/actions/campaigns.ts`: `db.from('campaigns').insert()`
  - Generate-campaign: `db.from('campaigns').select()` × 3 checkpoints
- **Status:** Schema defined in `src/lib/supabase/types.ts` (Supabase legacy) but **NOT migrated to D1 (Cloudflare SQLite)**
- **Fix Complexity:** HIGH — Need migration file + field validation
- **Blocking Until:** Migration created + deployed + tested

### 2. 🔴 **ServiceFactory Auto-Mock Mode (SILENT FAILURE)**
- **Impact:** All AI services silently degrade to mocks when env vars missing
- **Location:** `src/lib/services/factory.ts:15-21`
  ```typescript
  function isMockMode(): boolean {
    const autoMockMode = 
      !process.env.OPENROUTER_API_KEY &&
      !process.env.HEYGEN_API_KEY &&
      !process.env.ELEVENLABS_API_KEY;
    return process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true' || autoMockMode;
  }
  ```
- **Consequence:**
  - ✅ Script generates: `MockScriptService` returns hard-coded JSON
  - ✅ Voice-over "generated": `MockVoiceService` returns fake S3 URL
  - ✅ Video "renders": `MockVideoService` returns mock job ID
  - ✅ Polling "succeeds": Returns cached MP4 URL
  - ❌ **No warning to user. No error logs. Silent fake pipeline.**
- **Production Risk:** EXTREME — customers pay → get mock videos
- **Fix Complexity:** MEDIUM — Remove auto-mock fallback, require real keys or explicit feature flag
- **Blocking Until:** Either (a) real keys injected OR (b) explicit error thrown on missing keys

---

## PIPELINE STATUS (Per Step)

| Step | Status | Details |
|------|--------|---------|
| **Entry:** `/campaign topic` (Telegram) | ⚠️ NEEDS TEST | `telegram-bot-campaign-handlers.ts:27` creates campaign, triggers Inngest |
| **Campaign.created event** | ❌ BLOCKER #1 | D1 insert fails — campaigns table doesn't exist |
| **generate-script (OpenRouter)** | ⚠️ AUTO-MOCK | If no OPENROUTER_API_KEY → returns mock (BLOCKER #2) |
| **generate-voiceover (ElevenLabs)** | ⚠️ AUTO-MOCK | If no ELEVENLABS_API_KEY → returns mock URL (BLOCKER #2) |
| **startVideoGeneration (HeyGen)** | ⚠️ AUTO-MOCK | If no HEYGEN_API_KEY → returns mock job ID (BLOCKER #2) |
| **pollVideoStatus** | ✅ WORKS | Polling loop functional (10min timeout, 5s intervals) |
| **distribute-channels** | ⚠️ PARTIAL | YouTube/TikTok need OAuth tokens; Telegram adapter ready |
| **Finalize & notify** | ✅ READY | Telegram notification functional, database checkpoints (if campaign table existed) |

---

## ENVIRONMENT VARIABLES

### Required by Pipeline (from .env.production.example)

| Var | Status | Used By | Location |
|-----|--------|---------|----------|
| `OPENROUTER_API_KEY` | ❌ MISSING in wrangler.toml | Script generation | src/lib/ai/script-generator.ts |
| `ELEVENLABS_API_KEY` | ❌ MISSING in wrangler.toml | Voice-over generation | src/lib/ai/voice-service.ts |
| `HEYGEN_API_KEY` | ❌ MISSING in wrangler.toml | Video rendering | src/lib/services/real/video-service.ts |
| `TELEGRAM_BOT_TOKEN` | ❌ MISSING in wrangler.toml | Telegram notifications | src/lib/telegram/telegram-client.ts |
| `INNGEST_SIGNING_KEY` | ❌ MISSING in wrangler.toml | Webhook verification | src/app/api/inngest/route.ts |
| `INNGEST_EVENT_KEY` | ❌ MISSING in wrangler.toml | Event publishing | src/lib/inngest/client.ts |
| `YOUTUBE_API_KEY` | ⚠️ OPTIONAL | YouTube distribution | src/lib/gateway/adapters/youtube-channel-adapter.ts |
| `YOUTUBE_CLIENT_ID` | ⚠️ OPTIONAL | YouTube OAuth | src/lib/gateway/adapters/youtube-channel-adapter.ts:31 |
| `YOUTUBE_CLIENT_SECRET` | ⚠️ OPTIONAL | YouTube OAuth | src/lib/gateway/adapters/youtube-channel-adapter.ts:33 |
| `TIKTOK_API_KEY` | ⚠️ OPTIONAL | TikTok distribution | src/lib/gateway/adapters/tiktok-channel-adapter.ts |

**wrangler.toml Check:** No `[env.production]` vars section found. All secrets expected via CF Secrets (not in vars block).

### Where They Go Missing
- `wrangler.toml` has NO vars or secrets defined for AI services
- CI/CD workflow (`.github/workflows/`) not checked — may have secrets injection step
- Production deployment likely missing these secrets entirely

---

## IMPLEMENTATION STATUS

### ✅ Real Implementations (EXISTS)
- **HeyGen Client:** `src/lib/heygen/heygen-client.ts` — Full API integration
- **ElevenLabs VoiceService:** `src/lib/ai/text-to-speech-generator-elevenlabs.ts` — Full integration
- **Script Generation:** `src/lib/ai/script-generator.ts` — OpenRouter with caching
- **YouTube Adapter:** `src/lib/gateway/adapters/youtube-channel-adapter.ts` — OAuth2 refresh token flow
- **TikTok Adapter:** `src/lib/gateway/adapters/tiktok-channel-adapter.ts` — Content Posting API
- **Telegram Adapter:** `src/lib/gateway/adapters/telegram-notification-adapter.ts` — Ready
- **Telegram Bot:** `src/lib/telegram/telegram-bot-campaign-handlers.ts` — `/campaign` command handler exists
- **Inngest Function:** `src/lib/inngest/functions/generate-campaign.ts` — 130-line multi-step pipeline

### ❌ Missing/Incomplete
- **campaigns D1 Table:** Referenced everywhere, exists nowhere
- **API Route:** No `/api/campaigns` endpoint found (only Server Action `createCampaign`)
- **D-ID Integration:** Mentioned in brief but code uses HeyGen (not D-ID)
- **Auth for Endpoints:** Campaign creation is Server Action (good), but Inngest webhook auth minimal

---

## DATABASE SCHEMA GAP

**campaigns table columns (from code):**
```typescript
// Expected schema from Telegram handler & generate-campaign.ts:
{
  id: string                    // UUID primary key
  user_id: string              // Foreign key to users
  title: string                // Campaign name
  topic: string                // Topic for script generation
  audience: string             // Target audience
  status: 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed' | 'video_timeout'
  progress: number (0-100)     // Progress percentage
  template_id: string | null   // Optional template reference
  script_content: JSON         // Generated script (scenes, narration)
  audio_url: string | null     // ElevenLabs audio URL
  video_url: string | null     // HeyGen video output
  thumbnail_url: string | null // Video thumbnail
  error_message: string | null // Error details if failed
  created_at: datetime         // Timestamp
  updated_at: datetime         // Timestamp
}
```

**Status:** NOT in migrations/0001-init.sql. Code assumes Supabase persistence layer still available (dangerous for D1-only architecture).

---

## CHANNEL DISTRIBUTION READINESS

| Channel | Adapter | OAuth Required | Status | Notes |
|---------|---------|---|--------|-------|
| **YouTube** | `youtube-channel-adapter.ts` | ✅ YES | ⚠️ PARTIAL | Reads refresh token from `user_profiles.api_keys.youtube`. Will fail gracefully if token missing. |
| **TikTok** | `tiktok-channel-adapter.ts` | ✅ YES (access_token) | ⚠️ PARTIAL | Reads `tiktok_access_token` from adapter constructor. No integration to fetch from DB yet. |
| **Telegram** | `telegram-notification-adapter.ts` | ❌ NO | ✅ READY | Uses TELEGRAM_BOT_TOKEN (env var), sends via `sendTelegramMessage()` |

**Gap:** YouTubeChannelAdapter + TikTokChannelAdapter created with empty credentials in `generate-campaign.ts:18-20`. They're instantiated but receive no userId/credentials, so will always return `{success: false, error: "...not configured"}`.

---

## TELEGRAM BOT INTEGRATION

| Component | Status | Details |
|-----------|--------|---------|
| **@Sophia_Bbot** | ⚠️ DEPLOYED? | Registered, webhook handler exists |
| **Handler:** `/campaign <topic>` | ✅ FUNCTIONAL | `telegram-bot-campaign-handlers.ts:27` |
| **Handler:** `/status <id>` | ⚠️ STUB | Template exists, not verified |
| **Handler:** `/results <id>` | ⚠️ STUB | Template exists, not verified |
| **Webhook** | ⚠️ NEEDS TEST | Inngest event send at :80 — assumes INNGEST_SIGNING_KEY + INNGEST_EVENT_KEY set |

**Risk:** Telegram bot can trigger pipeline, but pipeline fails at DB layer (campaigns table missing).

---

## RISK ASSESSMENT

### P0 (Ship Blocker)
1. **D1 campaigns table missing** — Prevents any campaign persistence. Fix required before shipping.
2. **Auto-mock mode silently degrades** — Paying users receive fabricated videos. Must error explicitly or require real keys.

### P1 (Revenue Blocker)
3. **Env vars not in wrangler.toml** — Production secrets not injected. CI/CD likely missing secret setup step.
4. **Channel adapters created without credentials** — YouTube/TikTok will always fail distribution.

### P2 (UX Friction)
5. **No user-facing error feedback** — Mock mode succeeds silently. User can't tell video is fake.
6. **Telegram bot unverified** — May be outdated webhook URL, stale token, or missing IPN handler.

---

## NEXT STEPS (RECOMMENDED ORDER)

1. **Create campaigns D1 migration** (migrations/0018-campaigns.sql)
   - 15 min to write, 5 min to test
   - Unblock DB persistence

2. **Inject env vars into wrangler.toml**
   - Check GitHub Actions secrets injection
   - Verify all 6 keys present in production

3. **Replace auto-mock with explicit error**
   - Fail fast when keys missing, don't silently mock
   - 30 min refactor in ServiceFactory

4. **Wire YouTube/TikTok credentials**
   - Fetch oauth tokens from `user_profiles.api_keys` before calling adapters
   - 45 min implementation

5. **Test E2E:** Create campaign via Telegram → verify Inngest event → track through HeyGen → distribute to all 3 channels

---

## UNRESOLVED QUESTIONS

1. Is Inngest running in cloud or self-hosted? No detect in code — assumes Inngest Cloud (default).
2. Are GitHub Actions CI secrets configured? `.github/workflows/` not audited for secret injection step.
3. Is D1 `sophia-raas-db` actually provisioned? Binding exists in wrangler.toml but no DB creation log found.
4. What is the current state of @Sophia_Bbot? Is webhook URL correct? Is TELEGRAM_BOT_TOKEN valid?
5. Is production using Supabase fallback for campaigns (legacy), or fully migrated to D1?
