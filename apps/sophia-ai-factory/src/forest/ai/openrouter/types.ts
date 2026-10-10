export interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl?: string;
  label?: string;
}

export const SERVICE_NAME = 'openrouter';
export const DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TIMEOUT_MS = 60_000;
