/**
 * Direct Integration Test Suite: AGY Server Actions & D1 Policy Audit Ledger
 *
 * Exercises Server Actions against an authentic in-memory D1 test fixture
 * executing migration 0436_agent_governance_yaml_and_audit_ledger.sql:
 * - validateAndSaveAgyConfig
 * - evaluateAgentActionAndAudit
 * - queryAgyAuditLedger
 *
 * Layer: land/governance/__tests__
 * Integrity: Direct integration against real SQLite D1 engine (zero facades/mocks).
 *
 * @module land/governance/__tests__/agy-actions.integration.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import type {
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
} from '@/seed/types/agent-governance';
import {
  validateAndSaveAgyConfig,
  evaluateAgentActionAndAudit,
  queryAgyAuditLedger,
} from '../agy-actions';

describe('AGY Server Actions & Audit Ledger (D1 Integration)', () => {
  let db: NodeSqliteD1Database;

  const validYaml = `
schemaVersion: "1.0"
agent:
  id: "agent_vanguard"
  name: "Vanguard Creator"
  role: "content_creator"
  maxAutonomyLevel: "L2"
compute:
  maxTokensPerRun: 8192
  maxComputeUnitsMcu: 50
permissions:
  allow:
    - "video:generate"
    - "video:export"
    - "templates:*"
  deny:
    - "billing:*"
    - "credentials:*"
escalation:
  onQuotaExceeded: "request_approval"
  onDisallowedAction: "escalate_human"
`;

  beforeEach(() => {
    // 1. Initialize authentic in-memory SQLite D1 database
    db = new NodeSqliteD1Database(':memory:');

    // 2. Load and execute authentic 0436 migration
    const migrationPath = path.resolve(
      __dirname,
      '../../../../migrations/0436_agent_governance_yaml_and_audit_ledger.sql',
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migrationSql);

    // 3. Bind to global CF/D1 contexts
    (globalThis as Record<string, unknown>).__env__ = { DB: db };
    (globalThis as Record<string, unknown>).__D1_DB = db;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__env__;
    delete (globalThis as Record<string, unknown>).__D1_DB;
  });

  describe('1. validateAndSaveAgyConfig', () => {
    it('validates and persists AGY YAML into agy_governance_configs', async () => {
      const res = await validateAndSaveAgyConfig('agy_alpha', validYaml, db);
      expect(res.success).toBe(true);
      expect(res.data?.configId).toBeDefined();
      expect(res.data?.agentId).toBe('agent_vanguard');
      expect(res.data?.parsedConfig.compute.maxComputeUnitsMcu).toBe(50);
      expect(res.data?.sha256).toHaveLength(64);

      // Verify row persisted in D1
      const row = await db
        .prepare('SELECT * FROM agy_governance_configs WHERE id = ?')
        .bind(res.data?.configId)
        .first<{ agency_id: string; agent_id: string; is_active: number }>();

      expect(row?.agency_id).toBe('agy_alpha');
      expect(row?.agent_id).toBe('agent_vanguard');
      expect(row?.is_active).toBe(1);
    });

    it('rejects invalid YAML syntax with clean error and without DB write', async () => {
      const brokenYaml = `schemaVersion: 1.0\nagent: [invalid syntax`;
      const res = await validateAndSaveAgyConfig('agy_alpha', brokenYaml, db);
      expect(res.success).toBe(false);
      expect(res.error).toContain('YAML_SYNTAX_ERROR');

      const count = await db
        .prepare('SELECT COUNT(*) as c FROM agy_governance_configs')
        .first<{ c: number }>();
      expect(count?.c).toBe(0);
    });

    it('rejects empty agencyId', async () => {
      const res = await validateAndSaveAgyConfig('', validYaml, db);
      expect(res.success).toBe(false);
      expect(res.error).toContain('INVALID_AGENCY_ID');
    });
  });

  describe('2. evaluateAgentActionAndAudit', () => {
    let policy: AgentGovernanceYaml;

    beforeEach(async () => {
      const res = await validateAndSaveAgyConfig('agy_alpha', validYaml, db);
      if (!res.data?.parsedConfig) throw new Error('Failed to setup test config');
      policy = res.data.parsedConfig;
    });

    it('approves compliant action and records allowed entry in audit ledger', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_alpha',
        agentId: 'agent_vanguard',
        action: 'video:generate',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 25,
      };

      const res = await evaluateAgentActionAndAudit('agy_alpha', policy, req, 'L1', db);
      expect(res.success).toBe(true);
      expect(res.verdict?.allowed).toBe(true);
      expect(res.verdict?.reason).toBe('POLICY_APPROVED');
      expect(res.auditId).toBeDefined();

      // Check D1 audit ledger row
      const auditRow = await db
        .prepare('SELECT * FROM agy_policy_audit_ledger WHERE id = ?')
        .bind(res.auditId)
        .first<{
          agency_id: string;
          agent_id: string;
          allowed: number;
          reason: string;
          evaluation_sha256: string;
        }>();

      expect(auditRow?.agency_id).toBe('agy_alpha');
      expect(auditRow?.agent_id).toBe('agent_vanguard');
      expect(auditRow?.allowed).toBe(1);
      expect(auditRow?.reason).toBe('POLICY_APPROVED');
      expect(auditRow?.evaluation_sha256).toBe(res.verdict?.evaluationSha256);
    });

    it('denies explicitly disallowed action and records escalation in audit ledger', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_alpha',
        agentId: 'agent_vanguard',
        action: 'billing:deduct', // Denied by billing:*
        requestedAutonomy: 'L1',
        requestedComputeUnits: 5,
      };

      const res = await evaluateAgentActionAndAudit('agy_alpha', policy, req, 'L1', db);
      expect(res.success).toBe(true);
      expect(res.verdict?.allowed).toBe(false);
      expect(res.verdict?.reason).toBe('ACTION_EXPLICITLY_DENIED');
      expect(res.verdict?.escalationTriggered).toBe(true);

      const auditRow = await db
        .prepare('SELECT * FROM agy_policy_audit_ledger WHERE id = ?')
        .bind(res.auditId)
        .first<{ allowed: number; escalation_triggered: number; reason: string }>();

      expect(auditRow?.allowed).toBe(0);
      expect(auditRow?.escalation_triggered).toBe(1);
      expect(auditRow?.reason).toBe('ACTION_EXPLICITLY_DENIED');
    });

    it('rejects cross-tenant agency mismatch', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_malicious_attacker',
        agentId: 'agent_vanguard',
        action: 'video:export',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 5,
      };

      const res = await evaluateAgentActionAndAudit('agy_alpha', policy, req, 'L1', db);
      expect(res.success).toBe(false);
      expect(res.error).toContain('AGENCY_MISMATCH');
    });
  });

  describe('3. queryAgyAuditLedger', () => {
    beforeEach(async () => {
      const saveRes = await validateAndSaveAgyConfig('agy_tenant_x', validYaml, db);
      const policy = saveRes.data!.parsedConfig;

      // Seed 3 audit entries
      await evaluateAgentActionAndAudit(
        'agy_tenant_x',
        policy,
        {
          agencyId: 'agy_tenant_x',
          agentId: 'agent_vanguard',
          action: 'video:generate',
          requestedAutonomy: 'L2',
          requestedComputeUnits: 10,
        },
        'L1',
        db,
      );

      await evaluateAgentActionAndAudit(
        'agy_tenant_x',
        policy,
        {
          agencyId: 'agy_tenant_x',
          agentId: 'agent_vanguard',
          action: 'billing:mutate',
          requestedAutonomy: 'L2',
          requestedComputeUnits: 10,
        },
        'L1',
        db,
      );

      // Seed entry for another agency
      await evaluateAgentActionAndAudit(
        'agy_tenant_y',
        policy,
        {
          agencyId: 'agy_tenant_y',
          agentId: 'agent_vanguard',
          action: 'video:export',
          requestedAutonomy: 'L2',
          requestedComputeUnits: 10,
        },
        'L1',
        db,
      );
    });

    it('returns tenant-isolated records for requested agency', async () => {
      const res = await queryAgyAuditLedger('agy_tenant_x', {}, db);
      expect(res.success).toBe(true);
      expect(res.data?.records).toHaveLength(2);
      expect(res.data?.records.every((r) => r.agencyId === 'agy_tenant_x')).toBe(true);
    });

    it('filters by allowed status accurately', async () => {
      const allowedRes = await queryAgyAuditLedger('agy_tenant_x', { allowed: true }, db);
      expect(allowedRes.success).toBe(true);
      expect(allowedRes.data?.records).toHaveLength(1);
      expect(allowedRes.data?.records[0]?.allowed).toBe(true);

      const deniedRes = await queryAgyAuditLedger('agy_tenant_x', { allowed: false }, db);
      expect(deniedRes.success).toBe(true);
      expect(deniedRes.data?.records).toHaveLength(1);
      expect(deniedRes.data?.records[0]?.allowed).toBe(false);
    });

    it('paginates results using limit and offset', async () => {
      const page1 = await queryAgyAuditLedger('agy_tenant_x', { limit: 1, offset: 0 }, db);
      expect(page1.data?.records).toHaveLength(1);

      const page2 = await queryAgyAuditLedger('agy_tenant_x', { limit: 1, offset: 1 }, db);
      expect(page2.data?.records).toHaveLength(1);
      expect(page2.data?.records[0]?.id).not.toBe(page1.data?.records[0]?.id);
    });
  });
});
