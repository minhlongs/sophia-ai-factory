import { NextRequest } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'

export interface OpenRouterChoice {
  message: { role: string; content: string }
}

export interface OpenRouterResponse {
  choices: OpenRouterChoice[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

/** Supported live-fetch providers during dark-launch. */
export const REAL_LLM_PROVIDERS: ReadonlySet<string> = new Set([
  'openrouter',
  'anthropic',
])

/** Get D1 database binding from globalThis env (Cloudflare Worker pattern). */
export function getDb(): D1Database {
  const env = (globalThis as Record<string, unknown>).__env as Record<string, unknown> | undefined
  const db = env?.DB as D1Database | undefined
  if (!db) throw new Error('D1 binding not available')
  return db
}

/** Check if WORKFLOW_REAL_LLM_ENABLED=1 and OPENROUTER_API_KEY is set. */
export function isRealLlmEnabled(): boolean {
  return (
    process.env.WORKFLOW_REAL_LLM_ENABLED === '1' &&
    Boolean(process.env.OPENROUTER_API_KEY)
  )
}
