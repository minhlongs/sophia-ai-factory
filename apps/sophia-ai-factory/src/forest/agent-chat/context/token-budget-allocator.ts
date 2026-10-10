import { ContextMessage, ContextCheckResult } from './types';

const CHARS_PER_TOKEN = 4;
const PER_MESSAGE_OVERHEAD = 10;
const SYSTEM_PROMPT_OVERHEAD = 100;

export const DEFAULT_CONTEXT_LIMIT = 8192;
export const SUMMARIZE_THRESHOLD = 0.8;
export const MIN_RECENT_MESSAGES = 4;

export function estimateMessageTokens(messages: ContextMessage[]): number {
  const contentTokens = messages.reduce((sum, m) => {
    return sum + Math.ceil(m.content.length / CHARS_PER_TOKEN);
  }, 0);
  const overhead = messages.length * PER_MESSAGE_OVERHEAD;
  const hasSystem = messages.some((m) => m.role === 'system');
  const systemOverhead = hasSystem ? SYSTEM_PROMPT_OVERHEAD : 0;
  return contentTokens + overhead + systemOverhead;
}

export function evaluateContextBudget(
  messages: ContextMessage[],
  systemPrompt: string,
  contextLimit: number,
  summarizeThreshold: number,
  summarizationEnabled: boolean,
): ContextCheckResult {
  const allMessages: ContextMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.filter((m) => m.role !== 'system'),
  ];
  const currentTokens = estimateMessageTokens(allMessages);
  const utilization = currentTokens / contextLimit;

  const result: ContextCheckResult = {
    withinLimit: utilization < 1.0,
    currentTokens,
    limitTokens: contextLimit,
    action: 'none',
  };

  if (utilization >= 1.0) {
    result.action = summarizationEnabled ? 'summarize+trim' : 'trim';
  } else if (utilization >= summarizeThreshold) {
    result.action = summarizationEnabled ? 'summarize+trim' : 'trim';
  }

  return result;
}
