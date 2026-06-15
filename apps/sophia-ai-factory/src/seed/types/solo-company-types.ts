/**
 * solo-company-types.ts — Solo Company Orchestrator type definitions.
 * Extends multi-agent.ts with CEO-delegation pattern types.
 * Layer: seed (foundational — no business logic, no side effects)
 */

import type { SOPAgentRole } from './multi-agent'

// Extended roles for Solo Company pattern
export type SoloCompanyRole =
  | 'ceo'
  | 'planner'
  | 'developer'
  | 'tester'
  | 'reviewer'
  | 'ops'
  | 'marketer'
  | 'analyst'

// Combined role type covering both content-pipeline and solo-company agents
export type UnifiedAgentRole = SOPAgentRole | SoloCompanyRole

// Agent think→act→observe loop state — CEO's structured analysis output
export interface AgentThought {
  analysis: string
  plan: string[]
  delegations: Array<{
    role: SoloCompanyRole
    task: string
    context?: Record<string, unknown>
  }>
}

// Solo Company session config
export interface SoloCompanyConfig {
  /** User's mission statement — plain language goal */
  mission: string
  /** Which agent roles to activate for this company */
  activeRoles: SoloCompanyRole[]
  /** LLM tier for CEO reasoning */
  ceoTier: 'lite' | 'standard' | 'max'
  /** Max delegation depth (CEO→specialist→sub-specialist) */
  maxDelegationDepth: number
  /** Enable feedback monitor loop */
  feedbackEnabled: boolean
}

export const DEFAULT_SOLO_COMPANY_CONFIG: Omit<SoloCompanyConfig, 'mission'> = {
  activeRoles: ['ceo', 'planner', 'developer', 'tester', 'reviewer'],
  ceoTier: 'standard',
  maxDelegationDepth: 2,
  feedbackEnabled: true,
}

// Feedback signal from metrics monitoring
export interface FeedbackSignal {
  metric: string
  currentValue: number
  threshold: number
  direction: 'above' | 'below'
  suggestedAction: string
}
