import { describe, expect, it } from 'vitest';
import { openAiStreamToChunks } from './openai-stream-parser';

function streamFrom(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function encoded(...parts: string[]): Uint8Array[] {
  const encoder = new TextEncoder();
  return parts.map((part) => encoder.encode(part));
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of openAiStreamToChunks(body)) chunks.push(chunk);
  return chunks;
}

describe('openAiStreamToChunks', () => {
  it('parses content and reasoning deltas from multiple SSE lines', async () => {
    const body = streamFrom(encoded(
      'data: {"choices":[{"delta":{"content":"Hello","reasoning_content":"plan"}}]}\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n',
    ));
    await expect(collect(body)).resolves.toEqual(['Hello', '<think>plan</think>', ' world']);
    expect(body.locked).toBe(false);
  });

  it('handles frames split across reads and UTF-8 characters split across bytes', async () => {
    const frame = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Chào 👋"}}]}\n');
    const accentIndex = frame.indexOf(0xc3);
    const body = streamFrom([
      frame.slice(0, accentIndex + 1),
      frame.slice(accentIndex + 1, accentIndex + 2),
      frame.slice(accentIndex + 2),
    ]);
    await expect(collect(body)).resolves.toEqual(['Chào 👋']);
  });

  it('ignores comments, event metadata, malformed JSON, and deltas without content', async () => {
    const body = streamFrom(encoded(
      ': keep-alive\nevent: message\ndata: not-json\n',
      'data: {"choices":[]}\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n',
    ));
    await expect(collect(body)).resolves.toEqual(['ok']);
  });

  it('stops at the done sentinel and releases the stream reader', async () => {
    const body = streamFrom(encoded(
      'data: {"choices":[{"delta":{"content":"before"}}]}\ndata: [DONE]\n',
      'data: {"choices":[{"delta":{"content":"after"}}]}\n',
    ));
    await expect(collect(body)).resolves.toEqual(['before']);
    expect(body.locked).toBe(false);
  });

  it('returns no chunks for an empty stream', async () => {
    await expect(collect(streamFrom([]))).resolves.toEqual([]);
  });

  it('flushes a complete final frame that has no trailing newline', async () => {
    const body = streamFrom(encoded('data: {"choices":[{"delta":{"content":"final"}}]}'));
    await expect(collect(body)).resolves.toEqual(['final']);
  });
});
