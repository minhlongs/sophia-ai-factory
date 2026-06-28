/**
 * Stream Formatter Tests
 * Validates <think> block splitting across full and chunked inputs.
 */

import { describe, it, expect } from 'vitest';
import { formatStream, serializeSseEvent } from './stream-formatter';
import type { SseEvent } from './types';

async function collect(chunks: string[]): Promise<SseEvent[]> {
  async function* makeIterable() {
    for (const c of chunks) yield c;
  }
  const events: SseEvent[] = [];
  for await (const event of formatStream(makeIterable())) {
    events.push(event);
  }
  return events;
}

describe('formatStream', () => {
  it('emits only token events for plain text', async () => {
    const events = await collect(['Hello, world!']);
    const types = events.map((e) => e.type);
    expect(types).toContain('token');
    expect(types).toContain('done');
    expect(types).not.toContain('reasoning');
    const content = events
      .filter((e): e is Extract<SseEvent, { type: 'token' }> => e.type === 'token')
      .map((e) => e.data)
      .join('');
    expect(content).toBe('Hello, world!');
  });

  it('extracts single <think> block', async () => {
    const events = await collect(['Before<think>reasoning</think>After']);
    const tokens = events.filter((e) => e.type === 'token').map((e) => (e as Extract<SseEvent, {type:'token'}>).data).join('');
    const reasoning = events.filter((e) => e.type === 'reasoning').map((e) => (e as Extract<SseEvent, {type:'reasoning'}>).data).join('');
    expect(tokens).toContain('Before');
    expect(tokens).toContain('After');
    expect(reasoning).toBe('reasoning');
  });

  it('handles multiline <think> blocks', async () => {
    const input = 'Start<think>\nline 1\nline 2\n</think>End';
    const events = await collect([input]);
    const reasoning = events.filter((e) => e.type === 'reasoning').map((e) => (e as Extract<SseEvent, {type:'reasoning'}>).data).join('');
    expect(reasoning).toContain('line 1');
    expect(reasoning).toContain('line 2');
  });

  it('handles <think> split across chunks', async () => {
    // Split mid-tag to test lookahead buffer
    const events = await collect(['Hello<thi', 'nk>inside</thin', 'k>After']);
    const reasoning = events.filter((e) => e.type === 'reasoning').map((e) => (e as Extract<SseEvent, {type:'reasoning'}>).data).join('');
    const tokens = events.filter((e) => e.type === 'token').map((e) => (e as Extract<SseEvent, {type:'token'}>).data).join('');
    expect(reasoning).toBe('inside');
    expect(tokens).toContain('Hello');
    expect(tokens).toContain('After');
  });

  it('always emits done as last event', async () => {
    const events = await collect(['test']);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('emits done for empty input', async () => {
    const events = await collect([]);
    expect(events).toEqual([{ type: 'done' }]);
  });

  it('handles consecutive think blocks', async () => {
    const events = await collect(['<think>r1</think>mid<think>r2</think>end']);
    const reasoning = events.filter((e) => e.type === 'reasoning').map((e) => (e as Extract<SseEvent, {type:'reasoning'}>).data).join('');
    expect(reasoning).toBe('r1r2');
    const tokens = events.filter((e) => e.type === 'token').map((e) => (e as Extract<SseEvent, {type:'token'}>).data).join('');
    expect(tokens).toContain('mid');
    expect(tokens).toContain('end');
  });
});

describe('serializeSseEvent', () => {
  it('formats token event correctly', () => {
    const result = serializeSseEvent({ type: 'token', data: 'hello' });
    expect(result).toBe('data: {"type":"token","data":"hello"}\n\n');
  });

  it('formats done event correctly', () => {
    const result = serializeSseEvent({ type: 'done' });
    expect(result).toBe('data: {"type":"done"}\n\n');
  });
});
