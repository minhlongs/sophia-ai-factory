---
title: "Programmatic SEO Landing Pages — AI Video for [Niche]"
description: "Auto-generated bilingual landing pages capturing long-tail SEO traffic for non-technical CEOs, with D1-backed admin CRUD and LLM fallback generation."
status: pending
priority: P2
effort: 16h
branch: main
tags: [seo, landing-pages, ssg, d1, kv, openrouter, admin, bilingual]
created: 2026-07-01
---

# Programmatic SEO Landing Pages

## Overview

Build auto-generated "AI Video for [niche]" landing pages to capture long-tail SEO traffic. Hybrid content strategy: primary content from D1 `landing_pages` table (admin-curated, bilingual), with OpenRouter LLM fallback for unknown niches (KV-cached for 7 days).

## Phases

| # | Phase | Status | Effort | Blocks |
|---|-------|--------|--------|--------|
| 01 | Database Migration & Repository | pending | 3h | -- |
| 02 | Types, Config & LLM Fallback Generator | pending | 4h | 01 |
| 03 | SSG Landing Page Route & SEO Metadata | pending | 5h | 02 |
| 04 | Admin CRUD Dashboard | pending | 4h | 01, 02 |

## Key Dependencies

- Phase 02 depends on Phase 01 (repo needed for LLM fallback to query D1)
- Phase 03 depends on Phase 02 (types + LLM fallback needed)
- Phase 04 depends on Phase 01 + 02 (repo + types needed for admin forms)
- Phase 03 and 04 can run partially parallel if 01 + 02 complete first

## Architecture (4-Layer Placement)

| Layer | Files | Reason |
|-------|-------|--------|
| **seed** | `landing-pages-repo.ts`, `niche-list.ts`, `landing-page-types.ts` | Foundational: DB access, config, types |
| **tree** | `llm-fallback-generator.ts` | Domain logic: LLM content generation + KV cache |
| **app** | `[locale]/ai-video/[niche]/page.tsx` | Presentation: SSG page |
| **app** | `dashboard/admin/landing-pages/` | Admin UI |

No `forest` or `land` layer placement needed -- landing page content is purely read-path (no orchestration or business workflow).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `generateStaticParams` is novel pattern for codebase | Medium | High | Validate at build; fallback to ISR if SSG breaks |
| LLM fallback cost (OpenRouter BYOK) | Medium | Medium | KV cache with 7-day TTL; rate limit in generator |
| D1 migration conflicts (0209 already taken) | Low | Low | Check migrations/ before writing migration number |
| Admin CRUD complexity (no reusable form components) | Medium | Medium | Follow existing pricing/refunds pattern: inline table + fetch |

## Success Criteria

1. Each niche slug renders unique bilingual SEO content at `/[locale]/ai-video/[niche]`
2. Pages are SSG via `generateStaticParams` at build time (no client fetch for primary content)
3. Admin can create/edit/delete/publish niche pages at `/dashboard/admin/landing-pages`
4. Unknown niche slugs trigger LLM fallback -> KV cache -> serve
5. SEO metadata (title, description) per niche, with og:image and schema.org Article
6. Bilingual VI+EN for all customer-facing content
7. Build generates all published + seeded niche pages
8. Zero regressions on existing routes (Setup Wizard, Telegram Bot, Payment Flow)
9. Zero TypeScript errors, all tests pass, zero `:any` types

## Files Touched (Summary)

| Action | Count | Key Files |
|--------|-------|-----------|
| CREATE | 8 | migration, repo, types, niche-list, LLM generator, SSG page, 2 admin pages |
| MODIFY | 0 | No existing files modified (greenfield feature) |

## Detailed Phase Files

- [Phase 01 — Database Migration & Repository](./phase-01-database-migration-and-repository.md)
- [Phase 02 — Types, Config & LLM Fallback Generator](./phase-02-types-config-and-llm-fallback-generator.md)
- [Phase 03 — SSG Landing Page Route & SEO Metadata](./phase-03-ssg-landing-page-and-seo-metadata.md)
- [Phase 04 — Admin CRUD Dashboard](./phase-04-admin-crud-dashboard.md)
