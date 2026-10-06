/**
 * Unit & Integration Test Suite: Autonomous Operations Cockpit UI Components
 *
 * Validates CockpitStateBadge, CockpitMetrics, CockpitControls,
 * CockpitTasksTable, CockpitRecentRuns, and CockpitDlqPanel.
 *
 * Layer: land/autonomous/__tests__
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../../messages/en.json';

import { CockpitStateBadge } from '../cockpit-state-badge';
import { CockpitMetrics } from '../cockpit-metrics';
import { CockpitControls } from '../cockpit-controls';
import { CockpitTasksTable } from '../cockpit-tasks-table';
import { CockpitRecentRuns } from '../cockpit-recent-runs';
import { CockpitDlqPanel } from '../cockpit-dlq-panel';
import { OperationsCockpit } from '../operations-cockpit';

import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousCycleRunRow,
  AutonomousDeadLetterRow,
} from '@/seed/types/autonomous-engine';

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ autonomous: enMessages.autonomous }}>
      {ui}
    </NextIntlClientProvider>
  );
}

const mockLoopState: AutonomousLoopStateRow = {
  id: 'state-1',
  tenant_id: 'default',
  state: 'IDLE',
  current_cycle_id: null,
  consecutive_failures: 0,
  consciousness_score: 100,
  daily_mcu_consumed: 1200,
  monthly_mcu_consumed: 25000,
  daily_spend_cents: 60,
  monthly_spend_cents: 1500,
  last_heartbeat_at: Math.floor(Date.now() / 1000),
  last_error: null,
  version: 1,
  created_at: Math.floor(Date.now() / 1000),
  updated_at: Math.floor(Date.now() / 1000),
};

const mockTasks: AutonomousScheduleTaskRow[] = [
  {
    id: 'task-scout',
    tenant_id: 'default',
    skill_name: 'affiliate-scout',
    capability_name: 'affiliate-scout',
    schedule_type: 'cron',
    schedule_expression: '0 */4 * * *',
    interval_seconds: null,
    timezone: 'UTC',
    priority: 1,
    tier_requirement: 'BASIC',
    max_retries: 3,
    enabled: 1,
    last_run_at: 100,
    next_run_at: 200,
    run_count: 5,
    failure_count: 0,
    lock_token: null,
    locked_until: null,
    created_at: 100,
    updated_at: 100,
  },
];

const mockRecentRuns: AutonomousCycleRunRow[] = [
  {
    id: 'run-1',
    tenant_id: 'default',
    trigger_type: 'scheduler',
    state_before: 'IDLE',
    state_after: 'IDLE',
    tasks_attempted: 1,
    tasks_succeeded: 1,
    tasks_failed: 0,
    mcu_consumed: 100,
    tokens_consumed: 2000,
    cost_cents: 5,
    consciousness_score: 100,
    duration_ms: 1200,
    error_summary: null,
    created_at: Math.floor(Date.now() / 1000),
  },
];

const mockDlqTasks: AutonomousDeadLetterRow[] = [
  {
    id: 'dlq-1',
    tenant_id: 'default',
    task_id: 'task-failed',
    skill_name: 'content-producer',
    payload_json: '{}',
    error_message: 'Simulated API rate limit reached',
    error_stack: null,
    retry_count: 3,
    max_retries: 3,
    status: 'dead',
    first_failed_at: Math.floor(Date.now() / 1000) - 300,
    last_failed_at: Math.floor(Date.now() / 1000),
    resolved_at: null,
    created_at: Math.floor(Date.now() / 1000),
  },
];

describe('CockpitStateBadge', () => {
  it('renders badge for RUNNING state', () => {
    renderWithIntl(<CockpitStateBadge state="RUNNING" label="Active (Executing Tasks)" />);
    expect(screen.getByText('Active (Executing Tasks)')).toBeDefined();
  });

  it('renders badge for PAUSED state', () => {
    renderWithIntl(<CockpitStateBadge state="PAUSED" label="Paused" />);
    expect(screen.getByText('Paused')).toBeDefined();
  });

  it('renders badge for RECOVERING state', () => {
    renderWithIntl(<CockpitStateBadge state="RECOVERING" label="Self-Healing" />);
    expect(screen.getByText('Self-Healing')).toBeDefined();
  });

  it('renders badge for CIRCUIT_BROKEN state', () => {
    renderWithIntl(<CockpitStateBadge state="CIRCUIT_BROKEN" label="Safety Interlock" />);
    expect(screen.getByText('Safety Interlock')).toBeDefined();
  });

  it('renders badge for IDLE state', () => {
    renderWithIntl(<CockpitStateBadge state="IDLE" label="Standby" />);
    expect(screen.getByText('Standby')).toBeDefined();
  });
});

