import { logger } from '@/seed/utils/logger-utility';
import type { AgentGovernanceYaml, PolicyEvaluationRequest } from '@/seed/types/agent-governance';
import { parseAgentGovernanceYaml } from '@/seed/validators/agy-parser';
import { generatePolicyEvaluationDigest } from '@/tree/governance/agy-policy-engine';
import { resolveDb } from './db-helper';

export async function validateAndSaveAgyConfig(
  agencyId: string,
  yamlContent: string,
  dbOverride?: unknown
): Promise<{
  success: boolean;
  data?: {
    configId: string;
    agentId: string;
    parsedConfig: AgentGovernanceYaml;
    sha256: string;
  };
  error?: string;
}> {
  try {
    if (!agencyId || typeof agencyId !== 'string' || !agencyId.trim()) {
      return { success: false, error: 'INVALID_AGENCY_ID: agencyId is required' };
    }

    const parsedConfig = parseAgentGovernanceYaml(yamlContent);

    const dummyReq: PolicyEvaluationRequest = {
      agencyId,
      agentId: parsedConfig.agent.id,
      action: 'config:register',
      requestedAutonomy: parsedConfig.agent.maxAutonomyLevel,
      requestedComputeUnits: parsedConfig.compute.maxComputeUnitsMcu,
    };
    const sha256 = await generatePolicyEvaluationDigest(dummyReq, true, 'CONFIG_REGISTERED');

    const db = resolveDb(dbOverride);
    const configId = `cfg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO agy_governance_configs (
          id, agency_id, agent_id, schema_version, raw_yaml, config_json, sha256_hash, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        configId,
        agencyId.trim(),
        parsedConfig.agent.id,
        parsedConfig.schemaVersion,
        yamlContent,
        JSON.stringify(parsedConfig),
        sha256,
        now,
        now
      )
      .run();

    return {
      success: true,
      data: {
        configId,
        agentId: parsedConfig.agent.id,
        parsedConfig,
        sha256,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[validateAndSaveAgyConfig] Validation or save failed', { error: message, agencyId });
    return { success: false, error: message };
  }
}
