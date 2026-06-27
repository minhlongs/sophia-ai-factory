# Phase 4.6 — BYOK Integration

**Status:** Design  
**Layer:** forest/llm (new) + tree/credentials (extend)

## Context Links

- Phase 4.1: `phase-01-provider-interface.md` (LLMProvider interface)
- Existing BYOK store: `tree/credentials/get-provider-key.ts` (getHeyGenKey, getKlingKey, etc.)
- Existing credential repo: `tree/credentials/user-credentials-repo.ts` (getUserCredential)
- Existing `ProviderKeyResult`: `{ key, source: 'user' | 'platform' }`
- No-tech doctrine: customer keys take priority; platform keys are fallback only

## Requirements

1. Customer API keys take priority over platform keys (BYOK-first)
2. Per-provider key resolution: resolve key for any registered provider
3. Graceful fallback to platform env vars when customer key absent
4. Key rotation support (ByokKeyRotatedError already handled in get-provider-key.ts)
5. No key leakage in logs (mask keys in structured logs)
6. Cloudflare Workers compatible

## Architecture

### New Files

```
forest/llm/
├── byok-resolver.ts           # Key resolution for LLM providers
├── byok-resolver.test.ts      # Tests
└── index.ts                   # Updated barrel
```

### Design

```typescript
// forest/llm/byok-resolver.ts

import type { ProviderId } from '@/seed/types/llm-provider';
import { createLogger } from '@/seed/utils/logger-utility';
import { getUserCredential } from '@/tree/credentials/user-credentials-repo';

export interface ResolvedProviderKey {
  providerId: ProviderId;
  key: string;
  source: 'user' | 'platform';
  /** Masked key for logging (first 4 + last 4 chars) */
  maskedKey: string;
}

export interface KeyResolutionOptions {
  userId?: string;
  /** Allow platform fallback if user key absent (default: true for non-critical) */
  fallbackToPlatform?: boolean;
}

const LLM_PROVIDER_CREDENTIAL_MAP: Record<string, string> = {
  anthropic: 'anthropic',
  deepseek: 'deepseek',
  openrouter: 'openrouter',
  openai: 'openai',
  google: 'google',
  groq: 'groq',
  qwen: 'qwen',
  // Map internal provider id → credential store key
};

export class ByokResolver {
  private readonly log = createLogger('forest/llm/byok-resolver');

  /**
   * Resolve API key for a provider.
   * Priority: user credential → platform env var → null
   */
  async resolveKey(
    providerId: ProviderId,
    options: KeyResolutionOptions = {},
  ): Promise<ResolvedProviderKey | null> {
    const { userId, fallbackToPlatform = true } = options;
    const credentialKey = LLM_PROVIDER_CREDENTIAL_MAP[providerId];

    // 1 — Try user credential (BYOK)
    if (userId && credentialKey) {
      try {
        const userKey = await getUserCredential(userId, credentialKey);
        if (userKey) {
          return {
            providerId,
            key: userKey,
            source: 'user',
            maskedKey: this.maskKey(userKey),
          };
        }
      } catch (err) {
        // Key rotated during active request — caller should retry or fall back
        this.log.warn(`user credential error`, {
          providerId,
          userId,
          error: err instanceof Error ? err.message : 'unknown',
        });
        if (err instanceof ByokKeyRotatedError) {
          // Don't fall back to platform — user rotated key intentionally
          return null;
        }
        // Other errors: fall through to platform
      }
    }

    // 2 — Try platform env var
    if (fallbackToPlatform) {
      const envKey = this.getPlatformKey(providerId);
      if (envKey) {
        return {
          providerId,
          key: envKey,
          source: 'platform',
          maskedKey: this.maskKey(envKey),
        };
      }
    }

    // 3 — No key available
    this.log.warn(`no API key resolved`, { providerId, userId });
    return null;
  }

  /**
   * Resolve keys for all providers in a chain.
   * Returns map of providerId → ResolvedProviderKey (only those with keys).
   */
  async resolveChain(
    providerIds: ProviderId[],
    options: KeyResolutionOptions = {},
  ): Promise<Map<ProviderId, ResolvedProviderKey>> {
    const results = await Promise.allSettled(
      providerIds.map((id) => this.resolveKey(id, options)),
    );
    const map = new Map<ProviderId, ResolvedProviderKey>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        map.set(providerIds[index], result.value);
      }
    });
    return map;
  }

  // ── Internal ────────────────────────────────────────────────────────

  private getPlatformKey(providerId: ProviderId): string | null {
    const envMap: Record<string, string | undefined> = {
      anthropic: process.env.ANTHROPIC_API_KEY ?? undefined,
      deepseek: process.env.DEEPSEEK_API_KEY ?? undefined,
      openrouter: process.env.OPENROUTER_API_KEY ?? undefined,
      openai: process.env.OPENAI_API_KEY ?? undefined,
      google: process.env.GOOGLE_API_KEY ?? undefined,
      groq: process.env.GROQ_API_KEY ?? undefined,
      qwen: process.env.QWEN_API_KEY ?? undefined,
    };
    return envMap[providerId] ?? null;
  }

  private maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
}
```

