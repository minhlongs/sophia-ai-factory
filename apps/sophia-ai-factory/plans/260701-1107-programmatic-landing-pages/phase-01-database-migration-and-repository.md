---
title: "Phase 01 — Database Migration & Repository"
status: pending
priority: P1
effort: 3h
blocks: [02, 04]
---

# Phase 01 — Database Migration & Repository

## Context Links
- Plan overview: `./plan.md`
- Existing migration pattern: `migrations/0208_refund_events_and_ledger.sql`
- Existing repo pattern: `src/seed/db/repositories/videos-repo.ts`
- D1 client access: `src/seed/db/client.ts` (use `getD1()`, sync, no await)

## Overview
Create the D1 `landing_pages` table, seed 15 default niches with bilingual content, and build the repository layer for CRUD operations. This is the data foundation for all other phases.

## Key Insights
- Highest existing migration is 0208; this migration will be **0209**
- Migration pattern: DDL-only, `CREATE TABLE IF NOT EXISTS`, separate `CREATE INDEX IF NOT EXISTS`
- Repo pattern: import `getD1` from `@/seed/db/client`, async functions, `.prepare().bind().first/all/run()`
- D1 uses positional params (`?1`, `?2`, etc.)
- `features_json` and `faq_json` are TEXT columns storing JSON arrays -- parse in repo layer, store as string
- Seed data inserted via `INSERT OR IGNORE` for idempotency

## Requirements
### Functional
- `landing_pages` table with all specified columns
- Index on `is_published` for fast filtered queries
- CRUD operations: `getBySlug`, `listAll`, `listPublished`, `create`, `update`, `delete`
- Seed 15 niches with starter bilingual content

### Non-Functional
- Migration must be idempotent (safe to re-run)
- Repository must follow existing `getD1()` pattern
- Zero `:any` types in repo
- Logger used for error paths

## Architecture

### Data Flow
```
D1 landing_pages table
  -> landing-pages-repo.ts (CRUD functions)
    -> Phase 03: SSG page reads via getBySlug()
    -> Phase 04: Admin reads/writes via listAll/create/update/delete
    -> Phase 02: LLM fallback checks getBySlug() before generating
```

### Schema
```sql
CREATE TABLE IF NOT EXISTS landing_pages (
  id TEXT PRIMARY KEY,           -- slug: "real-estate"
  niche_label TEXT NOT NULL,     -- "Real Estate" / "Bất Động Sản"
  hero_title_en TEXT,            -- English hero headline
  hero_title_vi TEXT,            -- Vietnamese hero headline
  hero_sub_en TEXT,              -- English hero subtitle
  hero_sub_vi TEXT,              -- Vietnamese hero subtitle
  features_json TEXT,            -- JSON array: [{"icon":"...", "title_en":"...", "title_vi":"...", "desc_en":"...", "desc_vi":"..."}]
  faq_json TEXT,                 -- JSON array: [{"question_en":"...", "question_vi":"...", "answer_en":"...", "answer_vi":"..."}]
  meta_title_en TEXT,            -- SEO title EN
  meta_title_vi TEXT,            -- SEO title VI
  meta_desc_en TEXT,             -- SEO description EN
  meta_desc_vi TEXT,             -- SEO description VI
  is_published INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_published ON landing_pages(is_published);
```

### Seeded Niches (15)
| Slug | niche_label |
|------|-------------|
| real-estate | Real Estate / Bất Động Sản |
| e-commerce | E-Commerce / Thương Mại Điện Tử |
| crypto | Crypto / Tiền Mã Hóa |
| health | Health / Sức Khỏe |
| education | Education / Giáo Dục |
| restaurant | Restaurant / Nhà Hàng |
| fitness | Fitness / Thể Hình |
| lawyer | Lawyer / Luật Sư |
| insurance | Insurance / Bảo Hiểm |
| travel | Travel / Du Lịch |
| automotive | Automotive / Ô Tô |
| fashion | Fashion / Thời Trang |
| gaming | Gaming / Trò Chơi |
| music | Music / Âm Nhạc |
| photography | Photography / Nhiếp Ảnh |

