/**
 * @module forest/ai/providers/kling-video-adapter
 * Text provider adapter for Kling Video.
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
import { KlingVideoClient } from './kling-provider';

export class KlingVideoAdapter implements Provider {
  readonly id: ProviderId = 'kling' as ProviderId;
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl?: string;

  constructor(config: { apiKey: string; label?: string; keyRef?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.label = config.label || 'Kling Video Adapter';
    this.keyRef = config.keyRef || 'platform';
    this.baseUrl = config.baseUrl;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.map((m) => m.content).join('\n');
    const effectiveApiKey = options.apiKey || this.apiKey;
    const client = new KlingVideoClient({ apiKey: effectiveApiKey, keyRef: this.keyRef, baseUrl: options.baseUrl || this.baseUrl });
    const res = await client.generateVideo({ prompt });
    return {
      content: res.jobId,
      model: options.model || 'fal-ai/kling-video/v2/master/text-to-video',
      provider: 'kling' as ProviderId,
      usage: { inputTokens: this.countTokens(messages, options.model), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: 100,
      raw: { jobId: res.jobId, status: res.status },
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
    return 0.05;
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
