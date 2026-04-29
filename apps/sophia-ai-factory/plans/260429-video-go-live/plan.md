# Video Go-Live — Full Auto Pipeline

**Goal:** End-to-end automated video creation flow chạy được trên production (sophia.agencyos.network).

**Current state:** Code wired (UI wizard → /api/heygen/create-video → HeyGen → D1 videos). Production GREEN @ 3b6c3b90. Gaps làm flow không reliable.

## Phases

| # | Phase | Status | Owner |
|---|---|---|---|
| 01 | R2-backed video storage (replace broken Supabase) | pending | fullstack-developer |
| 02 | Server-side video status sync cron (5min) | pending | fullstack-developer |
| 03 | Reliable D1 persistence + error surfacing | pending | fullstack-developer |
| 04 | Wire wrangler.toml cron + migration | pending | main |
| 05 | Build + test + deploy + verify GREEN | pending | tester+main |

## Dependencies

- HEYGEN_API_KEY, OPENROUTER_API_KEY (Cloudflare secrets — user provisions)
- R2 bucket `sophia-videos` (created via wrangler)
- D1 `videos` table (existing migration 0024)

## Out of scope

- HeyGen webhook receiver (P1, defer)
- Pagination (P2)
- Mock service fixes (P2)
