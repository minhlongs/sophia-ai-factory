# Phase 4.1 — Provider Interface

**Status:** Design  
**Layer:** seed/types (extend) + forest/llm (new)

## Context Links

- Existing `LlmRoute`: `land/agent-chat/types.ts:29-34`
- Existing `LLMRouteResult`: `land/openclaw/llm-router.ts:27-35`
- Logger utility: `seed/utils/logger-utility.ts`
- BYOK key resolution: `tree/credentials/get-provider-key.ts`

## Requirements

1. Abstract interface all LLM providers implement
2. Methods: `chat()`, `stream()`, `countTokens()`, `estimateCost()`
3. Provider-agnostic request/response types
4. Error types for provider failures (timeout, auth, rate-limit, unavailable)
5. Cloudflare Workers compatible (no Node.js streams, no `child_process`)

## Architecture

### New Files

```
apps/sophia-ai-factory/src/
├── seed/types/
│   └── llm-provider.ts          # Provider interfaces + error types
└── forest/llm/
    ├── provider-interface.ts    # Abstract base class
    ├── index.ts                 # Barrel export
    └── __tests__/
        └── provider-interface.test.ts
```

### Interface Design

```typescript
// seed/types/llm-provider.ts

export type ProviderId = string; // e.g. "anthropic", "deepseek", "openrouter", "qwen"

export interface ProviderCapabilities {
  chat: boolean;          // supports non-streaming chat completion
  stream: boolean;        // supports streaming
  countTokens: boolean;   // supports token counting
  vision: boolean;        // supports image input
  toolUse: boolean;       // supports function/tool calling
  systemPrompt: boolean;  // supports system role messages
}

export interface ProviderPricing {
  inputPer1kTokens: number;   // USD per 1K input tokens, 0 = free/unknown
  outputPer1kTokens: number;  // USD per 1K output tokens, 0 = free/unknown
  currency: 'USD';
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'down';
  lastSuccess: number | null;     // epoch ms
  lastFailure: number | null;     // epoch ms
  consecutiveFailures: number;
  avgLatencyMs: number | null;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning?: string;  // for models that expose thinking (DeepSeek R1, etc.)
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  timeoutMs?: number;
}

export interface ChatResponse {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  reasoning?: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
}

export interface StreamChunk {
  text?: string;
  reasoning?: string;
  done: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface TokenCountResult {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostEstimate {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  model: string;
}

export type ProviderErrorCode =
  | 'AUTH_FAILED'       // 401/403
  | 'RATE_LIMITED'      // 429
  | 'TIMEOUT'
  | 'PROVIDER_DOWN'     // 5xx, connection refused
  | 'INVALID_REQUEST'   // 400
  | 'CONTENT_FILTERED'  // provider blocked content
  | 'UNKNOWN';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId: ProviderId;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(opts: {
    code: ProviderErrorCode;
    providerId: ProviderId;
    message: string;
    retryable?: boolean;
    statusCode?: number | null;
    cause?: Error;
  }) {
    super(opts.message);
    this.code = opts.code;
    this.providerId = opts.providerId;
    this.retryable = opts.retryable ?? false;
    this.statusCode = opts.statusCode ?? null;
    this.cause = opts.cause;
  }
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  readonly pricing: ProviderPricing;

  /** Non-streaming chat completion */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /** Streaming chat completion — returns async iterable of chunks */
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk>;

  /** Count tokens for a message array (optional, may throw if unsupported) */
  countTokens?(messages: ChatMessage[]): Promise<TokenCountResult>;

  /** Estimate cost for given messages + expected output length */
  estimateCost(messages: ChatMessage[], estimatedOutputTokens: number): CostEstimate;

  /** Check provider health (lightweight ping) */
  healthCheck?(): Promise<boolean>;
}
```

### Abstract Base Class

```typescript
// forest/llm/provider-interface.ts

import type {
  LLMProvider,
  ProviderCapabilities,
  ProviderPricing,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  CostEstimate,
  ProviderError,
} from '@/seed/types/llm-provider';
import { createLogger } from '@/seed/utils/logger-utility';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly id: string;
  abstract readonly capabilities: ProviderCapabilities;
  abstract readonly pricing: ProviderPricing;

  private readonly log = createLogger(`forest/llm/provider/${this.id}`);

  // ── Required methods (implemented by subclass) ──────────────────────

  abstract chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse>;

  abstract stream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<StreamChunk>;

  // ── Optional methods with safe defaults ──────────────────────────────

  async countTokens(_messages: ChatMessage[]): Promise<TokenCountResult> {
    // Default: rough estimate (chars / 4)
    const promptText = _messages.map((m) => m.content).join('');
    const estimated = Math.ceil(promptText.length / 4);
    return { promptTokens: estimated, completionTokens: 0, totalTokens: estimated };
  }

  async estimateCost(
    messages: ChatMessage[],
    estimatedOutputTokens: number,
  ): Promise<CostEstimate> {
    const promptText = messages.map((m) => m.content).join('');
    const inputTokens = Math.ceil(promptText.length / 4);
    const inputCost = (inputTokens / 1000) * this.pricing.inputPer1kTokens;
    const outputCost = (estimatedOutputTokens / 1000) * this.pricing.outputPer1kTokens;
    return {
      inputCostUsd: inputCost,
      outputCostUsd: outputCost,
      totalCostUsd: inputCost + outputCost,
      model: this.id,
    };
  }

  async healthCheck(): Promise<boolean> {
    // Default: assume healthy (registry will track actual health)
    return true;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  protected makeError(opts: {
    code: ProviderErrorCode;
    message: string;
    retryable?: boolean;
    statusCode?: number | null;
    cause?: Error;
  }): ProviderError {
    const err = new ProviderError({
      code: opts.code,
      providerId: this.id,
      message: opts.message,
      retryable: opts.retryable ?? false,
      statusCode: opts.statusCode ?? null,
      cause: opts.cause,
    });
    this.log.error(`provider error [${opts.code}]`, { message: opts.message, retryable: opts.retryable });
    return err;
  }

  protected classifyHttpError(status: number): ProviderErrorCode {
    if (status === 401 || status === 403) return 'AUTH_FAILED';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'PROVIDER_DOWN';
    if (status === 400) return 'INVALID_REQUEST';
    return 'UNKNOWN';
  }
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `seed/types/llm-provider.ts` | All provider interfaces, error types, `ProviderError` class |
| `forest/llm/provider-interface.ts` | `BaseLLMProvider` abstract class |
| `forest/llm/index.ts` | Barrel export |

## Files to Modify

| File | Change |
|------|--------|
| `land/agent-chat/types.ts` | Extend `LlmRoute.provider` union to include new providers (backward compat) |
| `forest/agent-chat/types.ts` | Same extension |

## Tests

- `provider-interface.test.ts` — verify `BaseLLMProvider` defaults, `ProviderError` codes, `classifyHttpError`

## Risks

- `LlmRoute` type is used in API routes and client code — must not break existing union values
- Cloudflare Workers do not have `AbortSignal.timeout()` (Node 18+); use `setTimeout` + `AbortController`
