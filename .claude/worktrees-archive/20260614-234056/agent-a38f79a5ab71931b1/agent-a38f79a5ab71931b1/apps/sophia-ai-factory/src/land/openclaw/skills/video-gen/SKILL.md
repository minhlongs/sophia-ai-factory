---
name: video-gen
description: Domain expertise for video generation pipeline (FSM, TTS, visual, compose).
triggers: video, render, remotion, generation, tts, compose, visual, script
tier: standard
---

# Video Gen Skill

## When to activate
When orchestrating videoScripting → videoTTS → videoVisual → videoCompose → videoUpload → videoPublish.
Activate when task prompt contains: "video", "render", "tts", "compose", "script generation".

## Pipeline Stages

| Stage | Inngest Event | Output |
|---|---|---|
| 1. Script | video.script.ready | script_text |
| 2. TTS | video.tts.ready | audio_url |
| 3. Visual | video.visual.ready | frames_url |
| 4. Compose | video.composed | video_url |
| 5. Upload | video.uploaded | cdn_url |
| 6. Publish | video.published | platform_id |

## Key Constraints
- tenant_id always required on every stage event
- Cost log per stage (insert into usage_events)
- Idempotent transitions — re-entering a stage is safe (check status first)
- Never skip TTS stage even if silence video — use silence audio instead
- Remotion render must NOT run inside Cloudflare Workers edge — use background queue

## Error Handling
- TTS failure → retry 3x with exponential backoff → fail campaign with partial result
- Visual failure → retry 2x → fallback to static image + captions
- Compose failure → retry 1x → alert tenant via Telegram bot
- Upload failure → retry 5x with jitter → dead-letter queue

## Cost Budget
- Script: ~$0.002 per 1K tokens (Qwen lite tier)
- TTS: ElevenLabs pricing per character
- Visual: D-ID pricing per second
- Max cost per video: $0.50 (enforce via quota gate before starting)