## Related Code Files

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `migrations/0209_landing_pages.sql` | Table DDL + seed data INSERTs |
| CREATE | `src/seed/db/repositories/landing-pages-repo.ts` | CRUD functions |

## Implementation Steps

### Step 1: Write migration file
1. Create `migrations/0209_landing_pages.sql`
2. Add `CREATE TABLE IF NOT EXISTS landing_pages (...)` with all columns
3. Add `CREATE INDEX IF NOT EXISTS idx_landing_pages_published ON landing_pages(is_published)`
4. Add `INSERT OR IGNORE INTO landing_pages (...)` for all 15 niches with bilingual content
   - Each INSERT includes: id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json (3-5 features), faq_json (3-4 FAQs), meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published=1
   - Use proper SQL string escaping for JSON (double single-quotes inside JSON strings)

### Step 2: Write landing-pages-repo.ts
1. Create `src/seed/db/repositories/landing-pages-repo.ts`
2. Import `getD1` from `@/seed/db/client` and `logger` from `@/seed/utils/logger-utility`
3. Define `LandingPageRow` interface matching table schema (all TEXT or INTEGER)
4. Define `LandingPage` interface with parsed JSON (features as `Feature[]`, faq as `FaqItem[]`)
5. Implement functions:
   - `getBySlug(slug: string): Promise<LandingPage | null>` — SELECT by id
   - `listAll(): Promise<LandingPage[]>` — SELECT all, order by created_at DESC
   - `listPublished(): Promise<LandingPage[]>` — SELECT where is_published=1
   - `create(data: CreateLandingPageInput): Promise<LandingPage>` — INSERT with JSON.stringify for arrays
   - `update(slug: string, data: UpdateLandingPageInput): Promise<LandingPage | null>` — UPDATE with COALESCE for partial updates
   - `delete(slug: string): Promise<boolean>` — DELETE by id
   - `getAllSlugs(): Promise<string[]>` — SELECT id only, for generateStaticParams
6. Helper: `parseLandingPage(row: LandingPageRow): LandingPage` to JSON.parse features_json and faq_json
7. Helper: `serializeLandingPage(page: LandingPage): LandingPageRow` to JSON.stringify
8. Error handling: try/catch with logger.error, re-throw for callers

### Step 3: Verify migration applies cleanly
1. Check migration file syntax with SQLite (no syntax errors)
2. Verify migration number 0209 is not already taken

## Todo List
- [ ] Create `migrations/0209_landing_pages.sql` with table + 15 seed inserts
- [ ] Create `src/seed/db/repositories/landing-pages-repo.ts` with full CRUD
- [ ] Export repo functions with proper TypeScript types
- [ ] Verify migration number 0209 is available and next in sequence

## Success Criteria
- Migration file exists with idempotent DDL and 15 seeded rows
- Repo file exports all CRUD functions with zero `:any` types
- Repo follows `getD1()` pattern from existing repos
- `getAllSlugs()` returns list of all niche IDs for SSG build

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration 0209 already exists | Low | Medium | Check migrations/ before writing; use next available number |
| JSON escaping errors in seed data | Medium | Low | Use simple features/FAQs initially; validate JSON.parse roundtrip |
| D1 positional param mismatch | Low | Medium | Follow exact pattern from videos-repo.ts |

## Security Considerations
- No PII stored — all content is public-facing marketing copy
- Admin-only writes enforced at Phase 04 via `requireMasterTier()`
- Repo does not enforce auth (auth gates at page/API layer per architecture)

## Next Steps
- Phase 02 depends on this repo (types mirror the schema, LLM fallback queries D1)
- Phase 04 depends on this repo (admin CRUD pages call these functions)
