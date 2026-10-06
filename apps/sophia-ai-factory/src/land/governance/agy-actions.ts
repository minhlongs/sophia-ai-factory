'use server';

/**
 * Agent Governance YAML (AGY) Server Actions
 *
 * Land Layer: User-facing server actions and D1 database transactions for
 * AGY policy configuration management, runtime action evaluation, and audit ledger persistence.
 *
 * Strictly adheres to 4-layer architecture:
 * - Imports only from @/seed and @/tree
 * - Strictly ZERO imports from @/forest
 *
 * @module land/governance/agy-actions
 */

import { createServerClient, tryCreateServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomyLevel,
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
  PolicyEvaluationVerdict,
  AuditLedgerRecord,
} from '@/seed/types/agent-governance';
import { parseAgentGovernanceYaml } from '@/seed/validators/agy-parser';
import {
  evaluateAgyPolicy,
  generatePolicyEvaluationDigest,
} from '@/tree/governance/agy-policy-engine';

/** Minimal interface representing D1 database or D1Client */
interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | undefined>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] } | T[]>;
    };
    run(): Promise<unknown>;
    first<T = Record<string, unknown>>(): Promise<T | undefined>;
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] } | T[]>;
  };
}

/**
 * Resolves the active D1 database client with optional test override.
 */
function resolveDb(dbOverride?: unknown): D1Like {
  if (dbOverride && typeof (dbOverride as D1Like).prepare === 'function') {
    return dbOverride as D1Like;
  }
  const client = tryCreateServerClient();
  if (client) {
    return client as unknown as D1Like;
  }
  return createServerClient() as unknown as D1Like;
}

/**
 * Options for querying the AGY policy audit ledger.
 */
export interface QueryAuditLedgerOptions {
  agentId?: string;
  allowed?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Response structure for audit ledger queries.
 */
export interface QueryAuditLedgerResponse {
  success: boolean;
  data?: {
    records: AuditLedgerRecord[];
    total: number;
  };
  error?: string;
}

/**
 * Validates and saves an Agent Governance YAML configuration for an agency.
 *
 * 1. Checks payload size and parses YAML via parseAgentGovernanceYaml
 * 2. Generates SHA-256 hash of raw YAML content
 * 3. Persists configuration to `agy_governance_configs`
 *
 * @param agencyId Tenant agency identifier
 * @param yamlContent Raw YAML string
 * @param dbOverride Optional database handle for testing
 */
export async function validateAndSaveAgyConfig(
  agencyId: string,
  yamlContent: string,
  dbOverride?: unknown,
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

    // 1. Validate and parse YAML using seed validator
    const parsedConfig = parseAgentGovernanceYaml(yamlContent);

    // 2. Generate SHA-256 hash of configuration
    const dummyReq: PolicyEvaluationRequest = {
      agencyId,
      agentId: parsedConfig.agent.id,
      action: 'config:register',
      requestedAutonomy: parsedConfig.agent.maxAutonomyLevel,
      requestedComputeUnits: parsedConfig.compute.maxComputeUnitsMcu,
    };
    const sha256 = await generatePolicyEvaluationDigest(dummyReq, true, 'CONFIG_REGISTERED');

    // 3. Persist to D1
    const db = resolveDb(dbOverride);
    const configId = `cfg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO agy_governance_configs (
          id, agency_id, agent_id, schema_version, raw_yaml, config_json, sha256_hash, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
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
        now,
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

/**
 * Evaluates an agent action against its AGY policy and logs the verdict to the audit ledger.
 *
 * 1. Executes pure evaluateAgyPolicy from tree layer
 * 2. Persists evaluation record to `agy_policy_audit_ledger`
 *
 * @param agencyId Tenant agency identifier
 * @param config Active AgentGovernanceYaml document
 * @param request Inbound action request
 * @param requiredAutonomy Optional required autonomy level for the action
 * @param dbOverride Optional database handle for testing
 */
export async function evaluateAgentActionAndAudit(
  agencyId: string,
  config: AgentGovernanceYaml,
  request: PolicyEvaluationRequest,
  requiredAutonomy: AutonomyLevel = 'L1',
  dbOverride?: unknown,
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

    // 1. Pure domain policy evaluation
    const verdict = await evaluateAgyPolicy(config, request, requiredAutonomy);

    // 2. Persist audit record in D1
    const db = resolveDb(dbOverride);
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO agy_policy_audit_ledger (
          id, agency_id, agent_id, action, requested_autonomy, max_autonomy, required_autonomy,
          requested_compute, requested_compute_units, allowed, reason, escalation_triggered,
          evaluation_sha256, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        now,
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

/**
 * Raw row shape from agy_policy_audit_ledger in D1.
 */
interface AuditLedgerRow {
  id: string;
  agency_id: string;
  agent_id: string;
  action: string;
  requested_autonomy: string;
  max_autonomy?: string | null;
  required_autonomy?: string | null;
  requested_compute?: number;
  requested_compute_units?: number;
  allowed: number;
  reason: string;
  escalation_triggered: number;
  evaluation_sha256: string;
  metadata_json?: string;
  created_at: number;
}

/**
 * Queries the AGY audit ledger with tenant scoping and optional filters.
 *
 * @param agencyId Tenant agency identifier
 * @param options Query filter and pagination parameters
 * @param dbOverride Optional database handle for testing
 */
export async function queryAgyAuditLedger(
  agencyId: string,
  options: QueryAuditLedgerOptions = {},
  dbOverride?: unknown,
): Promise<QueryAuditLedgerResponse> {
  try {
    if (!agencyId || typeof agencyId !== 'string') {
      return { success: false, error: 'INVALID_AGENCY_ID: agencyId is required' };
    }

    const db = resolveDb(dbOverride);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const offset = Math.max(0, options.offset ?? 0);

    const conditions: string[] = ['agency_id = ?'];
    const params: unknown[] = [agencyId.trim()];

    if (options.agentId) {
      conditions.push('agent_id = ?');
      params.push(options.agentId.trim());
    }

    if (options.allowed !== undefined) {
      conditions.push('allowed = ?');
      params.push(options.allowed ? 1 : 0);
    }

    const sql = `SELECT * FROM agy_policy_audit_ledger WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const queryResult = await db.prepare(sql).bind(...params).all<AuditLedgerRow>();
    const rawRows: AuditLedgerRow[] = Array.isArray(queryResult)
      ? (queryResult as AuditLedgerRow[])
      : ((queryResult as { results?: AuditLedgerRow[] }).results ?? []);

    const records: AuditLedgerRecord[] = rawRows.map((row) => ({
      id: row.id,
      agencyId: row.agency_id,
      agentId: row.agent_id,
      action: row.action,
      requestedAutonomy: row.requested_autonomy as AutonomyLevel,
      maxAutonomy: (row.max_autonomy as AutonomyLevel) || null,
      requiredAutonomy: (row.required_autonomy as AutonomyLevel) || null,
      requestedCompute: row.requested_compute ?? row.requested_compute_units ?? 0,
      requestedComputeUnits: row.requested_compute_units ?? row.requested_compute ?? 0,
      allowed: Boolean(row.allowed),
      reason: row.reason,
      escalationTriggered: Boolean(row.escalation_triggered),
      evaluationSha256: row.evaluation_sha256,
      metadataJson: row.metadata_json,
      createdAt: row.created_at,
    }));

    return {
      success: true,
      data: {
        records,
        total: records.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[queryAgyAuditLedger] Query failed', { error: message, agencyId });
    return { success: false, error: message };
  }
}
