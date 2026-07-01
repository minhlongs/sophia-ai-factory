---
title: "Phase 02 — Types, Config & LLM Fallback Generator"
status: pending
priority: P1
effort: 4h
blockedBy: [01]
blocks: [03]
---

# Phase 02 — Types, Config & LLM Fallback Generator

## Context Links
- Plan overview: `./plan.md`
- Phase 01 (repo): `./phase-01-database-migration-and-repository.md`
- Existing type pattern: `src/seed/types/index.ts` (barrel re-exports)
- Existing config pattern: `src/seed/config/` with barrel `index.ts`
- Existing KV pattern: `src/seed/kv/quota-cache-ops.ts` (globalThis.KV_KV)
- OpenRouter client: `src/seed/inference/openrouter-client.ts` (resilientChatCompletion)
- Logger: `@/seed/utils/logger-utility`

## Overview
Define TypeScript types for landing pages, create the niche list config (15 seeded slugs for generateStaticParams), and build the LLM fallback generator that creates bilingual content for unknown niches and caches it in KV for 7 days.

## Key Insights
- Types belong in `src/seed/types/` following the existing pattern (barrel re-export from `index.ts`)
- Config belongs in `src/seed/config/` with barrel re-export from `index.ts`
- LLM generator belongs in `src/tree/landing/` — it's domain logic (calls `seed` layer repo, no `forest`/`land` deps)
- KV binding accessed via `globalThis.KV_KV` with null guard (same as quota-cache-ops.ts)
- OpenRouter call uses `resilientChatCompletion` from `@/seed/inference/openrouter-client` for reliability (circuit breaker, retry)
- Fallback model: `openai/gpt-4o-mini` (default, same as existing OpenRouter client)
- Cache key format: `landing:niche:{slug}:{locale}` with 7-day TTL
- KV `put()` accepts `expirationTtl` (seconds) for auto-expiry — no manual cleanup needed
- Must handle BYOK: OpenRouter API key comes from user's setup wizard config, not a server-side secret
- The LLM prompt must be strict: return JSON matching the landing page schema, no markdown wrapping

## Requirements
### Functional
- `LandingPage` type with all fields from the D1 schema (parsed JSON, not TEXT)
- `CreateLandingPageInput` and `UpdateLandingPageInput` types for repo/API use
- `NICHE_SLUGS` constant array with 15 seeded slug strings
- `generateLandingPageContent(nicheSlug: string)` function that:
  1. Checks D1 via `getBySlug()` — returns early if found
  2. Checks KV cache — returns cached if exists and not expired
  3. Calls OpenRouter LLM with structured prompt for bilingual content
  4. Parses LLM JSON response
  5. Stores in KV with 7-day TTL
  6. Returns `LandingPage` content

### Non-Functional
- Zero `:any` types — all LLM responses validated with Zod
- Cache miss logged at info level; LLM errors logged at error level
- LLM call has timeout (15s) to prevent hanging
- Zod schema validates LLM JSON response shape before caching
- TypeScript barrel export from `src/seed/types/index.ts`

## Architecture

### Data Flow
```
Request for unknown niche slug
  -> generateLandingPageContent(slug)
    -> getBySlug(slug) from D1 → return if found (admin-curated)
    -> KV.get(`landing:niche:${slug}:en`) → return if cache hit
    -> OpenRouter resilientChatCompletion(structured prompt)
    -> Zod parse LLM response
    -> KV.put(`landing:niche:${slug}:en`, content, { expirationTtl: 604800 })
    -> KV.put(`landing:niche:${slug}:vi`, contentVi, { expirationTtl: 604800 })
    -> Return LandingPage
```

### File Placement (4-Layer)
| Layer | File | Reason |
|-------|------|--------|
| seed/types | `landing-page-types.ts` | Foundational types — importable by all layers |
| seed/config | `niche-list.ts` | Static config — constant list of niche slugs |
| tree/landing | `llm-fallback-generator.ts` | Domain logic — calls seed repo + seed KV |
| seed/kv | `landing-cache-ops.ts` | KV read/write operations for landing page cache |

