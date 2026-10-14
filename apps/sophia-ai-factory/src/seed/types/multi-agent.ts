/**
 * Multi-Agent Execution Schema types.
 * Defines roles, statuses, and data shapes for supervisor + worker agent coordination.
 *
 * Layer: seed (foundational — no business logic, no side effects)
 */

export * from './multi-agent-session';
export * from './multi-agent-contracts';
export * from './multi-agent-roles';

// Solo Company Orchestrator types — defined in solo-company-types.ts
export type {
  SoloCompanyRole,
  UnifiedAgentRole,
  AgentThought,
  SoloCompanyConfig,
  FeedbackSignal,
} from './solo-company-types';
export { DEFAULT_SOLO_COMPANY_CONFIG } from './solo-company-types';
