# AI Provider Abstraction

> **Status**: Design guideline (BYOK per no-tech doctrine)  
> **Goal**: Model-agnostic, provider-agnostic AI primitives

## Problem

Current Sophia couples AI calls to specific providers:
- OpenRouter for LLM
- ElevenLabs for TTS
- D-ID / HeyGen for avatar video
- fal.ai / Replicate for image/video

Each has different auth, request/response shapes, error handling, and rate limits. Adding a new provider requires:
- New adapter code
- New error handling
- New quota tracking
- New UI in Setup Wizard

## Design: Provider Registry + Adapter Pattern

### Core Abstraction

```typescript
interface AIProvider {
  provider: AIProviderType;
  capabilities: ModelCapability[];
  authenticate(credentials: Record<string, string>): Promise<void>;
  complete(request: ModelRequest): Promise<ModelResponse>;
  stream?(request: ModelRequest): AsyncIterable<ModelResponseChunk>;
  estimateCost(request: ModelRequest): number;  // cents
  validateModel(modelId: string): boolean;
}
```

### Provider Registry

```typescript
interface AIProviderRegistry {
  register(provider: AIProvider): void;
  getProvider(name: string): AIProvider | undefined;
  listProviders(capability?: ModelCapability): AIProvider[];
  resolve(policy: ModelPolicy): AIProvider;  // pick cheapest/fallback
}
```

### Model Policy (per-request)

```typescript
interface ModelPolicy {
  capability: ModelCapability;
  preferredProvider?: string;
  maxCostPer1kTokens?: number;
  maxLatencyMs?: number;
  fallbackProviders?: string[];
  requiresImages?: boolean;
}
```

## Why This Design

- **Provider-agnostic**: Swap OpenRouter → Anthropic direct → Google Vertex without changing business logic
- **Model-agnostic**: gpt-4, claude-3, gemini-pro all accessed via same `complete()` call
- **Cost-aware**: Registry picks cheapest provider that satisfies policy
- **Fallback**: Automatic retry on different provider if first fails
- **BYOK-compatible**: Customer provides credentials per provider via Setup Wizard

## Current State

| Provider | Adapter | Status |
|---|---|---|
| OpenRouter | `src/seed/ai/openrouter/` | Production |
| ElevenLabs | `src/seed/ai/elevenlabs/` | Production |
| D-ID | `src/seed/ai/did/` | Production |
| HeyGen | `src/seed/ai/heygen/` | Production |
| fal.ai | `src/seed/ai/fal/` | Production |
| Replicate | `src/seed/ai/replicate/` | Production |

## Migration Path

1. **Phase 4**: Define `AIProvider` interface + `AIProviderRegistry`
2. **Phase 5**: Implement OpenRouter adapter (existing code → adapter)
3. **Phase 6**: Implement TTS adapters (ElevenLabs, etc.)
4. **Phase 7**: Implement video/image adapters
5. **Phase 8**: Wire provider selection into Agent Protocol

## Circuit Breaker Integration

Every provider call uses `shouldAllowRequest` / `recordSuccess` / `recordFailure`:
- `AUTH_FAILURE` → immediate open (customer's key is invalid)
- `RATE_LIMIT` → cooldown then retry
- `SERVER_ERROR` → retry with backoff, fallback to next provider

## See Also

- `src/seed/types/creative-domain.ts` — ModelRequest, ModelResponse, ModelPolicy types
- `src/seed/security/circuit-breaker.ts` — Circuit breaker implementation
- `AGENT_PROTOCOL.md` — How agents use AI providers