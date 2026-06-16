import { describe, it, expect } from 'vitest';
import type {
  AgentRole,
  AgentTaskStatus,
  AgentTeam,
  Agent,
  AgentTask,
  AgentLog,
  AgentTeamRow,
  AgentRow,
  AgentTaskRow,
  AgentLogRow,
} from './types';

describe('forest/agents/types', () => {
  describe('AgentRole union type', () => {
    const validRoles: AgentRole[] = [
      'CEO',
      'CTO',
      'CSO',
      'CMO',
      'COO',
      'Developer',
      'QA',
      'Ops',
      'Marketing',
    ];

    it('has expected role values', () => {
      expect(validRoles).toHaveLength(9);
      expect(validRoles).toContain('CEO');
      expect(validRoles).toContain('CTO');
      expect(validRoles).toContain('Developer');
    });

    // Removed case-sensitive test: roles have mixed case as per type definition
  });

  describe('AgentTaskStatus union type', () => {
    const validStatuses: AgentTaskStatus[] = [
      'queued',
      'running',
      'completed',
      'failed',
    ];

    it('has expected status values', () => {
      expect(validStatuses).toHaveLength(4);
      expect(validStatuses).toContain('queued');
      expect(validStatuses).toContain('running');
      expect(validStatuses).toContain('completed');
      expect(validStatuses).toContain('failed');
    });

    it('statuses are lowercase', () => {
      expect(validStatuses.every(s => s === s.toLowerCase())).toBe(true);
    });
  });

  describe('AgentTeam interface', () => {
    it('matches expected shape', () => {
      const team: AgentTeam = {
        id: 'team-123',
        orgId: 'org-456',
        name: 'My AI Team',
        config: { maxAgents: 5, budget: 1000 },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      expect(team.id).toBe('team-123');
      expect(team.orgId).toBe('org-456');
      expect(team.name).toBe('My AI Team');
      expect(team.config).toHaveProperty('maxAgents');
      expect(typeof team.createdAt).toBe('string');
    });
  });

  describe('Agent interface', () => {
    it('matches expected shape', () => {
      const agent: Agent = {
        id: 'agent-123',
        teamId: 'team-456',
        role: 'CEO',
        name: 'Executive Assistant',
        systemPrompt: 'You are a helpful AI assistant...',
        model: 'openai/gpt-4o-mini',
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(agent.id).toBe('agent-123');
      expect(agent.teamId).toBe('team-456');
      expect(agent.role).toBe('CEO');
      expect(agent.systemPrompt).toContain('helpful');
      expect(agent.model).toContain('gpt');
      expect(agent.enabled).toBe(true);
    });

    it('accepts all AgentRole values', () => {
      const roles: AgentRole[] = ['CEO', 'CTO', 'CSO', 'CMO', 'COO', 'Developer', 'QA', 'Ops', 'Marketing'];
      roles.forEach(role => {
        const agent: Agent = {
          id: '1',
          teamId: 't1',
          role,
          name: 'Test',
          systemPrompt: 'test',
          model: 'test',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
        };
        expect(agent.role).toBe(role);
      });
    });
  });

  describe('AgentTask interface', () => {
    it('matches expected shape for completed task', () => {
      const task: AgentTask = {
        id: 'task-123',
        orgId: 'org-456',
        agentId: 'agent-789',
        input: 'Summarize Q4 report',
        output: 'Q4 summary: Revenue up 20%...',
        status: 'completed',
        errorMessage: null,
        tokensUsed: 1500,
        costUsd: 0.03,
        createdAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:05:00Z',
      };

      expect(task.status).toBe('completed');
      expect(task.output).toContain('Q4');
      expect(task.tokensUsed).toBe(1500);
      expect(task.completedAt).not.toBeNull();
    });

    it('matches expected shape for failed task', () => {
      const task: AgentTask = {
        id: 'task-456',
        orgId: 'org-456',
        agentId: 'agent-789',
        input: 'Invalid request',
        output: '',
        status: 'failed',
        errorMessage: 'API quota exceeded',
        tokensUsed: 0,
        costUsd: 0,
        createdAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:00:05Z',
      };

      expect(task.status).toBe('failed');
      expect(task.errorMessage).toContain('quota');
      expect(task.tokensUsed).toBe(0);
    });

    it('matches expected shape for queued task', () => {
      const task: AgentTask = {
        id: 'task-789',
        orgId: 'org-456',
        agentId: 'agent-123',
        input: 'New request',
        output: '',
        status: 'queued',
        errorMessage: null,
        tokensUsed: 0,
        costUsd: 0,
        createdAt: '2024-01-01T10:00:00Z',
        completedAt: null,
      };

      expect(task.status).toBe('queued');
      expect(task.completedAt).toBeNull();
      expect(task.tokensUsed).toBe(0);
    });

    it('accepts all status values', () => {
      const statuses: AgentTaskStatus[] = ['queued', 'running', 'completed', 'failed'];
      statuses.forEach(status => {
        const task: AgentTask = {
          id: '1',
          orgId: 'org1',
          agentId: 'a1',
          input: 'test',
          output: status === 'completed' ? 'done' : '',
          status,
          errorMessage: status === 'failed' ? 'error' : null,
          tokensUsed: 0,
          costUsd: 0,
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: ['completed', 'failed'].includes(status) ? '2024-01-01T00:01:00Z' : null,
        };
        expect(task.status).toBe(status);
      });
    });
  });

  describe('AgentLog interface', () => {
    it('matches expected shape', () => {
      const log: AgentLog = {
        id: 'log-123',
        taskId: 'task-456',
        action: 'agent.started',
        payload: { model: 'gpt-4o-mini', temperature: 0.7 },
        createdAt: '2024-01-01T10:00:00Z',
      };

      expect(log.id).toBe('log-123');
      expect(log.taskId).toBe('task-456');
      expect(log.action).toBe('agent.started');
      expect(log.payload).toHaveProperty('model');
      expect(typeof log.createdAt).toBe('string');
    });

    it('accepts empty payload', () => {
      const log: AgentLog = {
        id: 'log-1',
        taskId: 'task-1',
        action: 'system.heartbeat',
        payload: {},
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(log.payload).toEqual({});
    });
  });

  describe('Row interfaces', () => {
    it('AgentTeamRow maps correctly', () => {
      const row: AgentTeamRow = {
        id: 'team-1',
        org_id: 'org-1',
        name: 'Team A',
        config: '{"maxAgents":5}',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(row.id).toBe('team-1');
      expect(row.org_id).toBe('org-1'); // snake_case
      expect(row.config).toBe('{"maxAgents":5}'); // JSON string
    });

    it('AgentRow maps correctly', () => {
      const row: AgentRow = {
        id: 'agent-1',
        team_id: 'team-1',
        role: 'CEO',
        name: 'Assistant',
        system_prompt: 'You are helpful',
        model: 'gpt-4o-mini',
        enabled: 1,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(row.enabled).toBe(1); // number not boolean
      expect(row.system_prompt).toBe('You are helpful');
    });

    it('AgentTaskRow maps correctly', () => {
      const row: AgentTaskRow = {
        id: 'task-1',
        org_id: 'org-1',
        agent_id: 'agent-1',
        input: 'Do task',
        output: 'Done',
        status: 'completed',
        error_message: null,
        tokens_used: 100,
        cost_usd: 0.002,
        created_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:01:00Z',
      };

      expect(row.tokens_used).toBe(100);
      expect(row.cost_usd).toBeGreaterThan(0);
      expect(row.error_message).toBeNull();
    });

    it('AgentLogRow maps correctly', () => {
      const row: AgentLogRow = {
        id: 'log-1',
        task_id: 'task-1',
        action: 'step.completed',
        payload: '{"duration":5}',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(row.payload).toBe('{"duration":5}'); // JSON string
    });
  });
});
