---
name: auto-publisher
description: Multi-platform video uploader - publishes to YouTube, TikTok, Instagram when video is ready
version: 1.0.0
tier_requirement: ENTERPRISE
metadata:
  openclaw:
    trigger: event_driven
    event: video_ready
    polling_interval: 300
    resources:
      memory_limit: 1gb
      timeout: 1800
---

# Auto Publisher - Multi-Platform Video Uploader

Event-driven skill triggered when video status = "video_ready". Uploads to YouTube, TikTok, and Instagram. Tracks analytics and engagement.

## Trigger Configuration

- **Type**: Event-driven
- **Event**: video_ready
- **Source**: Airtable Videos table
- **Filter**: `status = "video_ready" AND published = false`
- **Polling**: Every 5 minutes

## Pipeline Stages

### Stage 1: Metadata Generation

**Service**: OpenRouter (Claude 3.7 Sonnet)

#### Prompt Template

```
Generate platform-optimized metadata for this video:

Script: {script}
Topic: {topic}
Affiliate: {affiliate_name}
Duration: {duration}s

Generate:

YOUTUBE:
- Title (60 chars max, SEO-optimized)
- Description (2000 chars, include timestamps, affiliate disclosure, hashtags)
- Tags (20 tags)

TIKTOK:
- Caption (150 chars, hook-first)
- Hashtags (5 trending + 5 niche)

INSTAGRAM:
- Caption (2200 chars, storytelling format)
- Hashtags (30 hashtags)

All platforms must include affiliate disclosure in Vietnamese.
```

#### Outputs

Update Airtable `Videos` table:
- youtube_title
- youtube_description
- youtube_tags
- tiktok_caption
- tiktok_hashtags
- instagram_caption
- instagram_hashtags

### Stage 2: YouTube Upload

**Service**: YouTube API v3
**Workflow**: `workflows/publish-workflow.json`
**Depends On**: Stage 1

#### Credentials

- OAuth2: true
- Client ID: `{env.YOUTUBE_CLIENT_ID}`
- Client Secret: `{env.YOUTUBE_CLIENT_SECRET}`
- Refresh Token: `{env.YOUTUBE_REFRESH_TOKEN}`

#### Upload Settings

**Video File**: From Cloudflare R2 `videos/{date}/{script_id}_youtube.mp4`

**Metadata**:
- Title: {youtube_title}
- Description: {youtube_description}
- Tags: {youtube_tags}
- Category ID: 22 (People & Blogs)
- Default Language: vi

**Privacy**:
- Status: public
- Publish At: 19:00 Asia/Ho_Chi_Minh (optional scheduling)

**Thumbnail**: From Cloudflare R2 `videos/{date}/{script_id}_thumbnail.jpg`

**Playlist**: Auto-add to "Affiliate Reviews"

#### Outputs

Update Airtable `Videos` table:
- youtube_id: {video_id}
- youtube_url: `https://youtube.com/watch?v={video_id}`
- youtube_published_at: {timestamp}
- youtube_status: "published"

### Stage 3: TikTok Upload

**Service**: TikTok API
**Depends On**: Stage 1

#### Credentials

- Access Token: `{env.TIKTOK_ACCESS_TOKEN}`

#### Upload Settings

**Video File**: From Cloudflare R2 `videos/{date}/{script_id}_tiktok.mp4`

**Metadata**:
- Title: {tiktok_caption}
- Hashtags: {tiktok_hashtags}
- Privacy Level: public_to_everyone
- Allow Duet: true
- Allow Stitch: true
- Allow Comment: true

**Settings**:
- Auto-add Music: false (we have voiceover)
- Disable Duet: false
- Disable Stitch: false

#### Outputs

Update Airtable `Videos` table:
- tiktok_id: {video_id}
- tiktok_url: `https://tiktok.com/@{username}/video/{video_id}`
- tiktok_published_at: {timestamp}
- tiktok_status: "published"

### Stage 4: Instagram Upload

**Service**: Instagram Graph API
**Depends On**: Stage 1

#### Credentials

- Access Token: `{env.INSTAGRAM_ACCESS_TOKEN}`

#### Upload Settings

**Video File**: From Cloudflare R2 `videos/{date}/{script_id}_instagram.mp4`

**Metadata**:
- Caption: {instagram_caption}
- Location: Ho Chi Minh City (optional)

**Post Type**: Reels (better reach)

**Settings**:
- Share to Feed: true

#### Outputs

Update Airtable `Videos` table:
- instagram_id: {media_id}
- instagram_url: `https://instagram.com/p/{shortcode}`
- instagram_published_at: {timestamp}
- instagram_status: "published"

### Stage 5: Analytics Setup

**Service**: Internal
**Depends On**: Stages 2, 3, 4

