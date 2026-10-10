import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomyLevel,
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
  PolicyEvaluationVerdict,
} from '@/seed/types/agent-governance';
import { evaluateAgyPolicy } from '@/tree/governance/agy-policy-engine';
import { resolveDb } from './db-helper';

export async function evaluateAgentActionAndAudit(
  agencyId: string,
  config: AgentGovernanceYaml,
  request: PolicyEvaluationRequest,
  requiredAutonomy: AutonomyLevel = 'L1',
  dbOverride?: unknown
): Promise<{
  success: boolean;
  verdict?: PolicyEvaluationVerdict;
  auditId?: string;
  error?: string;
}> {
  try {
    if (!agencyId || agencyId !== request.agencyId) {
      return { success: false, error: 'AGENCY_MISMATCH: Request agencyId does not match session' };
    }

    const verdict = await evaluateAgyPolicy(config, request, requiredAutonomy);

    const db = resolveDb(dbOverride);
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO agy_policy_audit_ledger (
          id, agency_id, agent_id, action, requested_autonomy, max_autonomy, required_autonomy,
          requested_compute, requested_compute_units, allowed, reason, escalation_triggered,
          evaluation_sha256, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        request.agencyId,
        request.agentId,
        request.action,
        request.requestedAutonomy,
        config.agent.maxAutonomyLevel,
        verdict.requiredAutonomy,
        request.requestedComputeUnits,
        request.requestedComputeUnits,
        verdict.allowed ? 1 : 0,
        verdict.reason,
        verdict.escalationTriggered ? 1 : 0,
        verdict.evaluationSha256,
        JSON.stringify(request.metadata ?? {}),
        now
      )
      .run();

    return {
      success: true,
      verdict,
      auditId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[evaluateAgentActionAndAudit] Evaluation or audit log failed', { error: message, agencyId });
    return { success: false, error: message };
  }
}
