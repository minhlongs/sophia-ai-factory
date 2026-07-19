# Multi-Channel Video Publishing Research
**Date:** 2026-05-24 | **For:** Sophia AI Factory | **Scope:** YouTube, TikTok, Instagram Reels

---

## 1. YouTube Data API v3

**Upload Flow:** Resumable protocol (5+ MB mandatory). POST with metadata + Content-Length → 308/201 responses → chunked PUT requests. **OAuth Scope:** `youtube.upload` (minimal, preferred for review). **Rate Limits:** Per-user quota; typical production: 10K insert quota per 24h (negotiable). **Key Consideration:** Stored metadata includes title, description, visibility (public/private/unlisted), tags; requires user account verification.

**Integration:** Node.js libraries exist (googleapis, ytdl-core); JWT/OAuth2 token refresh must track token expiration.

---

## 2. TikTok Content Posting API

**Upload Flow:** POST video + metadata → receive `publish_id` → poll status (async). Two modes: (a) Direct Post (immediate publish, 6 req/min), (b) Creator Post (inbox review). **Access:** Manual app review (2-6 weeks), business account required, personal accounts ineligible. **Rate Limits:** 6 req/min per user, 25 posts/day limit per account (varies). **Video Specs:** MP4/MOV/WEBM/AVI, 3–600s, max 4GB, 9:16 aspect ratio preferred.

**Integration:** No official Node.js SDK; REST only. Polling delay: 1min typical, up to hours for moderation. Status endpoint: GET `/video/status?publish_id=`.

---

## 3. Instagram Reels API (Graph API)

**Upload Flow:** (a) URL-based: POST `/media?media_type=REELS&video_url=<public_url>`, OR (b) Resumable: POST with `upload_type=resumable` → upload binary to `rupload.facebook.com` → poll container status → publish. **Max Duration:** 90s (API limit, app native supports 3min+). **Rate Limits:** 100 posts per rolling 24h per account. **Key Gotcha:** Returns 200 OK on creation; silently fails at publish step (no webhook).

**Integration:** Meta official SDK (`facebook-sdk`) handles graph.facebook.com; rupload uses separate host.

---

## 4. Common Abstraction Layer (Proposed)

```
VideoPublisherInterface:
  - uploadVideo(platformKey: string, video: Stream, metadata: VideoMetadata): Promise<PublishJob>
  - checkStatus(publishJob: PublishJob): Promise<Status>
  - list(): Promise<Platform[]>

PlatformAdapter (implemented per platform):
  - YouTube: resumable upload + metadata POST
  - TikTok: multipart + async polling
  - Instagram: rupload binary + container model

CredentialStore (BYOK):
  - encrypt/decrypt OAuth tokens per user
  - refresh token lifecycle management
  - platform-specific token scopes validation
```

**Architecture:** Adapter pattern + event-driven (Inngest job per platform). Parallel uploading: spawn 3 Inngest tasks (one per platform) in same workflow run.

---

## 5. Scheduling & Optimal Times

No official API scheduling on YouTube, TikTok, or Instagram (via API). Recommendation: implement application-level scheduler. YouTube prefers 6-9 AM user timezone; TikTok: 6-10 AM; Instagram: 11 AM–1 PM. Schedule as Inngest delayed step post-upload confirmation.

---

## 6. Status Tracking (Unified Webhook Pattern)

| Platform | Method | Completion Signal |
|----------|--------|-------------------|
| **YouTube** | Polling `videos.list(id=uploadId)` | `status.uploadStatus == "processed"` |
| **TikTok** | Polling `GET /video/status?publish_id=X` | `data.status == "published"` or `"failed"` |
| **Instagram** | Polling container + publish endpoint | Container `status == "FINISHED"` |

**Recommendation:** Inngest poll loop (30s intervals, 10min timeout). Store publish_id + platform in Supabase `video_publishes` table. Webhook **inbound from platforms:** only TikTok supports webhooks (`/content-posting/webhook`); YouTube/Instagram require polling.

---

## 7. BYOK Authentication (Critical)

**Token Storage Pattern:**
1. User connects OAuth per platform (in dashboard)
2. Platform returns `access_token` + `refresh_token`
3. Encrypt tokens in `user_credentials` table (key: `user_id + platform`)
4. Store refresh_token expiry; auto-rotate on expiry
5. Never pass user creds to Inngest; only store `credential_id`

**Scopes Required:**
- YouTube: `youtube.upload` (minimal)
- TikTok: `video.upload` + `video.list`
- Instagram: `instagram_basic,instagram_content_publishing` (Meta app)

**Credential Rotation:** Implement refresh token lifecycle. TikTok tokens valid 30 days; YouTube: 1 hour access + refresh. Instagram: 60 days, then re-auth required.

---

## 8. Adoption Risk & Trade-offs

| Dimension | Assessment | Mitigation |
|-----------|-----------|-----------|
| **TikTok API Access** | Manual review barrier (2-6 weeks) | Start review immediately; have fallback (user manual post) |
| **Instagram Silent Fail** | No webhook on publish failure; polling required | 10-min polling max before user alert |
| **Rate Limits** | TikTok 25/day shared across all API clients | Warn user on dashboard; queue overflow posts for next day |
| **Token Refresh** | Multi-platform lifecycle = complexity | Centralized refresh service (1 Inngest cron per user) |
| **Resumable Upload Gaps** | YouTube/Instagram mid-stream failures | Retry with byte-offset tracking in Supabase |

---

## Recommendation

**Implement in phases:**
1. **Phase 1:** YouTube only (highest API maturity, lower barrier)
2. **Phase 2:** Instagram (straightforward Graph API, high user base)
3. **Phase 3:** TikTok (complex gating, but included in product promise)

**Architecture Stack:**
- Adapter pattern + Inngest parallel job spawn
- Supabase `video_publishes` + `user_credentials` tables
- Centralized refresh token service (daily cron)
- 30-second polling loop for TikTok (11min timeout); conditional polling for YouTube/Instagram

**Unresolved Questions:**
- Should scheduling be platform-aware (different optimal times), or uniform?
- Fallback UX if TikTok API access denied during product beta?
- Cost: will Sophia offer multi-platform as premium tier or all-in?

---

**Sources:**
- [YouTube Data API v3 Upload Guide](https://developers.google.com/youtube/v3/guides/uploading_a_video)
- [YouTube Resumable Uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)
- [TikTok Content Posting API Reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)
- [TikTok Rate Limits](https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit)
- [Instagram Reels API Guide](https://www.getphyllo.com/post/a-complete-guide-to-the-instagram-reels-api)
- [Meta Graph API Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [TikTok Status Polling](https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status)
- [BYOK for SaaS](https://www.augmentcode.com/guides/byok-enterprise-agent-rollouts)
- [Multi-Tenant Node.js Architecture](https://oneuptime.com/blog/post/2026-01-25-multi-tenant-apis-nodejs/view)
