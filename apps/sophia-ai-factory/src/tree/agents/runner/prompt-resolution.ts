/**
 * Agent Prompt Resolution & Context Enrichment
 *
 * Layer: tree/agents
 */

import { assignVariant } from '@/tree/signals/ab-experiment';
import { resolvePrompt, experimentName } from '../prompt-variants';
import { executeCeoContext } from '../ceo-executor';
import { createLogger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { AgentRecord } from './validation';

const log = createLogger('tree/agents/runner');

export interface EnrichedPromptResult {
  variant: string;
  enrichedPrompt: string;
}

export async function resolveEnrichedPrompt(
  agent: AgentRecord,
  orgId: string,
  taskInput: string,
): Promise<EnrichedPromptResult> {
  const expName = experimentName(agent.role);
  let variant = 'control';
  try {
    const result = await assignVariant(expName, orgId);
    variant = result.variant;
  } catch {
    // assignVariant already logs — keep 'control'
  }

  const systemPrompt = resolvePrompt(agent.role, variant) || agent.systemPrompt;
  let enrichedPrompt = systemPrompt;

  if (agent.role === 'CEO') {
    try {
      const ceoContext = await executeCeoContext(taskInput, orgId, orgId);
      if (
        ceoContext.campaigns ||
        ceoContext.revenue ||
        ceoContext.intent !== 'general_query'
      ) {
        enrichedPrompt = `${systemPrompt}\n\n===CONTEXT DATA===\n${ceoContext.summary}\n===END CONTEXT DATA===`;
        log.info('[runner] CEO context injected', {
          intent: ceoContext.intent,
          hasCampaigns: (ceoContext.campaigns?.length ?? 0) > 0,
          hasRevenue: !!ceoContext.revenue,
          actionResult: !!ceoContext.actionResult,
        });
      }
    } catch (ctxErr) {
      log.warn(
        '[runner] CEO context injection failed, proceeding without context',
        {
          error: getErrorMessage(ctxErr),
        },
      );
    }
  }

  return { variant, enrichedPrompt };
}
