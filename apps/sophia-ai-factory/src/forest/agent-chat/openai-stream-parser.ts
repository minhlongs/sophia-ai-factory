/**
 * Agent Chat — OpenAI-Compatible SSE Stream Parser
 *
 * Converts a fetch Response body (OpenAI-compat streaming) to text chunks.
 *
 * @module forest/agent-chat/openai-stream-parser
 */

function parseOpenAiLine(line: string): { isDone: boolean; chunks: string[] } {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return { isDone: false, chunks: [] };
  const jsonStr = trimmed.slice('data:'.length).trim();
  if (jsonStr === '[DONE]') return { isDone: true, chunks: [] };

  try {
    const parsed = JSON.parse(jsonStr) as {
      choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
    };
    const delta = parsed.choices?.[0]?.delta;
    const chunks: string[] = [];
    if (delta?.content) chunks.push(delta.content);
    if (delta?.reasoning_content) chunks.push(`<think>${delta.reasoning_content}</think>`);
    return { isDone: false, chunks };
  } catch {
    return { isDone: false, chunks: [] };
  }
}

/**
 * Convert a fetch Response body (OpenAI-compat streaming) to text chunks.
 * Parses `data: {"choices":[{"delta":{"content":"..."}}]}` lines.
 */
export async function* openAiStreamToChunks(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let partial = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      partial += decoder.decode(value, { stream: true });

      const lines = partial.split('\n');
      partial = lines.pop() ?? '';

      for (const line of lines) {
        const { isDone, chunks } = parseOpenAiLine(line);
        if (isDone) return;
        for (const chunk of chunks) {
          yield chunk;
        }
      }
    }

    partial += decoder.decode();
    if (partial) {
      const { chunks } = parseOpenAiLine(partial);
      for (const chunk of chunks) {
        yield chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
