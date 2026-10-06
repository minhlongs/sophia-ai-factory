import { describe, it, expect } from 'vitest';
import {
  canExecuteCapability,
  executeSwarmTask,
} from '../swarm-orchestrator';
import type { AutonomousScheduleTaskRow } from '@/seed/types/autonomous-engine';

describe('Autonomous Swarm Orchestrator', () => {
  const dummyTask: AutonomousScheduleTaskRow = {
    id: 'task-affiliate-scout',
    tenant_id: 'tenant-test',
    skill_name: 'affiliate-scout',
    capability_name: 'affiliate-scout',
    schedule_type: 'interval',
    schedule_expression: null,
    cron_expression: null,
    interval_seconds: 14400,
    event_trigger: null,
    timezone: 'UTC',
    tier_requirement: 'BASIC',
    priority: 3,
    max_retries: 3,
    enabled: 1,
    last_run_at: null,
    next_run_at: 0,
    run_count: 0,
    failure_count: 0,
    lock_token: null,
    locked_until: null,
    created_at: 0,
    updated_at: 0,
  };

  it('should block execution when MCU is insufficient', () => {
    const check = canExecuteCapability('content-producer', {
      tenantId: 'tenant-test',
      availableMcu: 10, // requires 50
      maxTokensPerCycle: 10000,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Insufficient MCU');
  });

  it('should block execution when cycle token budget is exceeded', () => {
    const check = canExecuteCapability('content-producer', {
      tenantId: 'tenant-test',
      availableMcu: 100,
      maxTokensPerCycle: 2000, // requires 8000
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Cycle token limit exceeded');
  });

  it('should execute task and return telemetry when budget is sufficient', () => {
    const result = executeSwarmTask(dummyTask, {
      tenantId: 'tenant-test',
      availableMcu: 100,
      maxTokensPerCycle: 50000,
    });
    expect(result.success).toBe(true);
    expect(result.mcuConsumed).toBe(10);
    expect(result.tokensUsed).toBe(2000);
    expect(result.actionsTaken.length).toBeGreaterThan(0);
  });
});
