# Phase 3: Convert Visitors → Paying Customers

**Status**: Complete
**Created**: 2026-03-25
**Branch**: claude/setup-sophia-proposal-app-fo7IH

## Context
Phase 2 shipped: AI engine wired, model routing, Resend email, magic link auth, dashboard forms. Landing page demo is STATIC. No /pilot. No /blog.

## File Ownership (No Conflicts)

| Track | Owns |
|-------|------|
| 1 | `app/api/v1/demo/route.ts` (NEW), `components/landing/demo-section.tsx`, `components/landing/exit-intent-popup.tsx` (NEW), `components/landing/sticky-mobile-cta.tsx` (NEW), `components/landing/index.ts` |
| 2 | `app/pilot/page.tsx` (NEW), `app/blog/page.tsx` (NEW), `app/blog/[slug]/page.tsx` (NEW), `lib/blog/queries.ts` (NEW), `migrations/0008-blog-posts.sql` (NEW) |
| 3 | `app/docs/api/page.tsx`, `packages/raas-sdk/README.md`, `public/sophia-postman-collection.json` (NEW) |

## Phases

### Track 1: Live Demo + Conversion — `complete`
- [x] Create `/api/v1/demo` endpoint (Haiku, rate limited, no auth)
- [x] Upgrade demo-section.tsx to call real API
- [x] Exit-intent popup component
- [x] Sticky mobile CTA

### Track 2: Pilot + Blog — `complete`
- [x] Pilot landing page with application form
- [x] Blog infrastructure (D1 + SSR)
- [x] D1 migration 0008-blog-posts.sql
- [x] 3 seed blog posts

### Track 3: API Docs + SDK — `complete`
- [x] Enhance API docs page with quickstart + command reference
- [x] Update SDK README with all 17 commands
- [x] Postman collection JSON
