/**
 * solo-orchestrator-helpers.ts — Prompt builders and response parsers for Solo AI Company CEO.
 * Layer: tree (domain-reusable, imports seed and tree)
 */

import type { AgentTask } from '@/tree/openclaw'
import type {
  AgentThought,
  SoloCompanyRole,
} from '@/seed/types/solo-company-types'
import { logger } from '@/seed/utils/logger-utility'

// Parse CEO JSON response with fallback to minimal valid thought
export function parseCeoResponse(text: string): AgentThought {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const raw = jsonMatch ? jsonMatch[0].replace(/,\s*([}\]])/g, '$1') : text

  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'analysis' in parsed &&
      'plan' in parsed &&
      'delegations' in parsed
    ) {
      return parsed as AgentThought
    }
  } catch {
    // fall through to default
  }

  logger.warn('solo-orchestrator: CEO response not parseable — using fallback thought')
  return {
    analysis: text.slice(0, 500),
    plan: ['Execute mission as described'],
    delegations: [],
  }
}

export function buildCeoPrompt(mission: string, activeRoles: SoloCompanyRole[]): string {
  return `You are the CEO of a Solo AI Company. Analyze the mission and break it into concrete tasks.

Mission: ${mission}

Available specialist roles: ${activeRoles.filter((r) => r !== 'ceo').join(', ')}

Respond with ONLY valid JSON matching this structure:
{
  "analysis": "your analysis of the mission",
  "plan": ["step 1", "step 2", "..."],
  "delegations": [
    { "role": "<role>", "task": "<specific task description>", "context": {} }
  ]
}

Rules:
- Each delegation must use one of the available roles
- Tasks must be concrete and actionable
- Limit delegations to 5 maximum`
}

export function delegationsToAgentTasks(
  delegations: AgentThought['delegations'],
): AgentTask[] {
  return delegations.map((d) => ({
    id: crypto.randomUUID(),
    prompt: d.task,
    context: { role: d.role, ...(d.context ?? {}) },
    tier: 'standard' as const,
  }))
}
