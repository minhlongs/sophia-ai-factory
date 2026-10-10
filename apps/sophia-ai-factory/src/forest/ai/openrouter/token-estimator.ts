import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';

export function countTokens(messages: ChatMessage[]): number {
  let total = 0;
  const overheadPerMessage = 4;
  for (const msg of messages) {
    const cjkOrVn = (msg.content.match(/[一-鿿぀-ゟ가-힯À-ɏẠ-ỿ]/g) ?? []).length;
    const remaining = msg.content.length - cjkOrVn;
    total += Math.ceil(cjkOrVn + remaining / 4) + overheadPerMessage;
  }
  return total;
}

const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/gpt-4-turbo': { input: 10.0, output: 30.0 },
  'openai/o3': { input: 10.0, output: 40.0 },
  'openai/o4-mini': { input: 1.1, output: 4.4 },
  'anthropic/claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
  'anthropic/claude-haiku-3-5': { input: 0.8, output: 4.0 },
  'google/gemini-2-5-pro': { input: 1.25, output: 5.0 },
  'google/gemini-2-5-flash': { input: 0.15, output: 0.6 },
  'meta-llama/llama-4-maverick': { input: 0.2, output: 0.6 },
  'meta-llama/llama-4-scout': { input: 0.1, output: 0.3 },
  'mistral/mistral-large': { input: 2.0, output: 6.0 },
  'mistral/mistral-small': { input: 0.2, output: 0.6 },
  'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek/deepseek-reasoner': { input: 0.55, output: 2.19 },
};

export function estimateCost(messages: ChatMessage[], model: string, options?: ChatOptions): number {
  const inputTokens = countTokens(messages);
  const maxTokens = options?.maxTokens ?? Math.ceil(inputTokens * 0.5);
  const outputTokens = Math.min(maxTokens, 4096);

  const prices = PRICING_TABLE[model] ?? PRICING_TABLE[model.split('/').pop() ?? ''];
  if (!prices) {
    return 0;
  }

  const cost = (inputTokens / 1000) * prices.input + (outputTokens / 1000) * prices.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
