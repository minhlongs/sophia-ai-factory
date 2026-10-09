/**
 * @module forest/ai/providers/fal-ai-adapter
 * Text provider adapter for fal.ai image generation.
 *
 * Layer: forest — imports seed only.
 */

import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities as TextProviderCapabilities,
} from '@/seed/ai/provider-interface';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';

export class FalAiAdapter implements Provider {
  readonly id: ProviderId = 'fal-ai' as ProviderId;
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl?: string;

  constructor(config: { apiKey: string; label?: string; keyRef?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.label = config.label || 'fal.ai Adapter';
    this.keyRef = config.keyRef || 'platform';
    this.baseUrl = config.baseUrl;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.map((m) => m.content).join('\n');
    const effectiveApiKey = options.apiKey || this.apiKey;
    const effectiveBaseUrl = options.baseUrl || this.baseUrl;
    const fal = new FalImageProvider({
      apiKey: effectiveApiKey,
      keyRef: this.keyRef,
      baseUrl: effectiveBaseUrl,
    });
    const res = await fal.generate({ prompt });

    return {
      content: res.assetRef,
      model: options.model || 'fal-ai/flux-schnell',
      provider: 'fal-ai' as ProviderId,
      usage: { inputTokens: this.countTokens(messages, options.model), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: res.latencyMs,
      raw: { assetRef: res.assetRef, costCents: res.costCents },
    };
  }

  async *stream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const res = await this.chat(messages, options);
    yield { type: 'text_delta', delta: res.content, done: false };
    yield { type: 'text_delta', delta: '', done: true };
  }

  countTokens(messages: ChatMessage[], _model: string): number {
    let total = 0;
    for (const msg of messages) {
      total += Math.ceil(msg.content.length / 4) + 4;
    }
    return Math.max(1, total);
  }

  estimateCost(_messages: ChatMessage[], _model: string, _options?: ChatOptions): number {
    return 0.003;
  }

  getCapabilities(_model: string): TextProviderCapabilities {
    return {
      streaming: false,
      systemRole: false,
      maxOutputTokens: 1024,
      maxInputTokens: 4096,
      functionCalling: false,
      vision: true,
    };
  }
}
