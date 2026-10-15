import type { StreamChunk } from '@/seed/ai/provider-interface';

function parseSseDataPayload(line: string): StreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;

  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;

  try {
    const data = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
    };
    const delta = data.choices?.[0]?.delta?.content ?? '';
    const isDone = data.choices?.[0]?.finish_reason != null;
    return { type: 'text_delta', delta, done: isDone };
  } catch {
    return null;
  }
}

/**
 * Reads and decodes an SSE response stream from OpenRouter into StreamChunks.
 */
export async function* readStreamChunks(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamChunk, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let eol: number;

      while ((eol = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 1);
        const chunk = parseSseDataPayload(line);
        if (!chunk) continue;
        yield chunk;
        if (chunk.done) return;
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer.trim()) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
        };
        const delta = data.choices?.[0]?.delta?.content ?? '';
        yield { type: 'text_delta', delta, done: true };
      } catch {
        yield { type: 'text_delta', delta: '', done: true };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
