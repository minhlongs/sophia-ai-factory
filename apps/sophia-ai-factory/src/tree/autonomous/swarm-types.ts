/**
 * Autonomous Swarm Orchestrator Types & Capability Budgets
 * Tree Layer - Deterministic domain types
 *
 * @module tree/autonomous/swarm-types
 */

import type {
  AutonomousCapability,
} from '@/seed/types/autonomous-engine';

import type {
  AgentGovernanceYaml,
  AutonomyLevel,
  PolicyEvaluationVerdict,
} from '@/seed/types/agent-governance';

import type { AffiliateScoutOutput } from './swarm-affiliate-scout';
import type { ContentProducerOutput } from './swarm-content-producer';
import type { AutoPublisherOutput } from './swarm-auto-publisher';

export type ApacMarket = 'VN' | 'TH' | 'ID' | 'SG' | 'MY' | 'JP' | 'KR';

export interface SwarmExecutionContext {
  tenantId: string;
  availableMcu: number;
  maxTokensPerCycle: number;
  openRouterConfigured?: boolean;
  agyConfig?: AgentGovernanceYaml;
  requestedAutonomy?: AutonomyLevel;
  targetMarket?: ApacMarket;
  customPayload?: Record<string, unknown>;
}

export interface SwarmExecutionResult {
  success: boolean;
  capability: AutonomousCapability;
  mcuConsumed: number;
  tokensUsed: number;
  actionsTaken: string[];
  error?: string;
  governanceVerdict?: PolicyEvaluationVerdict;
  escalationTriggered?: boolean;
  details?: AffiliateScoutOutput | ContentProducerOutput | AutoPublisherOutput;
}

export const CAPABILITY_BUDGETS: Record<
  AutonomousCapability,
  {
    mcuRequired: number;
    tokensEstimate: number;
    actionName: string;
    requiredAutonomy: AutonomyLevel;
  }
> = {
  'affiliate-scout': {
    mcuRequired: 10,
    tokensEstimate: 2000,
    actionName: 'affiliate:scrape',
    requiredAutonomy: 'L1',
  },
  'content-producer': {
    mcuRequired: 50,
    tokensEstimate: 8000,
    actionName: 'video:generate',
    requiredAutonomy: 'L2',
  },
  'auto-publisher': {
    mcuRequired: 20,
    tokensEstimate: 3000,
    actionName: 'social:publish',
    requiredAutonomy: 'L3',
  },
};
