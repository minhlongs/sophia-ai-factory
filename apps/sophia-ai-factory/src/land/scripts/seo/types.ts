/**
 * SEO Script Generation Types
 * Layer: LAND (Business Domain Workflows)
 */

export interface GenerateSeoScriptInput {
  userId: string;
  topic: string;
  keywords?: string[];
  language?: 'en' | 'vi';
  /** Target word count band, e.g. {min: 180, max: 260}. Defaults to 180–260. */
  lengthHint?: { min: number; max: number };
  /** Optional model override. */
  model?: string;
}

export interface GenerateSeoScriptResult {
  script: string;
  suggestedTitles: string[];
  seoScore: number; // 0–100
  keywordCoverage: Array<{ keyword: string; hits: number }>;
  wordCount: number;
  model: string;
  source: 'user' | 'platform';
}

export class SeoScriptConfigurationError extends Error {
  code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC';
  constructor(code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC', message: string) {
    super(message);
    this.name = 'SeoScriptConfigurationError';
    this.code = code;
  }
}

export interface ScoreInput {
  body: string;
  title: string;
  keywords: string[];
  primaryKeyword: string | null;
  wordCount: number;
  min: number;
  max: number;
}

export const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
