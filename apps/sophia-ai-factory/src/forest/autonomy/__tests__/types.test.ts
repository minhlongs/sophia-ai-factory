/**
 * Tests for forest/autonomy level enforcement (Sophia 2027 Phase 1).
 *
 * Covers: requiresApproval for each level 0-4, checkPermission with various
 *         scenarios, getAutonomyLevelDescriptor, INVALID_LEVEL error.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  requiresApproval,
  checkPermission,
  getAutonomyLevelDescriptor,
} from '../types';
import type { AutonomyLevel, AgentAction, AgentDefinition } from '@/seed/types/creative-domain';

const LOW_COST_ACTION: AgentAction = {
  type: 'execution',
  tool: 'content.create',
  parameters: {},
  estimatedCostCents: 100,
  approvalRequired: false,
};

const APPROVAL_REQUIRED_ACTION: AgentAction = {
  type: 'execution',
  tool: 'content.publish',
  parameters: {},
  estimatedCostCents: 0,
  approvalRequired: true,
};

const HIGH_COST_ACTION: AgentAction = {
  type: 'execution',
  tool: 'campaign.launch',
  parameters: {},
  estimatedCostCents: 3000,
  approvalRequired: false,
};

const ZERO_COST_ACTION: AgentAction = {
  type: 'execution',
  tool: 'analytics.read',
  parameters: {},
  estimatedCostCents: 0,
  approvalRequired: false,
};

const AGENT: AgentDefinition = {
  id: 'agent_001',
  name: 'ContentAgent',
  role: 'creator',
  capabilities: ['content.create'],
  permissions: [
    { tool: '*', scopes: ['*'], requiresApproval: false, maxCostCents: 500 },
  ],
  defaultAutonomy: 2,
  maxRetries: 3,
  timeoutMs: 60000,
};

const AGENT_WITH_TOOL_LIMIT: AgentDefinition = {
  id: 'agent_002',
  name: 'BudgetAgent',
  role: 'analyst',
  capabilities: ['analytics.read'],
  permissions: [
    { tool: 'content.create', scopes: ['*'], requiresApproval: true, maxCostCents: 200 },
    { tool: '*', scopes: ['*'], requiresApproval: false, maxCostCents: 500 },
  ],
  defaultAutonomy: 3,
  maxRetries: 3,
  timeoutMs: 60000,
};

const AGENT_NO_PERMS: AgentDefinition = {
  id: 'agent_003',
  name: 'OrphanAgent',
  role: 'unknown',
  capabilities: [],
  permissions: [],
  defaultAutonomy: 4,
  maxRetries: 3,
  timeoutMs: 60000,
};

describe('forest/autonomy', () => {
  // ── requiresApproval ──────────────────────────────────────────────────────

  describe('requiresApproval', () => {
    it('returns true at level 0 regardless of action cost', () => {
      expect(requiresApproval(ZERO_COST_ACTION, 0)).toBe(true);
    });

    it('returns true at level 1 for any executable action', () => {
      expect(requiresApproval(ZERO_COST_ACTION, 1)).toBe(true);
    });

    it('returns false at level 2 for low-cost safe actions', () => {
      expect(requiresApproval(LOW_COST_ACTION, 2)).toBe(false);
    });

    it('returns true at level 2 when action exceeds autoApproveCostCents', () => {
      // level 2 autoApprove = 500, HIGH_COST_ACTION is 3000
      expect(requiresApproval(HIGH_COST_ACTION, 2)).toBe(true);
    });

    it('returns true at level 2 when action.estimatedCostCents > 500', () => {
      const overLimit: AgentAction = { ...LOW_COST_ACTION, estimatedCostCents: 600 };
      expect(requiresApproval(overLimit, 2)).toBe(true);
    });

    it('returns false at level 3 for medium-cost actions under threshold', () => {
      // level 3 autoApprove = 2000
      expect(requiresApproval({ ...HIGH_COST_ACTION, estimatedCostCents: 1500 }, 3)).toBe(false);
    });

    it('returns true at level 3 when action exceeds 2000', () => {
      expect(requiresApproval(HIGH_COST_ACTION, 3)).toBe(true);
    });

    it('returns true at level 4 when action.approvalRequired is true', () => {
      expect(requiresApproval(APPROVAL_REQUIRED_ACTION, 4)).toBe(true);
    });
    it('returns false at level 4 for high cost action without approvalRequired', () => {
      expect(requiresApproval(HIGH_COST_ACTION, 4)).toBe(false);
    });

    it('returns true when action.approvalRequired is true regardless of level', () => {
      expect(requiresApproval(APPROVAL_REQUIRED_ACTION, 4)).toBe(true);
    });
  });

  // ── checkPermission ───────────────────────────────────────────────────────

  describe('checkPermission', () => {
    it('allows when tool matches wildcard permission and cost is within limit', () => {
      const result = checkPermission(AGENT, LOW_COST_ACTION, 2);
      expect(result.allowed).toBe(true);
    });

    it('returns reason when tool is not in permissions list', () => {
      const unknownAction: AgentAction = { ...LOW_COST_ACTION, tool: 'unknown.tool' };
      const result = checkPermission(AGENT_NO_PERMS, unknownAction, 4);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('unknown.tool');
    });

    it('denies when cost exceeds permission maxCostCents', () => {
      // AGENT has maxCostCents: 500 for wildcard; HIGH_COST_ACTION is 3000
      const result = checkPermission(AGENT, HIGH_COST_ACTION, 4);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds permission limit');
    });

    it('respects tool-specific maxCostCents over wildcard', () => {
      // AGENT_WITH_TOOL_LIMIT: content.create maxCostCents=200, wildcard=500
      const expensiveCreate: AgentAction = { ...LOW_COST_ACTION, tool: 'content.create', estimatedCostCents: 300 };
      const result = checkPermission(AGENT_WITH_TOOL_LIMIT, expensiveCreate, 4);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('200 cents');
    });

    it('denies when level 0 or 1 tries to execute', () => {
      const result0 = checkPermission(AGENT, ZERO_COST_ACTION, 0);
      expect(result0.allowed).toBe(false);
      expect(result0.reason).toContain('cannot execute');

      const result1 = checkPermission(AGENT, ZERO_COST_ACTION, 1);
      expect(result1.allowed).toBe(false);
    });

    it('allows at level 4 even with high cost when within permission limit', () => {
      const result = checkPermission(AGENT, { ...LOW_COST_ACTION, estimatedCostCents: 400 }, 4);
      expect(result.allowed).toBe(true);
    });

    it('requires approval when action.approvalRequired is true and level < 4', () => {
      const result = checkPermission(AGENT, APPROVAL_REQUIRED_ACTION, 2);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Human approval required');
    });

    it('denies approval-required action at level 4 with human approval required', () => {
      const result = checkPermission(AGENT, APPROVAL_REQUIRED_ACTION, 4);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Human approval required');
    });
  });

  // ── getAutonomyLevelDescriptor ────────────────────────────────────────────

  describe('getAutonomyLevelDescriptor', () => {
    it('returns correct descriptor for each level 0-4', () => {
      expect(getAutonomyLevelDescriptor(0).name).toBe('OBSERVE_ONLY');
      expect(getAutonomyLevelDescriptor(1).name).toBe('SUGGEST');
      expect(getAutonomyLevelDescriptor(2).name).toBe('EXECUTE_SAFE');
      expect(getAutonomyLevelDescriptor(3).name).toBe('EXECUTE_BROAD');
      expect(getAutonomyLevelDescriptor(4).name).toBe('FULL_AUTONOMY');
    });

    it('has correct canExecute flags', () => {
      expect(getAutonomyLevelDescriptor(0).canExecute).toBe(false);
      expect(getAutonomyLevelDescriptor(1).canExecute).toBe(false);
      expect(getAutonomyLevelDescriptor(2).canExecute).toBe(true);
      expect(getAutonomyLevelDescriptor(3).canExecute).toBe(true);
      expect(getAutonomyLevelDescriptor(4).canExecute).toBe(true);
    });

    it('has correct autoApproveCostCents', () => {
      expect(getAutonomyLevelDescriptor(0).autoApproveCostCents).toBe(0);
      expect(getAutonomyLevelDescriptor(1).autoApproveCostCents).toBe(0);
      expect(getAutonomyLevelDescriptor(2).autoApproveCostCents).toBe(500);
      expect(getAutonomyLevelDescriptor(3).autoApproveCostCents).toBe(2000);
      expect(getAutonomyLevelDescriptor(4).autoApproveCostCents).toBe(Infinity);
    });

    it('throws error for invalid level', () => {
      expect(() => getAutonomyLevelDescriptor(-1 as AutonomyLevel)).toThrow();
      expect(() => getAutonomyLevelDescriptor(5 as AutonomyLevel)).toThrow();
    });
  });
});