### Provider Implementation: Anthropic

```typescript
// forest/llm/providers/anthropic-provider.ts

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
  ProviderErrorCode,
} from '@/seed/types/llm-provider';
import { BaseLLMProvider } from '../provider-interface';
import { ByokResolver } from '../byok-resolver';

export class AnthropicProvider extends BaseLLMProvider {
  readonly id = 'anthropic';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    countTokens: false,
    vision: true,
    toolUse: true,
    systemPrompt: true,
  };
  readonly pricing: ProviderPricing = {
    inputPer1kTokens: 0.003,
    outputPer1kTokens: 0.015,
    currency: 'USD',
  };

  private readonly baseUrl = 'https://api.anthropic.com/v1';
  private apiKey: string;
  private readonly byokResolver: ByokResolver;

  constructor(byokResolver: ByokResolver, userId?: string) {
    super();
    this.byokResolver = byokResolver;
    this.apiKey = ''; // resolved lazily
    this._userId = userId;
  }

  private _userId?: string;

  async ensureKey(): Promise<void> {
    const resolved = await this.byokResolver.resolveKey('anthropic', {
      userId: this._userId,
      fallbackToPlatform: true,
    });
    if (!resolved) {
      throw this.makeError({
        code: 'AUTH_FAILED',
        message: 'No Anthropic API key available (user or platform)',
        retryable: false,
      });
    }
    this.apiKey = resolved.key;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    await this.ensureKey();
    const systemPrompt = this.extractSystemPrompt(messages);
    const userMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: options.model ?? 'claude-sonnet-4-5',
      max_tokens: options.maxTokens ?? 4096,
      messages: userMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
    if (systemPrompt) body.system = systemPrompt;
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: this.createTimeoutSignal(options.timeoutMs),
    });

    if (!res.ok) {
      const err = this.classifyHttpError(res.status);
      throw this.makeError({
        code: err,
        message: `Anthropic HTTP ${res.status}`,
        retryable: err === 'RATE_LIMITED' || err === 'PROVIDER_DOWN',
        statusCode: res.status,
      });
    }

    const data = (await res.json()) as {
      content: Array<{ text: string; type: string }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      stop_reason: string;
    };

    return {
      text: data.content[0]?.text ?? '',
      model: body.model as string,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.prompt_tokens + data.usage.completion_tokens,
      },
      finishReason: this.mapStopReason(data.stop_reason),
    };
  }

  async stream(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): AsyncIterable<StreamChunk> {
    await this.ensureKey();
    const systemPrompt = this.extractSystemPrompt(messages);
    const userMessages = messages.filter((m) => m.role !== 'system');

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model ?? 'claude-sonnet-4-5',
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
        system: systemPrompt,
        messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: this.createTimeoutSignal(options.timeoutMs),
    });

    if (!res.ok) {
      const err = this.classifyHttpError(res.status);
      throw this.makeError({
        code: err,
        message: `Anthropic HTTP ${res.status}`,
        retryable: err === 'RATE_LIMITED' || err === 'PROVIDER_DOWN',
        statusCode: res.status,
      });
    }

    const reader = res.body?.getReader();
    if (!reader) throw this.makeError({ code: 'PROVIDER_DOWN', message: 'No response body' });

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice('data:'.length).trim();
        if (jsonStr === '[DONE]') return;
        try {
          const parsed = JSON.parse(jsonStr) as {
            type: string;
            delta?: { text?: string; thinking?: string };
            usage?: { prompt_tokens: number; completion_tokens: number };
          };
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield { text: parsed.delta.text, done: false };
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.thinking) {
            yield { reasoning: parsed.delta.thinking, done: false };
          }
          if (parsed.type === 'message_stop') {
            yield { done: true };
          }
        } catch {
          // skip malformed SSE
        }
      }
    }
    yield { done: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private extractSystemPrompt(messages: ChatMessage[]): string | undefined {
    const sys = messages.find((m) => m.role === 'system');
    return sys?.content;
  }

  private createTimeoutSignal(timeoutMs?: number): AbortSignal {
    const controller = new AbortController();
    if (timeoutMs) {
      setTimeout(() => controller.abort(), timeoutMs);
    }
    return controller.signal;
  }

  private mapStopReason(reason: string): ChatResponse['finishReason'] {
    if (reason === 'end_turn') return 'stop';
    if (reason === 'max_tokens') return 'length';
    if (reason === 'tool_use') return 'tool_calls';
    return 'error';
  }
}
```

