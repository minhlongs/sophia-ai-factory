/**
 * solo-orchestrator.ts — CEO agent that breaks a mission into delegated subtasks.
 * Layer: tree (domain-reusable, imports seed only)
 */

import { routeLLM } from '@/lib/openclaw/llm-router'
import { spawnAgentFleet } from '@/lib/openclaw/spawn-agent-fleet'
import type { AgentTask } from '@/lib/openclaw/spawn-agent-fleet'
import type {
  AgentThought,
  SoloCompanyConfig,
  SoloCompanyRole,
} from '@/seed/types/solo-company-types'
import { DEFAULT_SOLO_COMPANY_CONFIG } from '@/seed/types/solo-company-types'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

export interface SoloCompanyResult {
  missionId: string
  mission: string
  thought: AgentThought
  results: Array<{
    role: string
    taskId: string
    success: boolean
    output?: unknown
    error?: string
  }>
  summary: string
  durationMs: number
}

// Parse CEO JSON response with fallback to minimal valid thought
function parseCeoResponse(text: string): AgentThought {
  // Attempt: extract JSON object from surrounding text
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

  // Fallback: minimal valid thought so the fleet still runs
  logger.warn('solo-orchestrator: CEO response not parseable — using fallback thought')
  return {
    analysis: text.slice(0, 500),
    plan: ['Execute mission as described'],
    delegations: [],
  }
}

function buildCeoPrompt(mission: string, activeRoles: SoloCompanyRole[]): string {
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

function delegationsToAgentTasks(
  delegations: AgentThought['delegations'],
): AgentTask[] {
  return delegations.map((d) => ({
    id: crypto.randomUUID(),
    prompt: d.task,
    context: { role: d.role, ...(d.context ?? {}) },
    tier: 'standard' as const,
  }))
}

export async function runSoloCompany(
  mission: string,
  tenantId: string,
  config?: Partial<SoloCompanyConfig>,
): Promise<SoloCompanyResult> {
  const start = Date.now()
  const missionId = crypto.randomUUID()
  const merged: Omit<SoloCompanyConfig, 'mission'> = {
    ...DEFAULT_SOLO_COMPANY_CONFIG,
    ...config,
  }

  logger.info('solo-orchestrator: mission start', { missionId, tenantId })

  // Step 1: CEO analyzes mission
  const ceoPrompt = buildCeoPrompt(mission, merged.activeRoles)
  let thought: AgentThought
  try {
    const llmResult = await routeLLM(merged.ceoTier, ceoPrompt)
    thought = parseCeoResponse(llmResult.text)
  } catch (err) {
    logger.error('solo-orchestrator: CEO LLM call failed', { error: getErrorMessage(err) })
    thought = { analysis: `Error: ${getErrorMessage(err)}`, plan: [], delegations: [] }
  }

  // Step 2: Dispatch specialist agents
  const agentTasks = delegationsToAgentTasks(thought.delegations)
  let fleetResults: Awaited<ReturnType<typeof spawnAgentFleet>> = []
  if (agentTasks.length > 0) {
    try {
      fleetResults = await spawnAgentFleet(agentTasks, { tenantId, parallel: true })
    } catch (err) {
      logger.error('solo-orchestrator: fleet dispatch failed', { error: getErrorMessage(err) })
    }
  }

  // Step 3: Map results back to delegation roles
  const results = fleetResults.map((r, i) => ({
    role: thought.delegations[i]?.role ?? 'unknown',
    taskId: r.taskId,
    success: r.success,
    output: r.output,
    error: r.error,
  }))

  // Step 4: Generate summary
  const successCount = results.filter((r) => r.success).length
  const summarizePrompt = `Mission: ${mission}
Analysis: ${thought.analysis}
Tasks completed: ${successCount}/${results.length}
Plan: ${thought.plan.join(', ')}

Write a 2-3 sentence executive summary of what was accomplished.`

  let summary = `Mission completed: ${successCount}/${results.length} tasks succeeded.`
  try {
    const summaryResult = await routeLLM('lite', summarizePrompt)
    if (summaryResult.text.trim().length > 0) summary = summaryResult.text.trim()
  } catch (err) {
    logger.warn('solo-orchestrator: summary LLM failed, using default', { error: getErrorMessage(err) })
  }

  const durationMs = Date.now() - start
  logger.info('solo-orchestrator: mission complete', { missionId, durationMs, successCount })

  return { missionId, mission, thought, results, summary, durationMs }
}
