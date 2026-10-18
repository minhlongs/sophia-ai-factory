/**
 * Model Catalog Builder for Agent Chat LLM Router
 * @module forest/agent-chat/llm-catalog
 */

import type { LlmRoute } from './types';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export interface LlmCatalogEntry {
  model: string;
  provider: LlmRoute['provider'];
  baseUrl: string;
  apiKey: string;
  contextWindow: number;
}

export function buildCatalog(): LlmCatalogEntry[] {
  const catalog: LlmCatalogEntry[] = [];

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    catalog.push({
      model: 'deepseek-reasoner',
      provider: 'deepseek',
      baseUrl: DEEPSEEK_BASE_URL,
      apiKey: deepseekKey,
      contextWindow: 64000,
    });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    catalog.push({
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      baseUrl: ANTHROPIC_BASE_URL,
      apiKey: anthropicKey,
      contextWindow: 200000,
    });
    catalog.push({
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      baseUrl: ANTHROPIC_BASE_URL,
      apiKey: anthropicKey,
      contextWindow: 8192,
    });
  }

  return catalog;
}