#### Actions

1. **Create Tracking Links**:
   - YouTube: `{youtube_url}?utm_source=sophia&utm_campaign={script_id}`
   - TikTok: `{tiktok_url}?utm_source=sophia&utm_campaign={script_id}`
   - Instagram: `{instagram_url}?utm_source=sophia&utm_campaign={script_id}`

2. **Setup Webhooks**:
   - YouTube analytics: true
   - TikTok analytics: true
   - Instagram insights: true

#### Outputs

Update Airtable `Videos` table:
- published: true
- tracking_setup: true
- analytics_last_sync: {timestamp}

## Post-Publish Actions

**Wait**: 24 hours
**Then**: Collect initial analytics

### Analytics Collection

**Service**: Analytics Aggregator

#### Metrics

**YouTube**:
- views
- likes
- comments
- shares
- watch_time_avg
- ctr (click-through rate)

**TikTok**:
- views
- likes
- comments
- shares
- avg_watch_time

**Instagram**:
- plays
- likes
- comments
- saves
- reach

#### Outputs

Save to Airtable `Analytics` table:
- video_id
- platform
- views
- engagement_rate: (likes + comments) / views
- timestamp

## Optimization Engine

**Frequency**: Weekly

### Analyze

- Top performing topics
- Best publishing times
- Optimal video length
- Most effective hooks
- Highest converting affiliates

### Apply Learnings

1. **Update Content Producer**:
   - Prioritize top-performing topics
   - Shift to peak posting hours

2. **Update Affiliate Scout**:
   - Focus on high-converting categories
   - Increase min EPC if poor performance

## Error Handling

### YouTube Upload Failure
- **Action**: Retry after delay
- **Delay**: 3600 seconds (1 hour)
- **Max Retries**: 3
- **Notify Admin**: true

### TikTok Upload Failure
- **Action**: Check content policy violation
- **If Violation**: Regenerate video, adjust script
- **Else**: Retry

### Instagram Upload Failure
- **Action**: Retry with fallback format
- **Fallback**: Square format (1080x1080)

### All Platforms Failure
- **Action**: Pause pipeline
- **Alert Admin**:
  - Urgency: high
  - Message: "Critical: All platform uploads failed for video {video_id}"

## Notifications

### Telegram

**Chat ID**: {admin_chat_id}
**On All Published**: true

**Message**:
```
🎉 Video Published to All Platforms!

📊 Analytics (24h update):

YouTube: {youtube_url}
├─ Views: {youtube_views}
└─ Engagement: {youtube_engagement_rate}%

TikTok: {tiktok_url}
├─ Views: {tiktok_views}
└─ Engagement: {tiktok_engagement_rate}%

Instagram: {instagram_url}
├─ Plays: {instagram_plays}
└─ Engagement: {instagram_engagement_rate}%

💰 Affiliate: {affiliate_name}
🔗 Tracking: /admin/analytics/{video_id}
```

### Email

**To**: admin@sophiaai.com
**On 24h Analytics**: true
**Subject**: "Video Performance Report: {topic}"
**Template**: email_templates/video_performance.html

## Compliance

### Affiliate Disclosure

- **Required**: true
- **Verify in Description**: true
- **Template**:
  ```
  ⚠️ Affiliate Disclosure: This video contains affiliate links.
  We earn commission if you purchase.
  ```

### Platform Policies

**YouTube**:
- No misleading thumbnails
- Proper category assignment
- Age restriction check

**TikTok**:
- No branded content without disclosure
- Follow community guidelines

**Instagram**:
- No deceptive practices
- Proper hashtag usage

## Performance Metrics

Track:
- total_views_across_platforms
- total_engagement_rate
- affiliate_click_through_rate
- revenue_per_video
- cost_per_acquisition
- roi_per_platform

**Dashboard**: `/admin/analytics/publisher`

## Best Posting Times

Data-driven from past performance:

- **YouTube**: 19:00 Asia/Ho_Chi_Minh (7pm)
- **TikTok**: 21:00 Asia/Ho_Chi_Minh (9pm)
- **Instagram**: 20:00 Asia/Ho_Chi_Minh (8pm)

## Storage & Cleanup

### Video Retention

- **Cloudflare R2**: 90 days
- **After Deletion**: Archive to Glacier (long-term backup)

### Metadata Retention

- **Airtable**: Indefinite (keep records forever)
- **Analytics**: 365 days (1 year of detailed data)

## Cost Tracking

- **YouTube API**: Free (10,000 units/day)
- **TikTok API**: Free (standard access)
- **Instagram API**: Free (basic tier)
- **Cloudflare R2**: $0.015/GB/month (storage only, no egress)

**Estimated Monthly Cost** (10 videos/day): ~$50 (mainly storage + CDN)
