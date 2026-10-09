/**
 * @module forest/ai/providers/generic-adapter
 * Adapters for non-text providers (generic multimodal).
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
import type { ProviderConfig } from './types';

export { FalAiAdapter } from './fal-ai-adapter';
export { ReplicateAdapter } from './replicate-adapter';

export class GenericNonTextAdapter implements Provider {
  readonly id: ProviderId;
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;

  constructor(config: ProviderConfig, apiKey: string, keyRef: string) {
    this.id = config.id as ProviderId;
    this.label = config.label || `${config.id} Adapter`;
    this.apiKey = apiKey;
    this.keyRef = keyRef;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.map((m) => m.content).join('\n');
    return {
      content: `[${this.id}] Multi-modal operation dispatched`,
      model: options.model || (this.id as string),
      provider: this.id,
      usage: { inputTokens: this.countTokens(messages, options.model), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: 10,
      raw: { providerId: this.id, promptLength: prompt.length },
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
    return 0.01;
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

export const KNOWN_NON_TEXT_PROVIDERS = new Set<string>([
  'fal-ai',
  'replicate',
  'kling',
  'kling-video',
  'hunyuan',
  'hunyuan-video',
  'elevenlabs',
  'd-id',
  'heygen',
  'wan',
  'fish-speech',
  'muapi',
]);
