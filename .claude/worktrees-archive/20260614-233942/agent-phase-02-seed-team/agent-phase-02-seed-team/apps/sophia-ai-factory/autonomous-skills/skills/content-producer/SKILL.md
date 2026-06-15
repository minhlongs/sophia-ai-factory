---
name: content-producer
description: Autonomous video creation pipeline - generates script, voice, and video daily
version: 1.0.0
tier_requirement: PREMIUM
metadata:
  openclaw:
    schedule: daily
    time: "06:00 UTC"
    retry_on_failure: true
    max_retries: 2
    resources:
      memory_limit: 2gb
      timeout: 3600
---

# Content Producer - Autonomous Video Creation Pipeline

Daily schedule at 6am UTC (1pm Vietnam time). Generates script → voice → video using AI services. Triggers n8n workflows for full automation.

## Pipeline Stages

### Stage 1: Script Generation

**Service**: OpenRouter (Claude 3.7 Sonnet)
**Workflow**: `workflows/script-generator.json`

#### Prompt Template

```
You are a viral content creator specializing in fintech and crypto.

Create a 60-90 second video script about: {topic}

Requirements:
- Hook in first 3 seconds
- Pain point → solution → CTA structure
- Include affiliate mention naturally
- Vietnamese audience, casual tone
- Add [VISUAL] cues for video editor

Format:
HOOK: [attention-grabbing opening]
PAIN: [relatable problem]
SOLUTION: [how product solves it]
PROOF: [stats or testimonials]
CTA: [clear next step with affiliate link]

Affiliate to promote: {affiliate_name}
Commission: {commission}
```

#### Inputs

- **Topic**: From Airtable Topics table
  - Filter: `status = "approved" AND trend_score > 80`
  - Order by: `trend_score DESC`
  - Limit: 1

- **Affiliate**: From Airtable Affiliates table
  - Filter: `tier IN ["PREMIUM", "ENTERPRISE"] AND status = "active"`
  - Order by: `epc DESC`
  - Limit: 1

#### Outputs

Save to Airtable `Scripts` table:

- script: {generated_script}
- topic: {topic}
- affiliate_id: {affiliate_id}
- status: "generated"
- created_at: {timestamp}
- word_count: {word_count}
- hook_score: AI-scored (0-100)

### Stage 2: Voice Generation

**Service**: ElevenLabs
**Workflow**: `workflows/voice-generator.json`
**Depends On**: Stage 1

#### Voice Settings

- **Voice ID**: Vietnamese-Female-Energetic
- **Stability**: 0.75
- **Clarity**: 0.85
- **Style Exaggeration**: 0.6

#### Processing

1. **Remove Visual Cues**: Strip `[VISUAL]` tags
2. **Add Pauses**:
   - After sentences: 0.3s
   - After paragraphs: 0.6s
3. **Emphasis Markers**:
   - "chỉ" → pitch up
   - "miễn phí" → slow down
   - "ngay hôm nay" → energetic

#### Outputs

Update Airtable `Scripts` table:

- voice_url: {audio_file_url}
- voice_duration: {duration_seconds}
- status: "voice_ready"

**Storage**: Cloudflare R2
- Bucket: `sophia-ai-voices`
- Path: `voices/{date}/{script_id}.mp3`
- Public: false

### Stage 3: Video Generation

**Service**: D-ID (fallback: Pictory)
**Workflow**: `workflows/video-generator.json`
**Depends On**: Stage 2

#### Video Settings

**Presenter**:
- Type: AI avatar
- Avatar ID: sophia_asian_female
- Emotion: friendly

**Background**:
- Type: stock footage
- Keywords: fintech, crypto, technology, modern office
- Match script keywords: true

**Captions**:
- Enabled: true
- Language: vi
- Style: youtube_shorts
- Position: bottom third
- Font size: large
- Background: semi-transparent black

**Dimensions**:
- YouTube: 1920x1080 (landscape)
- TikTok: 1080x1920 (portrait)
- Instagram: 1080x1080 (square)

#### Processing

1. **Parse Visual Cues**: Extract `[VISUAL]` tags from script
2. **B-roll Insertion**:
   - Every 7 seconds
   - Duration: 3 seconds
   - Source: Pexels API
3. **Transition Effects**:
   - Type: quick zoom
   - Frequency: every scene change

#### Outputs

Save to Airtable `Videos` table:

- script_id: {script_id}
- video_url_youtube: {youtube_video_url}
- video_url_tiktok: {tiktok_video_url}
- video_url_instagram: {instagram_video_url}
- thumbnail_url: {thumbnail_url}
- duration: {duration_seconds}
- status: "video_ready"
- created_at: {timestamp}

**Storage**: Cloudflare R2
- Bucket: `sophia-ai-videos`
- Paths:
  - `videos/{date}/{script_id}_youtube.mp4`
  - `videos/{date}/{script_id}_tiktok.mp4`
  - `videos/{date}/{script_id}_instagram.mp4`
- CDN: true

## Trigger Next Stage

Once video is ready, trigger `auto-publisher` skill with:
- video_id
- script_id
- affiliate_id

## Quality Gates

### Script Quality
- Min hook score: 70
- Min word count: 100
- Max word count: 250
- Required elements: hook, pain_point, solution, cta

### Voice Quality
- Min duration: 45 seconds
- Max duration: 120 seconds
- Audio quality check: true

### Video Quality
- Min duration: 50 seconds
- Max duration: 110 seconds
- Min resolution: 1080p
- Min bitrate: 5000 kbps
- Audio-video sync check: true

## Error Handling

### Script Generation Failure
- **Action**: Retry with different topic
- **Max Retries**: 3

### Voice Generation Failure
- **Action**: Retry with backup voice
- **Backup Voice**: Vietnamese-Male-Professional

### Video Generation Failure
- **Action**: Switch to fallback service
- **Fallback**: Pictory

### Quality Gate Failure
- **Action**: Regenerate from failed stage
- **Notify Admin**: true

## Notifications

### Telegram
- **Chat ID**: {admin_chat_id}
- **On Pipeline Complete**: true
- **Message**:
  ```
  ✅ Video Ready!

  Topic: {topic}
  Affiliate: {affiliate_name}
  Duration: {duration}s

  Preview: {video_url}

  🚀 Auto-publish scheduled in 2 hours
  ```

### Slack
- **Channel**: #content-pipeline
- **On Each Stage Complete**: true

## Performance Metrics

Track:
- videos_generated_per_day
- avg_pipeline_duration
- quality_gate_pass_rate
- error_rate_by_stage
- cost_per_video

### Cost Tracking

- OpenRouter: $0.015 per 1k tokens
- ElevenLabs: $0.30 per 1k characters
- D-ID: $0.05 per video
- Cloudflare R2: $0.015 per GB/month

**Estimated**: $0.50 per video

## Compliance

### Content Policy
- No medical claims
- No get-rich-quick schemes
- Disclose affiliate relationship
- Follow platform guidelines:
  - YouTube Community Guidelines
  - TikTok Content Policy
  - Instagram Terms

### Affiliate Disclosure

Auto-add to video description:

```
⚠️ Link giới thiệu: Video có chứa link affiliate.
Chúng tôi nhận hoa hồng nếu bạn mua qua link.
```
