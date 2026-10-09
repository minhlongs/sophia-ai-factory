/**
 * @module forest/ai/providers/hunyuan-video-adapter
 * Text provider adapter for HunyuanVideo Runpod.
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
import { HunyuanVideoClient } from './hunyuan-provider';

export class HunyuanVideoAdapter implements Provider {
  readonly id: ProviderId = 'hunyuan' as ProviderId;
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl?: string;

  constructor(config: { apiKey: string; label?: string; keyRef?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.label = config.label || 'HunyuanVideo Adapter';
    this.keyRef = config.keyRef || 'platform';
    this.baseUrl = config.baseUrl;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.map((m) => m.content).join('\n');
    const effectiveApiKey = options.apiKey || this.apiKey;
    const client = new HunyuanVideoClient({
      apiKey: effectiveApiKey,
      keyRef: this.keyRef,
      baseUrl: options.baseUrl || this.baseUrl,
    });
    const res = await client.renderVideo({
      faceUrl: 'https://placeholder.vault/avatar.png',
      audioUrl: 'https://placeholder.vault/audio.mp3',
      script: prompt,
    });
    return {
      content: res.jobId,
      model: options.model || 'hunyuan-video-1.5',
      provider: 'hunyuan' as ProviderId,
      usage: { inputTokens: this.countTokens(messages, options.model), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: 100,
      raw: { jobId: res.jobId },
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
    return 0.10;
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