### Provider Implementation: DeepSeek (OpenAI-compatible)

```typescript
// forest/llm/providers/deepseek-provider.ts

import type {
  LLMProvider,
  ProviderCapabilities,
  ProviderPricing,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderError,
} from '@/seed/types/llm-provider';
import { BaseLLMProvider } from '../provider-interface';
import { ByokResolver } from '../byok-resolver';

export class DeepSeekProvider extends BaseLLMProvider {
  readonly id = 'deepseek';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    countTokens: false,
    vision: false,
    toolUse: false,
    systemPrompt: true,
  };
  readonly pricing: ProviderPricing = {
    inputPer1kTokens: 0.00014,
    outputPer1kTokens: 0.00028,
    currency: 'USD',
  };

  private readonly baseUrl = 'https://api.deepseek.com/v1';
  private apiKey: string;
  private readonly byokResolver: ByokResolver;
  private _userId?: string;

  constructor(byokResolver: ByokResolver, userId?: string) {
    super();
    this.byokResolver = byokResolver;
    this._userId = userId;
  }

  async ensureKey(): Promise<void> {
    const resolved = await this.byokResolver.resolveKey('deepseek', {
      userId: this._userId,
      fallbackToPlatform: true,
    });
    if (!resolved) {
      throw this.makeError({
        code: 'AUTH_FAILED',
        message: 'No DeepSeek API key available',
        retryable: false,
      });
    }
    this.apiKey = resolved.key;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    await this.ensureKey();
    const body = {
      model: options.model ?? 'deepseek-reasoner',
      max_tokens: options.maxTokens ?? 4096,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: this.createTimeoutSignal(options.timeoutMs),
    });

    if (!res.ok) {
      const code = this.classifyHttpError(res.status);
      throw this.makeError({
        code,
        message: `DeepSeek HTTP ${res.status}`,
        retryable: code === 'RATE_LIMITED' || code === 'PROVIDER_DOWN',
        statusCode: res.status,
      });
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string; reasoning_content?: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices[0];
    return {
      text: choice.message.content,
      model: body.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.prompt_tokens + data.usage.completion_tokens,
      },
      reasoning: choice.message.reasoning_content,
      finishReason: this.mapFinishReason(choice.finish_reason),
    };
  }

  async stream(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): AsyncIterable<StreamChunk> {
    await this.ensureKey();
    const body = {
      model: options.model ?? 'deepseek-reasoner',
      max_tokens: options.maxTokens ?? 4096,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: this.createTimeoutSignal(options.timeoutMs),
    });

    if (!res.ok) {
      const code = this.classifyHttpError(res.status);
      throw this.makeError({
        code,
        message: `DeepSeek HTTP ${res.status}`,
        retryable: code === 'RATE_LIMITED' || code === 'PROVIDER_DOWN',
        statusCode: res.status,
      });
    }

    const reader = res.body?.getReader();
    if (!reader) throw this.makeError({ code: 'PROVIDER_DOWN', message: 'No response body' });

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice('data:'.length).trim();
        if (jsonStr === '[DONE]') return;
        try {
          const parsed = JSON.parse(jsonStr) as {
            choices?: Array<{
              delta?: { content?: string; reasoning_content?: string };
              finish_reason?: string;
            }>;
          };
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) yield { text: delta.content, done: false };
          if (delta?.reasoning_content) yield { reasoning: delta.reasoning_content, done: false };
          if (parsed.choices?.[0]?.finish_reason) yield { done: true };
        } catch {
          // skip malformed
        }
      }
    }
    yield { done: true };
  }

  private createTimeoutSignal(timeoutMs?: number): AbortSignal {
    const controller = new AbortController();
    if (timeoutMs) setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }

  private mapFinishReason(reason: string): ChatResponse['finishReason'] {
    if (reason === 'stop') return 'stop';
    if (reason === 'length') return 'length';
    return 'error';
  }
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `forest/llm/byok-resolver.ts` | Key resolution: user → platform → null, with masking |
| `forest/llm/byok-resolver.test.ts` | Tests |
| `forest/llm/providers/anthropic-provider.ts` | Anthropic API implementation |
| `forest/llm/providers/deepseek-provider.ts` | DeepSeek API implementation (OpenAI-compat) |
| `forest/llm/providers/index.ts` | Barrel export for providers |

## Files to Modify

| File | Change |
|------|--------|
| `forest/llm/index.ts` | Add byok-resolver + providers exports |

## Tests

- `byok-resolver.test.ts`: user key priority, platform fallback, ByokKeyRotatedError handling, key masking
- `anthropic-provider.test.ts`: mock fetch, verify SSE parsing, error classification
- `deepseek-provider.test.ts`: mock fetch, verify SSE parsing, reasoning_content handling
