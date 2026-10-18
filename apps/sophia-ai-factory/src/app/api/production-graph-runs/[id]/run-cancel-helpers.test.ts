import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyWorkspaceAccess: vi.fn(),
  getRun: vi.fn(),
  cancelProductionGraphRun: vi.fn(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({ verifyWorkspaceAccess: mocks.verifyWorkspaceAccess }));
vi.mock('@/tree/production-graph/repo', () => ({
  getRun: mocks.getRun,
  cancelProductionGraphRun: mocks.cancelProductionGraphRun,
}));

import { executeGuardedRunCancellation, parseCancelBody } from './run-cancel-helpers';

function request(body: string): NextRequest {
  return new NextRequest('http://localhost/api/production-graph-runs/run-1', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

const run = (status: string) => ({ id: 'run-1', workspaceId: 'workspace-1', status });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyWorkspaceAccess.mockResolvedValue(true);
  mocks.getRun.mockResolvedValue({ ok: true, value: run('running') });
  mocks.cancelProductionGraphRun.mockResolvedValue({ ok: true, value: { flipped: true } });
});

describe('parseCancelBody', () => {
  it('accepts an empty body and returns no reason', async () => {
    const result = await parseCancelBody(request(''));

    expect(result).toEqual({ ok: true, reason: undefined });
  });

  it('accepts an optional reason within the schema limit', async () => {
    const result = await parseCancelBody(request(JSON.stringify({ reason: 'operator request' })));

    expect(result).toEqual({ ok: true, reason: 'operator request' });
  });

  it('rejects malformed JSON and a reason that exceeds 500 characters', async () => {
    const malformed = await parseCancelBody(request('{'));
    const tooLong = await parseCancelBody(request(JSON.stringify({ reason: 'x'.repeat(501) })));

    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.response.status).toBe(400);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.response.status).toBe(400);
      expect(await tooLong.response.json()).toMatchObject({ error: 'Invalid request body' });
    }
  });
});

describe('executeGuardedRunCancellation', () => {
  it('returns an internal error when the run lookup fails', async () => {
    mocks.getRun.mockResolvedValueOnce({ ok: false, error: { message: 'database unavailable' } });

    const response = await executeGuardedRunCancellation('run-1', 'user-1');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'database unavailable' });
  });

  it('returns not found when the lookup succeeds without a run', async () => {
    mocks.getRun.mockResolvedValueOnce({ ok: true, value: null });

    const response = await executeGuardedRunCancellation('missing', 'user-1');

    expect(response.status).toBe(404);
  });

  it('denies cancellation when the user lacks workspace access', async () => {
    mocks.verifyWorkspaceAccess.mockResolvedValueOnce(false);

    const response = await executeGuardedRunCancellation('run-1', 'outsider');

    expect(response.status).toBe(403);
    expect(mocks.cancelProductionGraphRun).not.toHaveBeenCalled();
  });

  it('rejects cancellation from a terminal state', async () => {
    mocks.getRun.mockResolvedValueOnce({ ok: true, value: run('completed') });

    const response = await executeGuardedRunCancellation('run-1', 'user-1');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Run is already in a terminal state', status: 'completed' });
  });

  it('returns an internal error when the cancellation write fails', async () => {
    mocks.cancelProductionGraphRun.mockResolvedValueOnce({ ok: false, error: { message: 'write failed' } });

    const response = await executeGuardedRunCancellation('run-1', 'user-1', 'operator request');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'write failed' });
    expect(mocks.cancelProductionGraphRun).toHaveBeenCalledWith('run-1', 'running', 'operator request');
  });

  it('returns a conflict with the reread state if another update wins the race', async () => {
    mocks.cancelProductionGraphRun.mockResolvedValueOnce({ ok: true, value: { flipped: false } });
    mocks.getRun
      .mockResolvedValueOnce({ ok: true, value: run('running') })
      .mockResolvedValueOnce({ ok: true, value: run('completed') });

    const response = await executeGuardedRunCancellation('run-1', 'user-1');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Run state changed during cancellation; retry',
      status: 'completed',
    });
  });

  it('uses unknown when the run cannot be reread after a cancellation race', async () => {
    mocks.cancelProductionGraphRun.mockResolvedValueOnce({ ok: true, value: { flipped: false } });
    mocks.getRun
      .mockResolvedValueOnce({ ok: true, value: run('running') })
      .mockResolvedValueOnce({ ok: false, error: { message: 'database unavailable' } });

    const response = await executeGuardedRunCancellation('run-1', 'user-1');

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ status: 'unknown' });
  });

  it.each(['queued', 'running', 'awaiting_approval'] as const)(
    'cancels a run in %s state',
    async (status) => {
      mocks.getRun.mockResolvedValueOnce({ ok: true, value: run(status) });

      const response = await executeGuardedRunCancellation('run-1', 'user-1', 'operator request');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'cancelled', graphRunId: 'run-1' });
      expect(mocks.cancelProductionGraphRun).toHaveBeenCalledWith('run-1', status, 'operator request');
    },
  );
});
