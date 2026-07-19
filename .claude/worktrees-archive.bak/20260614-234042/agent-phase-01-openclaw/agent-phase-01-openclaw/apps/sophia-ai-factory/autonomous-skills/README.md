# Autonomous Skills — CHÚA CHÙM System

> **CHÚA CHÙM** = Autonomous AI agents running 24/7 without human intervention
>
> Note: previously named `openclaw/`. Renamed 2026-05-03 to disambiguate
> from the public project at github.com/openclaw/openclaw (a personal AI
> assistant gateway, unrelated to Sophia's video-factory pipeline). The
> Sophia-internal orchestrator code at `src/lib/openclaw/` retains the
> codename for now (Phase 12 commit history).

## 🚀 Quick Start

This directory contains the OpenClaw configuration for the Sophia AI Video Factory's autonomous agents.

### File Structure

```
openclaw/
├── HEARTBEAT.md           # 24/7 operation checklist
├── openclaw.json          # Schedule & configuration
├── skills/
│   ├── affiliate-scout/
│   │   └── SKILL.md       # Scrapes affiliates every 4h
│   ├── content-producer/
│   │   └── SKILL.md       # Generates videos daily
│   └── auto-publisher/
│       └── SKILL.md       # Publishes to platforms
└── README.md              # This file
```

## 📋 OpenClaw Format

All skills use the official OpenClaw format:

### SKILL.md Structure

```markdown
---
name: skill-name
description: Brief description
version: 1.0.0
tier_requirement: PREMIUM
metadata:
  openclaw:
    schedule: every_4_hours
    retry_on_failure: true
    max_retries: 3
---

# Skill Title

Detailed documentation in Markdown format...
```

### HEARTBEAT.md

Checklist format for 24/7 monitoring:

```markdown
## Every 4 Hours
- [ ] Task 1
- [ ] Task 2

## Daily at 6:00 UTC
- [ ] Task 3
```

### openclaw.json

JSON configuration with heartbeat interval, skills array, and notification settings.

## 🎯 The 3 Autonomous Agents

### 1. Affiliate Scout (`skills/affiliate-scout/`)

**Schedule**: Every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
**Tier**: PREMIUM+

Scrapes Impact Radius, PartnerStack, and CJ Affiliate for high-EPC programs. Filters by:
- Categories: Fintech, Crypto, SaaS, Blockchain
- Min EPC: $5.00
- Min Commission: $50
- Cookie Duration: 30+ days

**Auto-Tier Assignment**:
```
EPC ≥ $10 AND Commission ≥ $100 → ENTERPRISE
EPC ≥ $5 AND Commission ≥ $50 → PREMIUM
Else → BASIC
```

### 2. Content Producer (`skills/content-producer/`)

**Schedule**: Daily at 6am UTC (1pm Vietnam)
**Tier**: PREMIUM+

Generates AI videos in 3 stages:

1. **Script Generation** (OpenRouter + Claude)
   - 60-90 second scripts
   - Hook scoring (0-100)
   - Affiliate product integration

2. **Voice Generation** (ElevenLabs)
   - Vietnamese female energetic voice
   - Natural pauses and emphasis

3. **Video Generation** (D-ID)
   - AI avatar presenter
   - Stock footage B-roll
   - Multi-format: YouTube, TikTok, Instagram

**Quality Gates**:
- Hook score ≥ 70
- Word count: 100-250
- Duration: 50-110 seconds

### 3. Auto Publisher (`skills/auto-publisher/`)

**Schedule**: Event-driven (triggers when video ready)
**Tier**: ENTERPRISE

Publishes to 3 platforms:

1. **YouTube** (landscape 1920x1080)
2. **TikTok** (portrait 1080x1920)
3. **Instagram Reels** (square 1080x1080)

Includes:
- AI-generated platform-optimized metadata
- Affiliate disclosure
- UTM tracking links
- 24-hour analytics collection

## 💰 Cost Breakdown

| Usage       | Videos/Day | Cost/Month |
|-------------|------------|------------|
| Light       | 3          | $175       |
| Moderate    | 5          | $292       |
| Heavy (max) | 10         | $585       |

**Note**: YouTube, TikTok, Instagram uploads are FREE.

## 🔧 Setup Instructions

### 1. Environment Variables

Create `.env.local` with these 16 API keys:

```bash
# Airtable
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# AI Services
OPENROUTER_API_KEY=sk-or-XXXXXXXXXXXX
ELEVENLABS_API_KEY=XXXXXXXXXXXXXXXX
DID_API_KEY=XXXXXXXXXXXXXXXX

# Social Platforms
YOUTUBE_CLIENT_ID=XXXXXXXX.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-XXXXXXXXXXXXXXXX
YOUTUBE_REFRESH_TOKEN=XXXXXXXXXXXXXXXX
TIKTOK_ACCESS_TOKEN=XXXXXXXXXXXXXXXX
INSTAGRAM_ACCESS_TOKEN=XXXXXXXXXXXXXXXX

# Storage
R2_ACCOUNT_ID=XXXXXXXXXXXXXXXX
R2_ACCESS_KEY_ID=XXXXXXXXXXXXXXXX
R2_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXX
R2_BUCKET_NAME=sophia-ai-videos

# Notifications
TELEGRAM_BOT_TOKEN=XXXXXXXXXX:XXXXXXXXXXXXXXXXXXXXXXXXXXX
TELEGRAM_ADMIN_CHAT_ID=XXXXXXXXXX
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/XXX/XXX
```

### 2. Airtable Schema

Create these 5 tables:

#### Affiliates
```
- Name (single line text)
- Category (single select)
- Commission (number)
- Commission Type (single select)
- EPC (number)
- Cookie Duration (number)
- Description (long text)
- Affiliate Link (URL)
- Tags (multi-select)
- Tier (single select)
- Source (single select)
- Last Scraped (date)
- Status (single select)
```

#### Scripts
```
- Script (long text)
- Topic (single line text)
- Affiliate (link to Affiliates)
- Status (single select)
- Voice URL (URL)
- Voice Duration (number)
- Hook Score (number)
- Word Count (number)
- Created At (date)
```

#### Videos
```
- Script (link to Scripts)
- YouTube Title/Description/Tags
- TikTok Caption/Hashtags
- Instagram Caption/Hashtags
- Video URLs (YouTube, TikTok, Instagram)
- Thumbnail URL
- Duration (number)
- Status (single select)
- Published (checkbox)
- Platform IDs
- Created At (date)
```

#### Analytics
```
- Video (link to Videos)
- Platform (single select)
- Views/Likes/Comments/Shares (numbers)
- Engagement Rate (number)
- Click Through Rate (number)
- Timestamp (date)
```

#### Activity
```
- Type (single select)
- Status (single select)
- Duration (number)
- Error Message (long text)
- Cost (number)
- Timestamp (date)
```

### 3. Deploy OpenClaw

```bash
# Deploy to Cloudflare Workers
wrangler publish openclaw/openclaw.json

# Or deploy to AWS Lambda
serverless deploy --config openclaw/openclaw.json
```

### 4. Import n8n Workflows

Import the 4 workflow JSON files created by the planner agent:
1. `workflows/script-generator.json`
2. `workflows/voice-generator.json`
3. `workflows/video-generator.json`
4. `workflows/publish-workflow.json`

### 5. Test Individual Skills

```bash
# Test Affiliate Scout
curl -X POST https://your-domain.com/api/openclaw/trigger \
  -H "Content-Type: application/json" \
  -d '{"skill": "affiliate-scout"}'

# Test Content Producer
curl -X POST https://your-domain.com/api/openclaw/trigger \
  -H "Content-Type: application/json" \
  -d '{"skill": "content-producer"}'

# Test Auto Publisher
curl -X POST https://your-domain.com/api/openclaw/trigger \
  -H "Content-Type: application/json" \
  -d '{"skill": "auto-publisher", "video_id": "recXXXXXXXXXX"}'
```

## 📊 Monitoring

### Dashboard

Access `/admin/heartbeat/analytics` to view:
- Overall system health
- Active/inactive skills
- Cost tracking (daily/monthly)
- Performance metrics
- Error logs

### Notifications

- **Telegram**: Real-time alerts
- **Slack**: #sophia-ai-alerts channel
- **Email**: Daily digest at 9am Vietnam time

### Health Checks (Every 5 Minutes)

- Airtable API (200 OK)
- OpenRouter API (200 OK)
- ElevenLabs API (200 OK)
- Cloudflare R2 (200 OK)
- YouTube API (quota remaining)

## 🚨 Error Handling

All skills use:
- **Max Retries**: 3
- **Backoff**: Exponential (60s → 120s → 240s)
- **Fallbacks**:
  - Voice: Switch to backup voice
  - Video: Switch from D-ID to Pictory
  - Publishing: Continue with successful platforms

## 🔒 Security

- **API Keys**: Environment variables only (AES-256 encrypted)
- **Rotation**: Every 90 days
- **Rate Limiting**: 100 requests/minute per IP
- **Access Control**: Admin-only endpoints require Basic Auth

## 📈 Performance Targets (30 Days)

| Metric                | Target   |
|-----------------------|----------|
| Affiliates Discovered | 500+     |
| Videos Generated      | 300+     |
| Videos Published      | 300+     |
| Total Views           | 10,000+  |
| Avg Engagement Rate   | 5%+      |
| Affiliate CTR         | 2%+      |
| Cost per Video        | < $0.60  |
| ROI                   | 200%+    |

## 🛠️ Troubleshooting

### Affiliate Scout Not Finding Programs
1. Check API credentials
2. Verify rate limits
3. Review quality filters (may be too strict)

### Content Producer Failing
1. Verify OpenRouter credits
2. Check ElevenLabs quota
3. Ensure D-ID API active
4. Review quality gates

### Auto Publisher Not Uploading
1. Verify OAuth tokens
2. Check API quotas
3. Review content policy violations

### High Costs
1. Check `/admin/heartbeat/analytics`
2. Verify auto-pause at budget limits
3. Enable response caching
4. Reduce video frequency

## 📚 Documentation

- **Setup Guide**: This file
- **Skill Details**: Each `SKILL.md` file
- **Heartbeat Checklist**: `HEARTBEAT.md`
- **Configuration**: `openclaw.json`
- **Implementation Report**: `../plans/reports/260204-2039-openclaw-format-fix.md`

## 🎯 What This Achieves

These autonomous agents will:
- ✅ Discover 500+ affiliate programs automatically
- ✅ Generate 300+ AI videos per month
- ✅ Publish to 3 platforms simultaneously
- ✅ Track analytics and ROI automatically
- ✅ Alert you only when human intervention needed

**Estimated ROI**: 200%+ based on affiliate commissions vs. operating costs.

---

**Version**: 1.0.0
**Last Updated**: 2026-02-04
**License**: Proprietary (Sophia AI Factory)
