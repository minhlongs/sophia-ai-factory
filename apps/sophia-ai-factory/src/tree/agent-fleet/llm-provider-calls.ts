/**
 * LLM Provider HTTP Calls — Qwen (local Ollama) and Anthropic Claude
 */

export async function callQwen(
  prompt: string,
  baseUrl: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:32b',
        prompt: `You must respond in English only. Never respond in Chinese.\n\n${prompt}`,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
    const data = (await res.json()) as { response?: string };
    return data.response ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export async function callClaude(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.[0]?.text ?? '';
}
