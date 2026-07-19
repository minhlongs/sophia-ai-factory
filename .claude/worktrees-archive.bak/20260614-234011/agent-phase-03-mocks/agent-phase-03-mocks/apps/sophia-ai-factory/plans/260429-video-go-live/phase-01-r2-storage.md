# Phase 01 — R2-Backed Video Storage

## Overview
Priority: P0. Replace broken Supabase `db.storage` calls with Cloudflare R2 binding.

## Files
- MODIFY: `src/lib/video/video-storage-service.ts` (currently 96 lines, broken)
- ADD: `src/lib/video/r2-binding.ts` (small helper to access R2 binding from `getCloudflareContext()`)
- MODIFY: `wrangler.toml` (add `[[r2_buckets]] binding = "VIDEO_BUCKET" bucket_name = "sophia-videos"`)
- ADD: `migrations/0030-videos-r2-key.sql` (add `r2_key TEXT`, `r2_size_bytes INTEGER` columns to `videos`)

## Steps
1. Create R2 helper that uses `@opennextjs/cloudflare`'s `getCloudflareContext()` to access `env.VIDEO_BUCKET`.
2. Refactor `downloadAndStore`: fetch HeyGen URL → stream blob → `bucket.put(key, body, { httpMetadata: { contentType: 'video/mp4' } })` → return public URL via `https://<custom-r2-domain>/<key>` OR worker route serving the object.
3. Add `r2_key` column to `videos` migration; helper writes it on success.
4. Public URL strategy: simplest — use Cloudflare R2 public bucket URL OR a `/videos/[r2_key]` worker route. KISS: assume custom domain `https://videos.sophia.agencyos.network/<key>` env var `R2_PUBLIC_BASE_URL`. Fallback to HeyGen URL if env missing.
5. Maintain backward-compatible interface (`VideoStorageResult`).

## Success Criteria
- `npm run build` passes 0 errors
- `downloadAndStore()` writes to R2 when binding present
- Falls back gracefully if R2 binding missing
- Migration runs idempotently