### Zod Validation Schema
```typescript
const FeatureSchema = z.object({
  icon: z.string(),
  title_en: z.string(),
  title_vi: z.string(),
  desc_en: z.string(),
  desc_vi: z.string(),
});

const FaqItemSchema = z.object({
  question_en: z.string(),
  question_vi: z.string(),
  answer_en: z.string(),
  answer_vi: z.string(),
});

const GeneratedLandingContentSchema = z.object({
  hero_title_en: z.string(),
  hero_title_vi: z.string(),
  hero_sub_en: z.string(),
  hero_sub_vi: z.string(),
  features: z.array(FeatureSchema).min(3).max(6),
  faq: z.array(FaqItemSchema).min(3).max(5),
  meta_title_en: z.string(),
  meta_title_vi: z.string(),
  meta_desc_en: z.string(),
  meta_desc_vi: z.string(),
});
```

### LLM Prompt Strategy
- System prompt: "You are a bilingual (Vietnamese + English) content writer for an AI video generation SaaS. Generate marketing landing page content for a specific business niche."
- User prompt: template with niche slug, instruct to return ONLY valid JSON (no markdown fences)
- Response format: JSON matching `GeneratedLandingContentSchema`
- Model: `openai/gpt-4o-mini` (fast, cheap, sufficient for content gen)
- Temperature: 0.7 (creative but structured)

