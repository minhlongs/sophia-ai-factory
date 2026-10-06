/**
 * AGY Policy Engine Unit & Stress Tests (Tree Layer)
 *
 * Validates:
 * - Autonomy level hierarchy gatekeeping (L0 < L1 < L2 < L3 < L4)
 * - Single-run compute limit and token quota enforcement
 * - Case-insensitive permission matching with strict DENY PRECEDENCE over ALLOW
 * - Delimiter bypass prevention
 * - Configurable escalation policy triggers
 * - Web Crypto API deterministic SHA-256 evaluation digests
 *
 * @module tree/governance/__tests__/agy-policy-engine.test
 */

import { describe, it, expect } from 'vitest';
import type {
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
} from '@/seed/types/agent-governance';
import {
  evaluateAgyPolicy,
  evaluateAgyPolicySync,
  matchPermission,
  generatePolicyEvaluationDigest,
  generatePolicyEvaluationDigestSync,
  computeSha256Sync,
  computeEvaluationSha256,
  AUTONOMY_RANKS,
} from '@/tree/governance/agy-policy-engine';

describe('AGY Policy Engine (Tree Layer)', () => {
  const basePolicy: AgentGovernanceYaml = {
    schemaVersion: '1.0',
    agent: {
      id: 'agent_tester',
      name: 'Governance Tester Agent',
      role: 'qa_engineer',
      maxAutonomyLevel: 'L2',
    },
    compute: {
      maxTokensPerRun: 8000,
      maxComputeUnitsMcu: 50,
    },
    permissions: {
      allow: ['video:*', 'ugc:generate', 'report:view'],
      deny: ['video:delete', 'billing:*', 'system:*'],
    },
    escalation: {
      onQuotaExceeded: 'request_approval',
      onDisallowedAction: 'escalate_human',
    },
  };

  describe('1. Autonomy Hierarchy Gatekeeper', () => {
    it('ranks autonomy levels correctly (L0 < L1 < L2 < L3 < L4)', () => {
      expect(AUTONOMY_RANKS.L0).toBeLessThan(AUTONOMY_RANKS.L1);
      expect(AUTONOMY_RANKS.L1).toBeLessThan(AUTONOMY_RANKS.L2);
      expect(AUTONOMY_RANKS.L2).toBeLessThan(AUTONOMY_RANKS.L3);
      expect(AUTONOMY_RANKS.L3).toBeLessThan(AUTONOMY_RANKS.L4);
    });

    it('approves action when requested and required autonomy <= agent max autonomy', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'ugc:generate',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 10,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req, 'L1');
      expect(verdict.allowed).toBe(true);
      expect(verdict.reason).toBe('POLICY_APPROVED');
      expect(verdict.escalationTriggered).toBe(false);
    });

    it('rejects action when requested autonomy exceeds agent max autonomy', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'ugc:generate',
        requestedAutonomy: 'L3', // Agent cap is L2
        requestedComputeUnits: 10,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req, 'L1');
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('AUTONOMY_LEVEL_EXCEEDED');
      expect(verdict.escalationTriggered).toBe(true);
    });

    it('rejects action when required autonomy of action exceeds agent cap', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'ugc:generate',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 10,
      };
      // Action demands L4 autonomy
      const verdict = await evaluateAgyPolicy(basePolicy, req, 'L4');
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('AUTONOMY_LEVEL_EXCEEDED');
      expect(verdict.escalationTriggered).toBe(true);
    });

    it('denies L0 agent requesting any automated execution at L1+', async () => {
      const l0Policy: AgentGovernanceYaml = {
        ...basePolicy,
        agent: { ...basePolicy.agent, maxAutonomyLevel: 'L0' },
      };
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'report:view',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 5,
      };
      const verdict = await evaluateAgyPolicy(l0Policy, req);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('AUTONOMY_LEVEL_EXCEEDED');
    });

    it('approves sovereign L4 agent execution at maximum capability', async () => {
      const l4Policy: AgentGovernanceYaml = {
        ...basePolicy,
        agent: { ...basePolicy.agent, maxAutonomyLevel: 'L4' },
      };
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'report:view',
        requestedAutonomy: 'L4',
        requestedComputeUnits: 20,
      };
      const verdict = await evaluateAgyPolicy(l4Policy, req, 'L4');
      expect(verdict.allowed).toBe(true);
    });
  });

  describe('2. Compute Budget Limits', () => {
    it('approves execution within compute budget (<=50 MCU)', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'report:view',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 50,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req);
      expect(verdict.allowed).toBe(true);
      expect(verdict.reason).toBe('POLICY_APPROVED');
    });

    it('rejects execution exceeding compute budget (>50 MCU)', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'report:view',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 51,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('COMPUTE_LIMIT_EXCEEDED');
      expect(verdict.escalationTriggered).toBe(true); // onQuotaExceeded = request_approval
    });

    it('respects onQuotaExceeded = halt without triggering escalation', async () => {
      const haltPolicy: AgentGovernanceYaml = {
        ...basePolicy,
        escalation: { ...basePolicy.escalation, onQuotaExceeded: 'halt' },
      };
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'report:view',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 60,
      };
      const verdict = await evaluateAgyPolicy(haltPolicy, req);
      expect(verdict.allowed).toBe(false);
      expect(verdict.escalationTriggered).toBe(false);
    });

    it('rejects zero, negative, NaN, or non-finite compute requests', async () => {
      const invalidValues = [0, -10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
      for (const val of invalidValues) {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_test',
          agentId: 'agent_tester',
          action: 'report:view',
          requestedAutonomy: 'L1',
          requestedComputeUnits: val,
        };
        const verdict = await evaluateAgyPolicy(basePolicy, req);
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toBe('COMPUTE_LIMIT_EXCEEDED');
      }
    });
  });

  describe('3. Permission Matcher & Deny Precedence', () => {
    it('matches exact allowed actions', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'ugc:generate',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 10,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req);
      expect(verdict.allowed).toBe(true);
    });

    it('matches wildcard allow patterns (video:*)', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'video:export_high_res',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 10,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req);
      expect(verdict.allowed).toBe(true);
    });

    it('strictly enforces DENY PRECEDENCE over ALLOW (video:delete is inside video:* but explicitly denied)', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'video:delete',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 10,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('ACTION_EXPLICITLY_DENIED');
      expect(verdict.escalationTriggered).toBe(true);
    });

    it('denies unlisted actions with ACTION_NOT_PERMITTED', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'finance:transfer',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 10,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, req);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('ACTION_NOT_PERMITTED');
    });

    it('matches permissions case-insensitively preventing capitalization bypass', async () => {
      const reqMixedCase: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'BiLLing:MuTaTe', // Denied by billing:*
        requestedAutonomy: 'L1',
        requestedComputeUnits: 10,
      };
      const verdict = await evaluateAgyPolicy(basePolicy, reqMixedCase);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('ACTION_EXPLICITLY_DENIED');
    });

    it('prevents delimiter boundary bypass (video:* must not match video_extra:read)', () => {
      expect(matchPermission('video:*', 'video:render')).toBe(true);
      expect(matchPermission('video:*', 'video')).toBe(true);
      expect(matchPermission('video:*', 'video_extra:read')).toBe(false);
      expect(matchPermission('video:*', 'video123')).toBe(false);
    });

    it('supports global wildcard allow (*) while strictly preserving deny rules', async () => {
      const wildcardPolicy: AgentGovernanceYaml = {
        ...basePolicy,
        permissions: { allow: ['*'], deny: ['critical:override'] },
      };
      const okReq: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'arbitrary:action',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 5,
      };
      const deniedReq: PolicyEvaluationRequest = {
        ...okReq,
        action: 'critical:override',
      };
      expect((await evaluateAgyPolicy(wildcardPolicy, okReq)).allowed).toBe(true);
      expect((await evaluateAgyPolicy(wildcardPolicy, deniedReq)).allowed).toBe(false);
    });
  });

  describe('4. Deterministic SHA-256 Digest & Synchronous Engine', () => {
    it('produces identical 64-character hex digests across multiple runs', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'video:render',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 15,
      };
      const d1 = await generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED');
      const d2 = await generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED');
      expect(d1).toHaveLength(64);
      expect(d1).toBe(d2);
    });

    it('changes digest when any parameter or verdict outcome varies', async () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'video:render',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 15,
      };
      const dApproved = await generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED');
      const dDenied = await generatePolicyEvaluationDigest(req, false, 'ACTION_EXPLICITLY_DENIED');
      const dDiffMcu = await generatePolicyEvaluationDigest({ ...req, requestedComputeUnits: 25 }, true, 'POLICY_APPROVED');
      expect(dApproved).not.toBe(dDenied);
      expect(dApproved).not.toBe(dDiffMcu);
    });

    it('matches Web Crypto digest with synchronous pure SHA-256 implementation bit-for-bit', async () => {
      const sampleText = 'agy_vanguard:agent_ugc:ugc:render:L2:25:1:POLICY_APPROVED';
      const webCryptoHash = await computeEvaluationSha256(sampleText);
      const syncHash = computeSha256Sync(sampleText);
      expect(syncHash).toBe(webCryptoHash);
    });

    it('supports synchronous evaluateAgyPolicySync identically', () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_test',
        agentId: 'agent_tester',
        action: 'video:render',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 15,
      };
      const syncVerdict = evaluateAgyPolicySync(basePolicy, req);
      expect(syncVerdict.allowed).toBe(true);
      expect(syncVerdict.reason).toBe('POLICY_APPROVED');
      expect(syncVerdict.evaluationSha256).toHaveLength(64);
    });
  });
});
