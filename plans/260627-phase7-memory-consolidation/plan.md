# Phase 7: Memory Consolidation — Design Plan

**Status:** Design Complete — Ready for Implementation  
**Date:** 2026-06-27  
**Layer:** seed (primitives) + forest (orchestration) + land (integration)

## Phases

| File | Status | Description |
|------|--------|-------------|
| `phase-07-enhanced-context.md` | Design | Full design: interfaces, file paths, integration plan |

## Acceptance Criteria

1. Context manager tracks token count and enforces limits before every LLM call
2. Three trimming strategies: sliding window, summarization, importance-based retention
3. Conversation summarizer uses existing llm-router (no new LLM provider)
4. Memory pruner handles memory_kv expiry + creator_memory decay + duplicate consolidation
5. Token counter supports Anthropic + OpenAI-compatible providers accurately
6. agent-chat route integrates context management WITHOUT breaking existing flow
7. Zero `:any` types, zero `console.*`, full TypeScript, Cloudflare Workers compatible
8. Backward compatible: existing agent-chat route works unchanged when context mgmt is disabled

## Dependencies

- Phase 6 (Qdrant vector memory) — optional; importance-based retention can use vector scores if available
- Existing `memory-adapter.ts` (D1-backed memory_kv)
- Existing `llm-router.ts` (provider resolution + multi-provider chat)
- Existing `cost-estimator.ts` (token counting heuristics)
- Existing `creator-memory-repo.ts` (creator_memory CRUD)
