/**
 * LLM Router — Multi-provider chat completion client.
 *
 * Supports any OpenAI-compatible API (DeepSeek, Qwen/DashScope, OpenRouter,
 * Fireworks, Together, Ollama, etc.) via 3 env vars:
 *   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
 *
 * Falls back to Anthropic SDK when LLM_BASE_URL is not set.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

// ── Provider detection ───────────────────────────────────────────────────────

type Provider = 'deepseek' | 'dashscope' | 'openrouter' | 'anthropic' | 'openai-compat';

function detectProvider(baseUrl: string): Provider {
  if (baseUrl.includes('deepseek.com')) return 'deepseek';
  if (baseUrl.includes('dashscope')) return 'dashscope';
  if (baseUrl.includes('openrouter.ai')) return 'openrouter';
  return 'openai-compat';
}

function getConfig() {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY
    ?? process.env.DEEPSEEK_API_KEY
    ?? process.env.DASHSCOPE_API_KEY
    ?? process.env.OPENROUTER_API_KEY;
  const model = process.env.LLM_MODEL;

  return { baseUrl, apiKey, model };
}

// ── OpenAI-compatible completion ─────────────────────────────────────────────

async function openaiCompatCompletion(
  opts: ChatCompletionOptions,
  baseUrl: string,
  apiKey: string,
  defaultModel: string,
): Promise<ChatCompletionResult> {
  const start = Date.now();
  const provider = detectProvider(baseUrl);
  const model = opts.model ?? defaultModel;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 2000,
    temperature: opts.temperature ?? 0.7,
  };

  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM ${provider} error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content ?? '';

  return {
    content,
    model: data.model ?? model,
    provider,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - start,
  };
}

// ── Anthropic fallback ───────────────────────────────────────────────────────

async function anthropicCompletion(
  opts: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const start = Date.now();
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemMsg = opts.messages.find(m => m.role === 'system')?.content;
  const nonSystem = opts.messages.filter(m => m.role !== 'system');

  const message = await client.messages.create({
    model: opts.model ?? 'claude-sonnet-4-20250514',
    max_tokens: opts.maxTokens ?? 2000,
    ...(systemMsg ? { system: systemMsg } : {}),
    messages: nonSystem.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  });

  const content = message.content[0]?.type === 'text' ? message.content[0].text : '';

  return {
    content,
    model: message.model,
    provider: 'anthropic',
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    durationMs: Date.now() - start,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a chat completion request to the configured LLM provider.
 * Priority: LLM_BASE_URL (OpenAI-compat) → ANTHROPIC_API_KEY (Anthropic SDK)
 */
export async function chatCompletion(
  opts: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const { baseUrl, apiKey, model } = getConfig();

  // OpenAI-compatible provider (DeepSeek, Qwen, OpenRouter, etc.)
  if (baseUrl && apiKey) {
    return openaiCompatCompletion(opts, baseUrl, apiKey, model ?? 'deepseek-chat');
  }

  // Anthropic fallback
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropicCompletion(opts);
  }

  throw new Error(
    'No LLM configured. Set LLM_BASE_URL + LLM_API_KEY, or ANTHROPIC_API_KEY.',
  );
}

/**
 * Convenience: send a single prompt and get text back.
 */
export async function llmGenerate(
  prompt: string,
  opts?: { system?: string; maxTokens?: number; jsonMode?: boolean },
): Promise<string> {
  const messages: ChatMessage[] = [];
  if (opts?.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });

  const result = await chatCompletion({
    messages,
    maxTokens: opts?.maxTokens,
    jsonMode: opts?.jsonMode,
  });

  return result.content;
}