## Related Code Files

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/seed/types/landing-page-types.ts` | All landing page TypeScript types + Zod schemas |
| MODIFY | `src/seed/types/index.ts` | Add barrel re-export of landing-page-types |
| CREATE | `src/seed/config/niche-list.ts` | NICHE_SLUGS constant + niche metadata |
| MODIFY | `src/seed/config/index.ts` | Add barrel re-export of niche-list |
| CREATE | `src/seed/kv/landing-cache-ops.ts` | KV get/put for landing page cache |
| CREATE | `src/tree/landing/llm-fallback-generator.ts` | LLM content generation + caching logic |

## Implementation Steps

### Step 1: Create landing-page-types.ts
1. Define `Feature` interface, `FaqItem` interface, `LandingPage` interface
2. Define `CreateLandingPageInput` (all fields except id, created_at, updated_at)
3. Define `UpdateLandingPageInput` (all fields partial)
4. Define `GeneratedLandingContent` type (LLM output, without slug/label/is_published)
5. Define Zod schemas: `FeatureSchema`, `FaqItemSchema`, `GeneratedLandingContentSchema`, `LandingPageSchema`
6. Export all types and schemas

### Step 2: Update seed/types/index.ts
1. Add `export * from './landing-page-types'` (or explicit named exports)
2. Follow existing barrel re-export pattern

### Step 3: Create niche-list.ts config
1. Define `NICHE_SLUGS` as `const` array of 15 slug strings
2. Define `NICHE_METADATA` map: slug -> { label_en, label_vi } for use in page titles
3. Export both
4. Update `src/seed/config/index.ts` with barrel re-export

### Step 4: Create landing-cache-ops.ts (KV)
1. Follow `quota-cache-ops.ts` pattern: `getKvBinding()` with `globalThis.KV_KV` null guard
2. Export `getCachedLandingPage(slug: string): Promise<CachedLandingContent | null>`
   - Construct key: `landing:niche:${slug}`
   - `kv.get(key, 'json')` to parse stored JSON
3. Export `setCachedLandingPage(slug: string, content: GeneratedLandingContent): Promise<void>`
   - `kv.put(key, JSON.stringify(content), { expirationTtl: 604800 })` (7 days)
4. Logger warn on KV miss, info on cache hit

### Step 5: Create llm-fallback-generator.ts
1. Import `resilientChatCompletion` from `@/seed/inference/openrouter-client`
2. Import `getBySlug` from `@/seed/db/repositories/landing-pages-repo`
3. Import `getCachedLandingPage`, `setCachedLandingPage` from `@/seed/kv/landing-cache-ops`
4. Import `GeneratedLandingContentSchema` from `@/seed/types/landing-page-types`
5. Define `SYSTEM_PROMPT` constant with bilingual content writer instructions
6. Define `buildUserPrompt(nicheSlug: string): string` — template with niche name
7. Export `generateLandingPageContent(nicheSlug: string): Promise<GeneratedLandingContent>`
   a. Try `getBySlug(nicheSlug)` — return if found (note: D1 content has extra fields; extract what's needed)
   b. Try `getCachedLandingPage(nicheSlug)` — return if hit
   c. Call `resilientChatCompletion(messages, { model: 'openai/gpt-4o-mini', temperature: 0.7 })`
   d. Parse response content as JSON — strip markdown fences if present
   e. Validate with `GeneratedLandingContentSchema.parse()`
   f. Call `setCachedLandingPage(nicheSlug, validated)`
   g. Return validated content
8. Wrap LLM call in try/catch with timeout (AbortController, 15s)
9. On LLM failure: log error, throw (Phase 03 page shows 404 or error state)

### Step 6: Verify compilation
1. Run `npm run type-check` to verify zero TypeScript errors
2. Fix any type issues

## Todo List
- [ ] Create `src/seed/types/landing-page-types.ts` with all types + Zod schemas
- [ ] Update `src/seed/types/index.ts` barrel export
- [ ] Create `src/seed/config/niche-list.ts` with NICHE_SLUGS + NICHE_METADATA
- [ ] Update `src/seed/config/index.ts` barrel export
- [ ] Create `src/seed/kv/landing-cache-ops.ts` with KV get/put
- [ ] Create `src/tree/landing/llm-fallback-generator.ts` with full generation pipeline
- [ ] Verify `npm run type-check` passes with zero errors

## Success Criteria
- All TypeScript types defined with zero `:any`
- Zod schemas validate LLM output shape
- `NICHE_SLUGS` has exactly 15 entries matching migration seed data
- KV cache ops follow existing globalThis.KV_KV pattern
- LLM fallback generator calls OpenRouter, validates response, caches result
- Barrel exports working from both `types/index.ts` and `config/index.ts`

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenRouter API key not available (BYOK) | Medium | High | Generator checks for API key; returns error if missing; Phase 03 shows "content unavailable" |
| LLM returns invalid JSON | Medium | Medium | Zod parse catches; retry once; on failure return generic content or error |
| LLM call slow (>15s) | Low | Medium | AbortController timeout; KV cache prevents repeat calls |
| KV binding missing in dev | Medium | Low | Null guard returns null (cache miss); LLM generates fresh each time in dev |
| `resilientChatCompletion` requires BYOK key per-user | High | Medium | Use system-level OpenRouter key for landing page generation (not per-user BYOK) — see Unresolved Questions |

## Security Considerations
- LLM prompt must not include any user data — only niche slug
- KV cache content is public marketing copy — no PII risk
- OpenRouter API key handling: need to determine if a system-level key exists or if this is BYOK-only
- Zod validation prevents malformed content from entering cache

## Unresolved Questions
1. **OpenRouter API key for server-side generation**: The existing `resilientChatCompletion` is designed for BYOK (per-user API keys). For server-side landing page generation (no user context), we need either: (a) a system-level OpenRouter API key in environment, or (b) a special admin-owned key. Which pattern to use?
2. **KV namespace binding name**: Confirm the KV binding is `KV_KV` (same as quota-cache-ops.ts uses) and not a separate namespace. If a new namespace is needed, it requires `wrangler.toml` configuration.

## Next Steps
- Phase 03 depends on this phase (types needed for page component, LLM fallback needed for unknown slugs)
- Phase 04 independently depends on Phase 01 (repo) and uses types from this phase
