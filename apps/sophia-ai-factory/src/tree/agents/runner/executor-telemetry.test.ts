import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  reportError: vi.fn(),
  updateTaskResult: vi.fn(async () => {}),
}));

vi.mock('../repository', () => ({
  updateTaskResult: mocks.updateTaskResult,
  appendLog: vi.fn(async () => {}),
}));

vi.mock('@/tree/signals/track', () => ({
  track: mocks.track,
}));

vi.mock('@/seed/observability/telemetry/error-tracker', () => ({
  reportError: mocks.reportError,
}));

vi.mock('@/tree/usage-metering', () => ({
  trackUsage: vi.fn(async () => {}),
}));

import { recordAgentTaskFailure } from './executor-telemetry';

describe('recordAgentTaskFailure — minification-safe error_class telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records explicit err.name when custom Error constructor.name is minified', async () => {
    class n extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'QuotaExceededError';
      }
    }

    const err = new n('Budget cap reached');
    await expect(
      recordAgentTaskFailure({
        err,
        taskId: 'task-1',
        orgId: 'org-1',
        agentRole: 'CEO',
        variant: 'control',
      }),
    ).rejects.toThrow('Budget cap reached');

    expect(mocks.track).toHaveBeenCalledWith(
      expect.any(String),
      'org-1',
      expect.objectContaining({
        task_id: 'task-1',
        error_class: 'QuotaExceededError',
      }),
      'org-1',
    );
  });

  it('falls back to UnknownError when a non-Error value is thrown', async () => {
    await expect(
      recordAgentTaskFailure({
        err: 'unexpected-string-failure',
        taskId: 'task-2',
        orgId: 'org-1',
        agentRole: 'CEO',
        variant: 'control',
      }),
    ).rejects.toBe('unexpected-string-failure');

    expect(mocks.track).toHaveBeenCalledWith(
      expect.any(String),
      'org-1',
      expect.objectContaining({
        task_id: 'task-2',
        error_class: 'UnknownError',
      }),
      'org-1',
    );
  });
});
