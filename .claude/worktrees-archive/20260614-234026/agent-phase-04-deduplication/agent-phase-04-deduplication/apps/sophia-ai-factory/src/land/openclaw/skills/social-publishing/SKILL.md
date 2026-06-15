---
name: social-publishing
description: TikTok API, YouTube API, upload retry logic, schedule management for social video publishing.
triggers: publish, tiktok, youtube, upload, social, platform, schedule-post
tier: standard
---

# Social Publishing Skill

## When to activate
When publishing videos to TikTok or YouTube, scheduling posts, or managing upload retries.
Activate when task prompt contains: "publish", "tiktok", "youtube", "upload to", "social post".

## Supported Platforms

| Platform | MCP Server | Auth Method | Upload Limit |
|---|---|---|---|
| TikTok | tiktok | OAuth2 access_token | 500MB |
| YouTube | youtube | OAuth2 refresh_token | 256GB |

## Publishing Flow
1. Validate video_url exists in R2 / CDN
2. Check platform quota (rate limit gate)
3. Call MCP server upload method
4. Poll upload status (async) — max 5 min
5. Confirm platform_id returned
6. Emit video.published event with platform_id
7. Write audit row: action=video.published, resource=platform_id

## Retry Logic
- Upload failures: retry 3x with exponential backoff (5s, 15s, 45s)
- Auth failures: refresh token → retry 1x → fail with alert
- Rate limit (429): respect Retry-After header → queue for later
- Network timeout: retry 2x immediately → fail gracefully

## Key Constraints
- Always use MCP gateway (never call platform APIs directly from code)
- tenant_id injected into every MCP call
- Schedule posts in tenant's configured timezone
- Never publish same video_id twice to same platform (idempotency check)
- Store platform_id in video_jobs table after successful publish
