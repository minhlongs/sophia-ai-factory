# Phase 4 Design Report — Multi-Provider Architecture

**Date:** 2026-06-27  
**Scope:** 7 design phases  
**Status:** Design complete, ready for implementation

## Summary

Replaces the hardcoded DeepSeek → Anthropic fallback in `resolveLlmRoute` with a pluggable multi-provider system. Six new components: provider interface, registry, fallback chain, cost-aware router, health monitor, and BYOK integration. All backward-compatible with existing callers.

## File Inventory

### New Files (19 total)

| # | File | Phase | Purpose |
|---|------|-------|---------|
| 1 | `seed/types/llm-provider.ts` | 4.1 | Provider interfaces, error types, `ProviderError` class |
| 2 | `forest/llm/provider-interface.ts` | 4.1 | `BaseLLMProvider` abstract class |
| 3 | `forest/llm/index.ts` | 4.1 | Barrel export |
| 4 | `forest/llm/provider-registry.ts` | 4.2 | Registry: registration, lookup, health tracking |
| 5 | `forest/llm/cost-tier.ts` | 4.2 | Provider → cost tier mapping |
| 6 | `forest/llm/provider-registry.test.ts` | 4.2 | Tests |
| 7 | `forest/llm/fallback-chain.ts` | 4.3 | FallbackChain: chat/stream with automatic fallback |
| 8 | `forest/llm/default-chains.ts` | 4.3 | Tier-keyed default provider order |
| 9 | `forest/llm/fallback-chain.test.ts` | 4.3 | Tests |
| 10 | `forest/llm/task-complexity.ts` | 4.4 | Complexity scoring from message features |
| 11 | `forest/llm/task-complexity.test.ts` | 4.4 | Tests |
| 12 | `forest/llm/tenant-usage-tracker.ts` | 4.4 | Per-tenant cost accumulation |
| 13 | `forest/llm/tenant-usage-tracker.test.ts` | 4.4 | Tests |
| 14 | `forest/llm/cost-aware-router.ts` | 4.4 | Main router: tier + complexity + budget → provider |
| 15 | `forest/llm/cost-aware-router.test.ts` | 4.4 | Tests |
| 16 | `forest/llm/health-monitor.ts` | 4.5 | HealthMonitor: on-demand checks, recovery tracking |
| 17 | `forest/llm/health-monitor.test.ts` | 4.5 | Tests |
| 18 | `forest/llm/byok-resolver.ts` | 4.6 | Key resolution: user → platform → null |
| 19 | `forest/llm/providers/anthropic-provider.ts` | 4.6 | Anthropic API implementation |
| 20 | `forest/llm/providers/deepseek-provider.ts` | 4.6 | DeepSeek API implementation |
| 21 | `forest/llm/providers/index.ts` | 4.6 | Provider barrel export |
| 22 | `forest/llm/route-resolver.ts` | 4.7 | Shared `resolveLlmRoute` implementation |

### Modified Files (4 total)

| # | File | Phase | Change |
|---|------|-------|--------|
| 1 | `land/agent-chat/types.ts` | 4.7 | Extend `LlmRoute.provider` union |
| 2 | `land/agent-chat/llm-router.ts` | 4.7 | Delegate to CostAwareRouter, legacy fallback |
| 3 | `forest/agent-chat/llm-router.ts` | 4.7 | Re-export from `forest/llm/route-resolver` |
| 4 | `land/agent-chat/llm-router.test.ts` | 4.7 | Update tests |

## Layer Placement

```
seed/types/llm-provider.ts          ← seed (importable by all)
forest/llm/                         ← forest (orchestration)
  ├── provider-interface.ts
  ├── provider-registry.ts
  ├── fallback-chain.ts
  ├── cost-aware-router.ts
  ├── health-monitor.ts
  ├── byok-resolver.ts
  ├── providers/ (anthropic, deepseek)
  └── route-resolver.ts
land/agent-chat/llm-router.ts       ← land (imports from forest/llm)
```

No cross-layer violations. Forest → land call is allowed (orchestration exception).

## Key Design Decisions

1. **`ProviderError` class** with typed codes instead of plain Error — enables programmatic fallback decisions
2. **`BaseLLMProvider` abstract class** with safe defaults for optional methods — reduces boilerplate in provider implementations
3. **`FallbackChain` generic** — works for chat, stream, and cost estimation with same chain logic
4. **BYOK-first resolution** in `ByokResolver` — customer keys always win, platform keys are fallback only (no-tech doctrine)
5. **`resolveLlmRoute` backward compat** via try/catch delegation — new system first, legacy env-var fallback if new system fails
6. **`forest/llm/route-resolver.ts`** shared module — avoids cross-layer import between land and forest copies of llm-router
7. **In-memory tracking** (Map-based) — Cloudflare Workers single-threaded model, no external DB needed for health/usage

## Unresolved Questions

1. **Provider credential mapping** (`LLM_PROVIDER_CREDENTIAL_MAP`): currently hardcoded for anthropic/deepseek/openrouter/etc. Should this be configurable per-deployment, or is the static map sufficient?
2. **Health check endpoint**: providers don't have a standard "ping" endpoint. Anthropic has no lightweight health check — should we use a minimal token count request instead?
3. **`resolveLlmRoute` return value**: the new system resolves keys internally, so `LlmRoute.apiKey` may be empty. Callers that pass `apiKey` to fetch will break. Should we populate `apiKey` from the resolved key, or require callers to migrate to using providers directly?
4. **Tenant usage persistence**: current `tenant-usage-tracker.ts` is in-memory (resets on cold start). Should daily budget enforcement use D1 for persistence, or is per-request in-memory sufficient for the MVP?
