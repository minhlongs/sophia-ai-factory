---
title: "Phase 02 — AI Content Pipeline"
description: "Auto-generate blog posts, HeyGen video reviews, and social copy for top-scored affiliate programs"
status: pending
priority: P1
effort: 5h
---

# Phase 02 — AI Content Pipeline

**Goal:** For each program with `score >= 60`, auto-generate monetized content (blog + video + social) that users can publish with one click.

## Context Links

- HeyGen client: `lib/video/heygen-client.ts`
- MCU pricing: `lib/billing/mcu-pricing.ts`
- Video templates: `lib/video/video-templates.ts`
- AI client: `lib/ai/client.ts`
- Phase 01 output: `affiliate_programs` table (programs with score >= 60)

## Key Insights

- Reuse `lib/video/heygen-client.ts` — do NOT duplicate HeyGen API calls
- Reuse `lib/ai/client.ts` for blog + social generation — same Anthropic/OpenAI wrapper
- Blog template: hook → problem → solution (affiliate tool) → CTA with tracked link
- Video script = condensed blog (30–60s): problem (10s) + demo callout (20s) + CTA (10s)
- Social post = headline + 2 bullet benefits + affiliate link (LinkedIn/Twitter/TikTok variants)
- MCU deducted per content piece atomically — if HeyGen fails, refund MCU

## Architecture

```
POST /api/affiliate/content/generate
  ├─ Check MCU balance
  ├─ Deduct MCU (pre-deduct, refund on failure)
  ├─ content_type == 'blog'   → blog-generator.ts   (50 MCU)
  ├─ content_type == 'video'  → video-generator.ts  (200 MCU)
  └─ content_type == 'social' → social-generator.ts (10 MCU)
       └─ Insert into affiliate_content (status: 'generating' → 'draft')
       └─ Return content_id for polling
```

## Related Code Files

**Create:**
- `lib/affiliate/content/blog-generator.ts`
- `lib/affiliate/content/video-generator.ts`
- `lib/affiliate/content/social-generator.ts`
- `app/api/affiliate/content/generate/route.ts`
- `app/api/affiliate/content/route.ts`
- `app/api/affiliate/clicks/track/route.ts`

**Modify:**
- `lib/billing/mcu-pricing.ts` — add affiliate content MCU costs

## Implementation Steps

1. **Update `mcu-pricing.ts`** — add entries:
   ```ts
   'affiliate:blog': 50,
   'affiliate:video': 200,
   'affiliate:social': 10,
   ```

2. **Implement `blog-generator.ts`**
   - `generateBlogPost(program: AffiliateProgram, orgId: string): Promise<string>`
   - Prompt: SEO review post, 600–800 words, include affiliate link with UTM params
   - UTM: `?utm_source=sophia&utm_medium=blog&utm_campaign={org_id}`
   - Uses `lib/ai/client.ts` — no new AI client

3. **Implement `video-generator.ts`**
   - `generateVideoReview(program: AffiliateProgram, orgId: string): Promise<string>`
   - Step 1: generate script via AI (30–60s, 3-act structure)
   - Step 2: call `heygen-client.ts` with script → returns `heygen_video_id`
   - Store `heygen_video_id` in `affiliate_content`
   - Poll HeyGen status via existing client pattern

4. **Implement `social-generator.ts`**
   - `generateSocialBundle(program: AffiliateProgram): Promise<SocialBundle>`
   - Returns `{ linkedin: string, twitter: string, tiktok_script: string }`
   - Each variant respects platform character limits (LinkedIn 3000, Twitter 280)

5. **API route `POST /api/affiliate/content/generate`**
   - Body: `{ program_id, content_type: 'blog'|'video'|'social' }`
   - Pre-deduct MCU → generate → insert `affiliate_content` row → return `content_id`
   - On failure: refund MCU, set `status: 'failed'`

6. **API route `GET /api/affiliate/content`**
   - Returns org's content list with status, program name, publish_url
   - Filter: `?status=draft&content_type=video`

7. **Click tracking route `POST /api/affiliate/clicks/track`**
   - Public endpoint (no auth) using service role insert
   - Body: `{ content_id, program_id, org_id, utm_source, referrer }`
   - Hash IP before storing: `crypto.createHash('sha256').update(ip).digest('hex')`

## TODO Checklist

- [ ] Add affiliate MCU costs to `mcu-pricing.ts`
- [ ] Implement `blog-generator.ts` with UTM-tagged affiliate links
- [ ] Implement `video-generator.ts` using existing `heygen-client.ts`
- [ ] Implement `social-generator.ts` with LinkedIn/Twitter/TikTok variants
- [ ] Build `POST /api/affiliate/content/generate` with pre-deduct + refund logic
- [ ] Build `GET /api/affiliate/content` with org-scoped filtering
- [ ] Build `POST /api/affiliate/clicks/track` with IP hashing
- [ ] Test: blog generates < 5s, video job queued < 2s, social bundle < 3s

## Success Criteria

- Blog post: 600–800 words, contains UTM-tagged affiliate link, SEO title
- Video: HeyGen job queued within 2s, `heygen_video_id` stored in DB
- Social bundle: all 3 variants generated, within character limits
- MCU deducted correctly; refunded on generation failure
- Click tracking stores hashed IP (no PII)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| HeyGen API timeout (slow video) | Async job pattern — return `content_id`, poll status |
| AI hallucination of affiliate terms | Include program data in prompt context, add disclaimer footer |
| MCU double-deduct on retry | Idempotency key on content insert (`program_id + org_id + content_type + date`) |

## Security Considerations

- Click tracking: IP hashed (SHA-256), never store raw IP
- UTM `org_id` in link = revenue attribution, must validate org exists before content gen
- Blog content stored in Supabase, served via signed URL if private draft

## Next Steps

- Phase 03: publish content to user's blog/YouTube/social accounts
- Phase 04: `affiliate_revenue` tracking + 5% platform fee calculation + dashboard
