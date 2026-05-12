# Code Review — Phase 3 Proposal Port

**Verdict:** APPROVE for commit with MEDIUM follow-ups.
**Score:** 7.5/10 — Functional, secure, canonical-clean. Loses points on dead code (`template` lookup wired but unused) and a subtle parser fragility that will silently degrade quality scores in production.

## CRITICAL
None.

## HIGH
1. **`route.ts:51-55` — Template lookup is dead computation.**
   `getSystemTemplate(templateId)` is fetched and validated, but the returned `template` object is never used. `generateProposal()` only receives `templateId: string` (a passthrough field in `GeneratedProposal.metadata` would be nice but doesn't even land there — `proposal-generator.ts:8-35` accepts `templateId` in params but never reads it). The template's `systemPrompt` / `sections` from `proposal-templates.ts` are never consulted; `proposal-generator.ts:113-145` hard-codes its own system prompt instead.
   Two clean options:
   (a) Use `template.systemPrompt` inside `buildSystemPrompt` (true template-driven generation).
   (b) Drop the templateId field entirely from `generateProposalSchema` + `ProposalGenerationParams` and delete templates.ts. YAGNI.
   Either is fine — current state is misleading (looks like templates work; they don't).

2. **`proposal-generator.ts:187-208` — `parseProposalContent` fragility.**
   Splits on `\n##\s+` (markdown H2). If the LLM uses `###` H3 or different casing, all 7 sections come back empty → `checkProposalQuality` returns `completeness: 0`, `passed: false`. Plus `sections[1]` fallback for `executiveSummary` can grab the wrong block if the model includes a preamble. With `temperature: 0.7` you WILL see this misfire. Either:
   - Tighten the system prompt: "ALWAYS use `## <SectionName>` H2 headers" (cheapest fix).
   - Or, ask the model to return JSON via `response_format: { type: 'json_object' }` and validate with zod.
   Minimum: add a log warning when ≥3 sections come back empty, otherwise silent quality degradation.

## MEDIUM
3. **`proposal-templates.ts:128-144` — `buildPromptFromTemplate` is exported but unused.** Dead export; either consume it (see HIGH #1) or delete. YAGNI.

4. **`proposal-quality-check.ts:125` — Side-effect mutation.** When `totalLength < minLength`, `scores.completeness` is mutated AFTER `overallScore` is already computed at line 111. The returned `scores.completeness` no longer reconciles with `overallScore`. Cosmetic but confusing for consumers reading the scores object. Fix: clamp BEFORE computing overallScore, or skip the mutation and just push feedback.

5. **`route.ts:94` — Error detail exposure.** `details: error instanceof Error ? error.message : 'Unknown error'` leaks raw OpenRouter error text (which can include the request body or model name in some failure modes — `proposal-generator.ts:90` already truncates to 200 chars, but it can still leak `OPENROUTER_API_KEY` length hints or upstream stack frames). Recommend: log full error server-side (already done via `logger.error`), return generic `details: 'Generation failed'` to client. Adds defense-in-depth.

6. **`proposal-generator.ts:8-35` — Type structural duplication.** `ProposalGenerationParams.clientInfo`/`solutionInfo` re-shape what `GenerateProposalInput` already validates. Route does manual destructure mapping at `route.ts:57-75`. Not blocking, but a `mapInputToParams()` helper next to the schema would help future call sites stay consistent (and is exactly the kind of code the "shared lib for future mission handler" rationale was meant to enable).

## LOW
7. **`route.ts:51` — Non-null assertion `SYSTEM_TEMPLATES[0]!.id`.** Array is module-const with 3 entries, so safe — but `!` reads as "I'm tired"; prefer a named export `DEFAULT_TEMPLATE_ID` from `proposal-templates.ts`.

8. **`proposal-templates.ts:137` — Regex from interpolated key.** `new RegExp(\`{${key}}\`, 'g')` will explode if a template variable key ever contains regex metacharacters. Today keys are hardcoded so fine — but if user-driven keys ever flow through (e.g. custom templates from DB), this is an injection foot-gun. Use `replaceAll(placeholder, replacement)` instead.

9. **`proposal-generator.ts:74` — `HTTP-Referer` hardcoded to prod URL.** Local dev / preview deploys will send wrong referer. Read from `process.env.NEXT_PUBLIC_APP_URL` with prod fallback.

## On the "Did Not Do" List
- **No MCU deduction** — Reasonable defer; documented in plan, won't break anything. Track as follow-up Phase 6.
- **No `[id]/route.ts` CRUD** — Acceptable for MVP; UI today only does generation.
- **Mission handler `proposal-create.ts` not refactored** — Justified; output contracts differ. Note that the shared lib's stated purpose ("future mission handler callers") is currently aspirational — no second caller exists. KISS would say delete `proposal-generator.ts` and inline into `route.ts` until a second caller appears. Keeping it is defensible if Phase 6+ will actually integrate it.

## Canonical Compliance ✅
- Imports use `@/seed/*` (verified against tsconfig `paths`)
- Zero `:any`, zero `console.*`
- Auth via `getCurrentUser()` ✅
- Zod via `safeParse` ✅
- Logger + `toError` used ✅
- File sizes all ≤209 LOC (within 200-LOC guideline, generator just barely over — acceptable given cohesion)

## Recommended Actions Before Commit
1. Decide HIGH #1 (use templates OR drop them). 2-minute decision.
2. HIGH #2 (a) — one-line addition to system prompt mandating `## H2` headers.
3. MEDIUM #5 — strip error details from client response.
4. Squash LOW #7-8-9 in same commit (5 minutes total).

If HIGH #1 and #2 are addressed, score jumps to 9/10. The rest are polish.

## Unresolved
- Should templates be persisted in D1 for user customization (per source repo's design), or stay as code constants? Phase 6 design decision.
- The aliasing comment in `sophia-layer-architecture.md` (`@/lib/*` vs `@/seed/*` "tương lai chọn 1 canonical") — your code already commits to `@/seed/*`, which is correct. CLAUDE.md's "Auth: `@/lib/better-auth-session`" line should be updated to `@/seed/auth/better-auth-session` for consistency (separate doc-sync task, not blocking).