describe('CockpitMetrics', () => {
  it('renders all 5 metric cards accurately', () => {
    renderWithIntl(
      <CockpitMetrics
        state={mockLoopState}
        tasks={mockTasks}
        recentRuns={mockRecentRuns}
      />
    );

    expect(screen.getByText('Active Swarm Agents')).toBeDefined();
    expect(screen.getByText('Tasks Executed')).toBeDefined();
    expect(screen.getByText('Compute Units Used')).toBeDefined();
    expect(screen.getByText('Success Rate')).toBeDefined();
    expect(screen.getByText('System Health Score')).toBeDefined();
  });
});

describe('CockpitControls', () => {
  it('triggers onStart when start button is clicked in IDLE state', () => {
    const onStart = vi.fn();
    renderWithIntl(
      <CockpitControls
        state="IDLE"
        isPending={false}
        onStart={onStart}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onForceCycle={vi.fn()}
        onResetCircuit={vi.fn()}
        onEmergencyHalt={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    const startBtn = screen.getByText('Activate System');
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('triggers onPause when pause button is clicked in RUNNING state', () => {
    const onPause = vi.fn();
    renderWithIntl(
      <CockpitControls
        state="RUNNING"
        isPending={false}
        onStart={vi.fn()}
        onPause={onPause}
        onResume={vi.fn()}
        onForceCycle={vi.fn()}
        onResetCircuit={vi.fn()}
        onEmergencyHalt={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    const pauseBtn = screen.getByText('Pause System');
    fireEvent.click(pauseBtn);
    expect(onPause).toHaveBeenCalledTimes(1);
  });
});

describe('CockpitTasksTable', () => {
  it('renders scheduled tasks and badges', () => {
    renderWithIntl(<CockpitTasksTable tasks={mockTasks} />);
    expect(screen.getByText('Automated Workflows & Skills')).toBeDefined();
    expect(screen.getByText('Market Intelligence & Partner Scout')).toBeDefined();
    expect(screen.getByText('affiliate-scout')).toBeDefined();
    expect(screen.getByText('(0 */4 * * *)')).toBeDefined();
  });
});

describe('CockpitRecentRuns', () => {
  it('renders recent execution cycle runs', () => {
    renderWithIntl(<CockpitRecentRuns recentRuns={mockRecentRuns} />);
    expect(screen.getByText('Recent Execution Cycles')).toBeDefined();
    expect(screen.getByText(/100 MCU/)).toBeDefined();
  });

  it('renders empty state when no runs exist', () => {
    renderWithIntl(<CockpitRecentRuns recentRuns={[]} />);
    expect(screen.getByText(/No execution cycles recorded/)).toBeDefined();
  });
});

describe('CockpitDlqPanel', () => {
  it('renders DLQ tasks and error messages', () => {
    const onReplayDlq = vi.fn();
    renderWithIntl(
      <CockpitDlqPanel
        dlqTasks={mockDlqTasks}
        isPending={false}
        onReplayDlq={onReplayDlq}
      />
    );
    expect(screen.getByText('Dead-Letter Queue & Issue Recovery')).toBeDefined();
    expect(screen.getByText('Simulated API rate limit reached')).toBeDefined();

    const retryBtn = screen.getByText('Retry Task');
    fireEvent.click(retryBtn);
    expect(onReplayDlq).toHaveBeenCalledWith('dlq-1');
  });

  it('renders empty message when DLQ is clean', () => {
    renderWithIntl(
      <CockpitDlqPanel
        dlqTasks={[]}
        isPending={false}
        onReplayDlq={vi.fn()}
      />
    );
    expect(screen.getByText('No unhandled failures. System running cleanly.')).toBeDefined();
  });
});

describe('OperationsCockpit', () => {
  it('renders the complete cockpit page', () => {
    renderWithIntl(
      <OperationsCockpit
        initialState={mockLoopState}
        initialTasks={mockTasks}
        initialRecentRuns={mockRecentRuns}
        initialDlqTasks={mockDlqTasks}
      />
    );

    expect(screen.getByText('Autonomous Operations Cockpit')).toBeDefined();
    expect(screen.getByText('24/7 Intelligent Automation Engine & Agent Swarm Scheduler')).toBeDefined();
  });
});
