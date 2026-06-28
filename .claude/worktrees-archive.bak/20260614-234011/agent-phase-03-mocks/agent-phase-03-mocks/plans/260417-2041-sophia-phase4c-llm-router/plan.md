# Sophia Phase 4C — Smart LLM Router MVP

**Source:** PDF Solo Platform `Bước 4.3: Smart LLM Router` (page 63-67).
**Status:** in_progress 2026-04-17 PM-9.
**Builds on:** Phase 4B LlmCallTrace (provider/model fields already in schema).

## Scope (YAGNI/KISS)

Pure decision helper: **classify + select**. NO real LLM call yet. Integration point only records chosen route in existing `LLM_CALL_TRACE` event via `recordLlmCall()`.

## Files

- NEW `src/lib/ai/llm-router.ts` (~80 LOC)
  - `classifyComplexity(prompt: string): Complexity`
  - `selectRoute(complexity, hasLocalMode: boolean): RouteDecision`
- NEW `src/lib/ai/llm-router.test.ts` (~10 tests)
- MODIFY `src/app/api/cron/workflow-stepper/route.ts`
  - Call `classifyComplexity(workflow.prompt)` once at workflow level
  - Resolve local-mekongd BYOK via existing `resolveLocalMekongdForUser(workflow.org_id)` — wrap in try/catch, fall back to cloud route
  - Pass decided `{provider, model}` into `recordLlmCall(...)` instead of hardcoded `'stub'/'mvp-stub'`

## Routing Matrix (MVP — 2 tiers × 2 destinations)

| Complexity | hasLocalMode=true  | hasLocalMode=false |
| ---------- | ------------------ | ------------------ |
| simple     | local-mekongd / qwen3-8b   | openrouter / gpt-4o-mini |
| medium     | local-mekongd / qwen3-14b  | openrouter / gpt-4o-mini |
| complex    | local-mekongd / qwen3-30b  | anthropic  / claude-sonnet-4 |

## Classifier heuristic (mirrors PDF 4.3 `classify_complexity`)

- Complex keywords (EN+VN): `explain|analyze|compare|design|architect|refactor|reason|phân tích|thiết kế|so sánh`
- Simple keywords: `summarize|translate|hello|what is|define|tóm tắt|dịch|chào`
- `length > 500` OR `complex_score >= 2` → complex
- `length > 200` OR `complex_score > 0` → medium
- else → simple

## Success criteria

- [ ] All routing tests pass (determinism + keyword coverage + length thresholds)
- [ ] Workflow-stepper emits `LLM_CALL_TRACE` with REAL provider/model per workflow.prompt
- [ ] BYOK resolver failure → fall back to cloud route (never throws)
- [ ] Total Sophia test count climbs from 1089 → ~1100+
- [ ] Binh Pháp Rule #0: CI green + CF Pages deploy + prod HTTP 200 with shortSha match
