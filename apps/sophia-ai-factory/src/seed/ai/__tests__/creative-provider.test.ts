/**
 * CreativeProvider unit tests — type guard and interface contract.
 * No DB required — pure type-level checks.
 *
 * @module seed/ai/__tests__/creative-provider
 */

import { describe, it, expect } from 'vitest';
import { isCreativeProvider } from '../creative-provider';
import type { Provider, ChatMessage, ChatResponse, StreamChunk } from '../provider-interface';
import type { CreativeProvider } from '../creative-provider';

// ─── Minimal fake providers ──────────────────────────────────────────────────

function makeBaseProvider(id: string): Provider {
  return {
    id: id as Provider['id'],
    label: id,
    getCapabilities() { return { streaming: false, systemRole: false, maxOutputTokens: 0, maxInputTokens: 0, functionCalling: false, vision: false }; },
    async chat(_messages: ChatMessage[], _opts) {
      return { content: '', model: id, provider: id, stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, latencyMs: 0 } as ChatResponse;
    },
    async *stream(_messages: ChatMessage[], _opts): AsyncGenerator<StreamChunk, void, unknown> {
      yield { delta: '', done: true } as StreamChunk;
    },
    countTokens(_messages, _model) { return 0; },
    estimateCost(_messages, _model, _opts?) { return 0; },
  };
}

function makeCreativeProvider(id: string): CreativeProvider {
  const base = makeBaseProvider(id);
  return {
    ...base,
    async generateScript() {
      return { content: 'script', model: id, provider: id, stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, latencyMs: 0 } as ChatResponse;
    },
    async generateStoryboard() {
      return { content: 'storyboard', model: id, provider: id, stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, latencyMs: 0 } as ChatResponse;
    },
    async generateThumbnail() {
      return { content: 'thumbnail', model: id, provider: id, stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, latencyMs: 0 } as ChatResponse;
    },
  } as CreativeProvider;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isCreativeProvider — type guard', () => {
  it('returns true when all three creative methods present', () => {
    const p = makeCreativeProvider('openrouter');
    expect(isCreativeProvider(p)).toBe(true);
  });

  it('returns false when only chat() is implemented (plain Provider)', () => {
    const p = makeBaseProvider('elevenlabs');
    expect(isCreativeProvider(p)).toBe(false);
  });

  it('returns false when only generateScript is present (partial)', () => {
    const base = makeBaseProvider('partial');
    const p = { ...base, generateScript: () => Promise.resolve({} as ChatResponse) };
    expect(isCreativeProvider(p)).toBe(false);
  });

  it('returns false when only generateStoryboard + generateThumbnail present', () => {
    const base = makeBaseProvider('partial2');
    const p = {
      ...base,
      generateStoryboard: () => Promise.resolve({} as ChatResponse),
      generateThumbnail: () => Promise.resolve({} as ChatResponse),
    };
    expect(isCreativeProvider(p)).toBe(false);
  });

  it('returns false for null/undefined-ish plain object', () => {
    expect(isCreativeProvider({} as unknown as Provider)).toBe(false);
  });
});

describe('CreativeProvider interface — contract', () => {
  it('creative provider exposes all three generation methods as functions', () => {
    const p = makeCreativeProvider('anthropic');
    expect(typeof (p as unknown as Record<string, unknown>).generateScript).toBe('function');
    expect(typeof (p as unknown as Record<string, unknown>).generateStoryboard).toBe('function');
    expect(typeof (p as unknown as Record<string, unknown>).generateThumbnail).toBe('function');
  });

  it('creative provider still implements base Provider chat()', async () => {
    const p = makeCreativeProvider('openrouter');
    const resp = await p.chat([{ role: 'user', content: 'hi' }], { model: 'text', apiKey: '', maxTokens: 10 });
    // chat() delegates to the base provider, which returns empty content
    // (creative methods are generateScript/generateStoryboard/generateThumbnail)
    expect(resp.provider).toBe('openrouter');
    expect(resp.content).toBe('');
  });
});