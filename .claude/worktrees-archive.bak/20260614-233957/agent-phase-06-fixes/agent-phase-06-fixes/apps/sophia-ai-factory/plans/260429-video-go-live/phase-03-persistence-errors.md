# Phase 03 — Reliable D1 Persistence + Error Surfacing

## Overview
Priority: P0. Currently `create-video/route.ts` swallows D1 errors silently. Status route updates DB but doesn't return persisted state.

## Files
- MODIFY: `src/app/api/heygen/create-video/route.ts`
- MODIFY: `src/app/api/heygen/status/[id]/route.ts`

## Steps
1. **create-video/route.ts:**
   - Wrap HeyGen + D1 INSERT in single try-catch returning structured error code (`HEYGEN_FAILED`, `DB_FAILED`, `MISSING_KEY`).
   - On D1 INSERT failure, return 500 with `{ error: "Video created but not persisted; refresh later" }` (don't fail silently).
   - Use Zod-validated body fields only.

2. **status/[id]/route.ts:**
   - Already updates D1 on terminal. Add: if HeyGen returns `error` field, set `status='failed'` and persist `error`.
   - Return `{status, video_url, thumbnail_url, error, duration_sec}` shape consistent with create response.

3. Add structured logger calls (no console.log) per code-standards.

## Success Criteria
- Build 0 errors
- D1 INSERT failure surfaces to client (not silent)
- HeyGen error message persisted to videos.error
- All responses Zod-typed
