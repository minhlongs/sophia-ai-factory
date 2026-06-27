# Phase 4.7 — Backward Compatibility

**Status:** Design  
**Layer:** land/agent-chat (extend) + forest/llm (new)

## Context Links

- Existing `resolveLlmRoute`: `land/agent-chat/llm-router.ts` (and duplicate at `forest/agent-chat/llm-router.ts`)
- Existing `LlmRoute` type: `land/agent-chat/types.ts:29-34`
- Existing test: `land/agent-chat/llm-router.test.ts`
- Phase 4.6: `phase-06-byok-integration.md` (AnthropicProvider, DeepSeekProvider)

## Requirements

1. `resolveLlmRoute(userId)` signature unchanged — returns `Promise<LlmRoute>`
2. Internal implementation delegates to new CostAwareRouter
3. No breaking changes to any caller of `resolveLlmRoute`
4. `LlmRoute.provider` union extended (not replaced) to include new providers
5. Both `land/agent-chat/` and `forest/agent-chat/` copies stay in sync

## Architecture

### Backward-Compatible Wrapper

```typescript
// land/agent-chat/llm-router.ts (updated)

import { createLogger } from '@/seed/utils/logger-utility';
import type { LlmRoute } from './types';

// New imports (internal delegation)
import { ProviderRegistry } from '@/forest/llm/provider-registry';
import { CostAwareRouter } from '@/forest/llm/cost-aware-router';
import { FallbackChain } from '@/forest/llm/fallback-chain';
import { AnthropicProvider, DeepSeekProvider } from '@/forest/llm/providers';
import { ByokResolver } from '@/forest/llm/byok-resolver';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

const _log = createLogger('land/agent-chat/llm-router');

// ── Singleton instances (created once per Worker cold start) ──────────

let registry: ProviderRegistry | null = null;
let router: CostAwareRouter | null = null;

function getInstances(): { registry: ProviderRegistry; router: CostAwareRouter } {
  if (registry && router) return { registry, router };

  registry = new ProviderRegistry();
  router = new CostAwareRouter(registry, new FallbackChain({ providerIds: [] }));

  // Register providers
  const byokResolver = new ByokResolver();
  registry.register(new AnthropicProvider(byokResolver), 'high');
  registry.register(new DeepSeekProvider(byokResolver), 'low');

  return { registry, router };
}

// ── Public API (UNCHANGED signature) ──────────────────────────────────

/**
 * Resolve which LLM backend to use for a given user.
 * Throws 'NO_LLM_CONFIGURED' if no provider is available.
 *
 * @deprecated Internal callers should migrate to CostAwareRouter directly.
 * This function is preserved for backward compatibility.
 */
export async function resolveLlmRoute(userId: string): Promise<LlmRoute> {
  const { router } = getInstances();

  try {
    const result = await router.chat(
      [{ role: 'user', content: '' }], // placeholder — actual messages come later
      {},
      { userId, userTier: 'BASIC' },
    );
    // Map new result format back to legacy LlmRoute
    return {
      provider: result.providerId as LlmRoute['provider'],
      baseUrl: getBaseUrl(result.providerId),
      apiKey: '', // key is resolved inside provider; callers get it via provider
      model: result.response.model ?? 'claude-sonnet-4-5',
    };
  } catch {
    // Fallback to original env-var logic if new system fails
    return resolveLlmRouteLegacy();
  }
}

// ── Legacy fallback (preserved from original) ─────────────────────────

function resolveLlmRouteLegacy(): LlmRoute {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return {
      provider: 'deepseek',
      baseUrl: DEEPSEEK_BASE_URL,
      apiKey: deepseekKey,
      model: 'deepseek-reasoner',
    };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      provider: 'anthropic',
      baseUrl: ANTHROPIC_BASE_URL,
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022',
    };
  }

  throw new Error('NO_LLM_CONFIGURED');
}

function getBaseUrl(providerId: string): string {
  switch (providerId) {
    case 'anthropic':
      return ANTHROPIC_BASE_URL;
    case 'deepseek':
      return DEEPSEEK_BASE_URL;
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    default:
      return '';
  }
}
```

### Type Extension

```typescript
// land/agent-chat/types.ts (updated)

export interface LlmRoute {
  provider: 'local' | 'deepseek' | 'anthropic' | 'openrouter' | 'openai' | 'google' | 'groq' | 'qwen';
  baseUrl: string;
  apiKey: string;
  model: string;
}
```

### Sync forest/agent-chat/llm-router.ts

The duplicate at `forest/agent-chat/llm-router.ts` must mirror the land version. Both files should re-export from a shared internal module to avoid drift:

```typescript
// forest/agent-chat/llm-router.ts (updated — re-export from land)

export { resolveLlmRoute } from '@/land/agent-chat/llm-router';
export type { LlmRoute } from '@/land/agent-chat/types';
```

**Wait — forest cannot import land (cross-layer rule).** Instead, extract the shared logic:

```
forest/llm/
├── route-resolver.ts          # Shared resolveLlmRoute implementation
└── index.ts

land/agent-chat/
└── llm-router.ts              # Re-exports from forest/llm/route-resolver

forest/agent-chat/
└── llm-router.ts              # Re-exports from forest/llm/route-resolver
```

Both `land/agent-chat/` and `forest/agent-chat/` import from `forest/llm/route-resolver.ts` — no cross-layer violation.

## Files to Create

| File | Purpose |
|------|---------|
| `forest/llm/route-resolver.ts` | Shared `resolveLlmRoute` implementation (importable by both land and forest) |

## Files to Modify

| File | Change |
|------|--------|
| `land/agent-chat/llm-router.ts` | Delegate to CostAwareRouter, fallback to legacy env-var logic |
| `land/agent-chat/types.ts` | Extend `LlmRoute.provider` union |
| `forest/agent-chat/llm-router.ts` | Re-export from `forest/llm/route-resolver` |
| `land/agent-chat/llm-router.test.ts` | Update tests to cover both new path and legacy fallback |

## Migration Path for Callers

| Caller | Action Required |
|--------|----------------|
| `land/agent-chat/llm-router.ts` (self) | Updated in-place |
| API routes importing `resolveLlmRoute` | None — signature unchanged |
| Code reading `LlmRoute.provider` | May need to handle new provider strings |
| Code reading `LlmRoute.apiKey` | Still present but may be empty when using BYOK (key resolved internally) |

## Tests

- Existing tests pass unchanged (DeepSeek env → deepseek, Anthropic env → anthropic)
- New test: when new system fails, falls back to legacy env-var logic
- New test: `LlmRoute.provider` accepts extended union values
- New test: `NO_LLM_CONFIGURED` still thrown when no key available
