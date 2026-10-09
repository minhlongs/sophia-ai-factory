/**
 * @module forest/ai/providers/elevenlabs-provider
 * ElevenLabs audio and text provider adapters.
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
import {
  type IAudioProvider,
  type AudioGenerationInput,
  type AudioGenerationResult,
} from '@/seed/ai/multimodal-provider-interface';
import { generateElevenLabsVoiceover } from '@/seed/ai/elevenlabs-api-client';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import type { Tier } from '@/seed/types';

export class ElevenLabsAudioProvider implements IAudioProvider {
  readonly id = 'elevenlabs';
  readonly label = 'ElevenLabs Audio';
  private readonly apiKey: string;
  private readonly keyRef: string;

  constructor(options: { apiKey: string; keyRef: string }) {
    this.apiKey = options.apiKey;
    this.keyRef = options.keyRef;
  }

  async generateSpeech(
    input: AudioGenerationInput,
    keyRefOverride?: string,
  ): Promise<AudioGenerationResult> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const start = Date.now();
    const res = await generateElevenLabsVoiceover(
      input.text,
      (input.tier as Tier) || 'BASIC',
      this.apiKey,
      input.voiceId,
      { keyRef: effectiveKeyRef },
      effectiveKeyRef,
    );
    const latencyMs = Date.now() - start;
    return {
      audioBuffer: res.audio_buffer ?? new ArrayBuffer(0),
      durationSeconds: res.duration,
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      latencyMs,
      audioUrl: res.audio_url,
    };
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const allowed = shouldAllowRequest('elevenlabs', effectiveKeyRef);
    return { healthy: allowed };
  }
}

export class ElevenLabsTextAdapter implements Provider {
  readonly id: ProviderId = 'elevenlabs';
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;

  constructor(config: { apiKey: string; label?: string; keyRef?: string }) {
    this.apiKey = config.apiKey;
    this.label = config.label || 'ElevenLabs Adapter';
    this.keyRef = config.keyRef || 'platform';
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const start = Date.now();
    const prompt = messages.map((m) => m.content).join('\n');
    if (!prompt.trim()) {
      throw new Error('[ElevenLabsTextAdapter] Prompt content cannot be empty');
    }
    const effectiveApiKey = options.apiKey || this.apiKey;
    const result = await generateElevenLabsVoiceover(
      prompt,
      'BASIC',
      effectiveApiKey,
      undefined,
      { keyRef: this.keyRef },
      this.keyRef,
    );
    const latencyMs = Date.now() - start;

    return {
      content: result.audio_url,
      model: options.model || 'eleven_multilingual_v2',
      provider: 'elevenlabs',
      usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs,
      raw: { audio_url: result.audio_url, duration: result.duration },
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

  estimateCost(messages: ChatMessage[], model: string, _options?: ChatOptions): number {
    const tokens = this.countTokens(messages, model);
    return tokens * 4 * 0.0003;
  }

  getCapabilities(_model: string): TextProviderCapabilities {
    return {
      streaming: false,
      systemRole: false,
      maxOutputTokens: 1024,
      maxInputTokens: 4096,
      functionCalling: false,
      vision: false,
    };
  }
}
