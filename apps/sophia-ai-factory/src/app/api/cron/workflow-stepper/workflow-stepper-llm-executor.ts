import { logger } from '@/seed/utils/logger-utility'
import { callWithCache } from '@/land/llm/cache/call-with-cache'
import { callAnthropic } from '@/seed/ai/anthropic-adapter'
import { resolveOrgOwnerUserId } from '@/seed/auth/resolve-org-id'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'

import type { CacheKey, CacheEntry } from '@/land/llm/cache/llm-cache'
import type { WorkflowRow } from '@/seed/db/workflow-repository'

export { callOpenRouterWithByok } from './workflow-stepper-openrouter-executor'

export interface LlmCallResult {
  result: string
  llmDegraded: boolean
  degradeReason?: 'LLM_MISSING_KEY_FALLBACK' | 'LLM_LIVE_FAILED_FALLBACK'
}

/** Call Anthropic via BYOK (falls back to mock on missing key or upstream error). */
export async function callAnthropicWithByok(
  workflow: WorkflowRow,
  model: string,
  stepType: string,
): Promise<LlmCallResult> {
  const ownerUserId = await resolveOrgOwnerUserId(workflow.org_id)
  const anthropicKey = await resolveUserApiKey(
    ownerUserId,
    'anthropic',
    process.env.ANTHROPIC_API_KEY,
  )

  if (!anthropicKey) {
    logger.warn('[workflow-stepper] ANTHROPIC_API_KEY not set, falling back to mock', {
      event: 'llm_anthropic_missing_key', workflowId: workflow.id, model,
    })
    return {
      result: `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`,
      llmDegraded: true,
      degradeReason: 'LLM_MISSING_KEY_FALLBACK',
    }
  }

  const cacheKey: CacheKey = {
    provider: 'anthropic',
    model,
    messages: [{ role: 'user', content: workflow.prompt }],
    orgId: workflow.org_id || 'system',
  }

  try {
    const cacheResult = await callWithCache(cacheKey, async (): Promise<CacheEntry> => {
      const text = await callAnthropic({
        model,
        messages: [{ role: 'user', content: workflow.prompt }],
        apiKey: anthropicKey,
      })
      return { response: text }
    })

    if (cacheResult.response) {
      return { result: cacheResult.response, llmDegraded: false }
    }

    logger.warn('[workflow-stepper] empty LLM response, falling back to mock', {
      event: 'llm_empty_response', workflowId: workflow.id, model,
    })
    return {
      result: `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`,
      llmDegraded: true,
      degradeReason: 'LLM_LIVE_FAILED_FALLBACK',
    }
  } catch (err) {
    logger.warn('[workflow-stepper] live LLM call failed, falling back to mock', { workflowId: workflow.id, model, err })
    return {
      result: `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`,
      llmDegraded: true,
      degradeReason: 'LLM_LIVE_FAILED_FALLBACK',
    }
  }
}
