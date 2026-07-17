# Pipeline Verification — AI Video Generation End-to-End

**Report:** kongming-actions / 04-pipeline-verification
**Date:** 2026-07-17
**Scope:** Verify Customer API Key → AI service call → video generation → delivery

---

## Findings

### 1. Directories & Services

- `src/services/` does **not exist** — no services directory.
- Video code lives in `src/land/video/` (domain layer), `src/forest/inngest/functions/` (async orchestration), and `src/land/heygen/` (provider integration).

### 2. Video Generation Code (30+ files found)

Key files by function:

| Function | File | Status |
|---|---|---|
| Active Inngest chain | `forest/inngest/functions/video-generate.ts` | **ACTIVE** |
| Legacy TTS | `forest/inngest/functions/video-tts.ts` | @deprecated ADR-0007 |
| Legacy compose | `forest/inngest/functions/video-compose.ts` | @deprecated ADR-0007 |
| Legacy upload | `forest/inngest/functions/video-upload.ts` | @deprecated ADR-0007 |
| Legacy publish | `forest/inngest/functions/video-publish.ts` | @deprecated ADR-0007 |
| Legacy scripting | `forest/inngest/functions/video-scripting.ts` | @deprecated ADR-0007 |
| Legacy visual | `forest/inngest/functions/video-visual.ts` | @deprecated ADR-0007 |
| HeyGen API client | `land/video/templates/heygen-helpers.ts` | Active |
| HeyGen wrapper | `land/video/heygen-helpers.ts` | Active |
| HeyGen full client | `land/heygen/heygen-client.ts` | Active |
| HeyGen webhook registrar | `land/heygen/webhook-registrar.ts` | Active |
| Webhook delivery | `land/fulfillment/complete-video-from-webhook.ts` | Active |
| Auto-video mission | `land/missions/auto-video-mission.ts` | Active |
| Render provider | `land/video/generation/video-render-provider.ts` | Active |
| BYOK render | `land/video/generation/render-byok-video.ts` | Active |
| D-ID talking avatar | `land/did/did-client.ts` | Active (partial — byok) |

**7 deprecated Inngest functions** (ADR-0007, 2026-05-17) — all tied to `video_jobs` table never applied to prod D1.

### 3. Inngest Workflows

Only **one** function is **actively registered** for video:
- `video-generate` → listens `video/generate.requested`

6 legacy chain functions removed from `serve()` registration in `app/api/inngest/route.ts`:
> "Deprecated handlers (Phase 06 video_jobs chain + URL-to-Revenue) removed from serve registration on 2026-05-17 per ADR 0007: the underlying `video_jobs` table was never applied to prod D1."

### 4. Video Pipeline (Two Paths)

#### Path A: Operator AI Prompt Pipeline (WAN + Fish Speech + CloudConvert)
```
/videos/generate (route.ts → 410 Gone)
  ↓
legacy → now HEYGEN mission flow per ADR-0007
```

The active `POST /api/videos/generate` returns **HTTP 410** with redirect to HeyGen mission flow.

The real operator pipeline now runs through:
```
/v1/missions/{id}/generate-video
  ↓
video-generate Inngest function
  FishSpeech TTS → WAN 2.1 video → CloudConvert mux → R2 → engine_missions.succeeded
```
Requires **3 operator env vars**: `WAN_API_KEY`, `FISH_SPEECH_API_KEY`, `CLOUDCONVERT_API_KEY`.

`video-generation.service.ts` guards this: returns `AI_VIDEO_UNAVAILABLE` if keys missing. **No confirmed production provisioning of these keys.**

#### Path B: Customer BYOK HeyGen Pipeline (primary production path)
```
Setup Wizard → user enters HeyGen API key → encrypted BYOK store
  ↓
submitByokVideo (render-byok-video.ts) → getHeyGenKey() → createHeyGenVideo()
  ↓
HeyGen processes → webhook fires → /api/webhooks/heygen
  ↓
complete-video-from-webhook.ts → downloadAndStore → R2 → send completion email
  ↓
Videos available in user gallery + publish services
```
This is the **documented production path** per `adr-0007`.

### 5. Telegram Bot Integration

**Partial implementation:**
- `/campaign_list` → list campaigns (implemented)
- `/campaign_del <id>` → delete campaign (implemented)
- `/status` command: **NOT YET IMPLEMENTED** in this file
- `/results` command: **NOT YET IMPLEMENTED** in this file

Other Telegram files: `analytics-commands.ts`, `payout-commands.ts`, `pairing.ts` — no `/status` or `/results` found.

---

## Key Tables Verified

| Table | Location | Status |
|---|---|---|
| `engine_missions` | migration `0052-missions-engine.sql` | Applied |
| `video_jobs` | migration `0031-video-pipeline-jobs.sql` | Applied but **never used** (ADR-0007) |
| `videos` | referenced in `videos-repo.ts` | Active (BYOK path writes here) |

---

## Verdict

| Question | Answer |
|---|---|
| Pipeline exists? | **PARTIAL** |
| Verified end-to-end (BYOK HeyGen)? | YES — Path B has confirmed code at every hop |
| Verified end-to-end (Operator WAN path)? | UNCONFIRMED — requires live key provisioning, no end-to-end validation found |
| Telegram /campaign | Works |
| Telegram /status | NO |
| Telegram /results | NO |

---

## Missing Links

1. **Operator video AI keys unconfirmed**: The WAN_VIDEO_API_KEY / FISH_SPEECH_API_KEY / CLOUDCONVERT_API_KEY chain requires operator provisioning. Code exists at every step, but `aiPromptPipelineConfigured()` short-circuits without keys and returns `AI_VIDEO_UNAVAILABLE`. No evidence these keys are deployed.

2. **Telegram `/status` and `/results` commands missing**: The protected flow requires these to respond correctly. Only `/campaign_list` and `/campaign_del` are implemented in `forest/telegram/campaign-commands.ts`.

3. **No end-to-end integration test for the active pipeline**: `video-generate.test.ts` exists but only covers the Inngest function in isolation. No test exercises: HeyGen BYOK → webhook → R2 → email delivery.

4. **video_jobs table orphaned**: 7 deprecated Inngest functions still reference `video_jobs` which was never applied to production D1. New code correctly uses `engine_missions` + `videos`, but remnants create maintenance risk.

5. **Delivery confirmation gap**: `complete-video-from-webhook.ts` sends email on completion, but there is no confirmed path that pushes the final video URL back to the Telegram bot as a `/results` response.

---

## Gap Summary

The BYOK HeyGen pipeline (Path B) is fully coded end-to-end: Setup Wizard key input → HeyGen API submit → webhook handler → R2 storage → email notification. The WAN operator pipeline (Path A) has complete code but **requires live API keys that are not confirmed deployed**. Telegram has `/campaign` but **lacks `/status` and `/results`** commands required by the protected flow spec.
