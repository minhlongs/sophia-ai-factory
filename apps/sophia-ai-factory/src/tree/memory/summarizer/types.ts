/**
 * Conversation Summarizer Types and Prompts
 *
 * Layer: tree/memory/summarizer
 */

export interface SummaryResult {
  summary: string;
  tokenCount: number;
  messagesSummarized: number;
  usedLLM: boolean;
  topics: string[];
  decisions: string[];
  userPreferences: string[];
  actionItems: string[];
  estimatedTokens: number;
}

export const SUMMARIZATION_SYSTEM_PROMPT = `You are a conversation summarizer. Compress the following chat history into a concise summary that preserves:
- Key topics and decisions made
- User preferences and requirements stated
- Action items or next steps agreed upon
- Important context needed to continue the conversation

Write 3-8 sentences. Be specific — include names, numbers, and concrete choices. Do NOT add information not present in the messages.`;

export const SUMMARIZATION_USER_TEMPLATE = (
  messageCount: number,
): string => `Summarize the following ${messageCount} chat messages:\n\n`;

export const TOPIC_KEYWORDS = [
  'docker', 'kubernetes', 'k8s', 'react', 'next.js', 'nextjs',
  'typescript', 'javascript', 'python', 'node.js', 'nodejs',
  'aws', 'terraform', 'ansible', 'nginx', 'stripe', 'cloudflare',
  'e-commerce', 'ecommerce', 'saas', 'video', 'deployment',
  'ci/cd', 'cicd', 'database', 'auth', 'authentication',
  'api', 'microservices', 'monorepo', 'dark mode', 'blue',
];

export const DECISION_PATTERNS = [
  /(?:let'?s go with|we decided on|going with|selected|chosen|we chose|decided to use|picked|opted for)\s+(.+?)(?:\.|$)/i,
  /(?:decision|chose|selected):\s*(.+?)(?:\.|$)/i,
];

export const PREFERENCE_PATTERNS = [
  /(?:i prefer|i like|i want|prefer|would like)\s+(.+?)(?:\.|$)/i,
];

export const ACTION_PATTERNS = [
  /(?:need to|must|should|remember to|make sure to|don'?t forget to)\s+(.+?)(?:\.|$)/i,
  /(?:i will|we will|let me|i'?ll)\s+(.+?)(?:\.|$)/i,
];

export const MAX_TOPICS = 5;
export const MAX_DECISIONS = 5;
export const MAX_PREFERENCES = 5;
export const MAX_ACTIONS = 5;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  const VI_PATTERN = '[À-ỿ]';
  const CJK_PATTERN = '[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]';
  const vietnameseChars = text.split(new RegExp(VI_PATTERN)).length - 1;
  const cjkChars = text.split(new RegExp(CJK_PATTERN)).length - 1;
  const remaining = text.length - vietnameseChars - cjkChars;

  const tokens = vietnameseChars / 2.5 + cjkChars / 1.3 + remaining / 4.0;
  return Math.ceil(tokens);
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3).trimEnd() + '...';
}

export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const estTokens = estimateTokens(text);
  if (estTokens <= maxTokens) return text;
  const ratio = maxTokens / estTokens;
  const targetChars = Math.floor(text.length * ratio * 0.9);
  return truncate(text, Math.max(targetChars, 20));
}
