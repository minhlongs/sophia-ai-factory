import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

const mocks = vi.hoisted(() => ({
  resolveOrgId: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({ resolveOrgId: mocks.resolveOrgId }));
vi.mock('@/tree/admin/audit-log', () => ({ writeAuditLog: mocks.writeAuditLog }));

import { bodySchema, executeAdminAction, type AdminActionBody } from './admin-action-handlers';

const dbState = vi.hoisted(() => ({
  first: vi.fn(),
  run: vi.fn(),
  bind: vi.fn(),
  prepare: vi.fn(),
}));

const statement = {
  bind: dbState.bind,
  first: dbState.first,
  run: dbState.run,
};
dbState.bind.mockReturnValue(statement);
dbState.prepare.mockReturnValue(statement);

const db = { prepare: dbState.prepare } as unknown as D1Database;

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbState.prepare.mockReturnValue(statement);
  dbState.bind.mockReturnValue(statement);
  dbState.run.mockResolvedValue({ success: true });
  mocks.resolveOrgId.mockResolvedValue(null);
  mocks.writeAuditLog.mockResolvedValue(undefined);
});

describe('admin action request schema', () => {
  it('accepts valid action payloads and rejects invalid limits and emails', () => {
    expect(bodySchema.safeParse({
      action: 'grant_credits', userEmail: 'user@example.com', amount: 100, reason: 'support credit',
    }).success).toBe(true);
    expect(bodySchema.safeParse({
      action: 'grant_credits', userEmail: 'bad-email', amount: 10001, reason: '',
    }).success).toBe(false);
    expect(bodySchema.safeParse({ action: 'replay_ipn', paymentId: '' }).success).toBe(false);
    expect(bodySchema.safeParse({ action: 'reset_tier', userEmail: 'user@example.com', tier: 'UNKNOWN' }).success).toBe(false);
  });
});

describe('executeAdminAction', () => {
  it('returns 404 when a credit grant target is missing', async () => {
    dbState.first.mockResolvedValueOnce(null);

    const response = await executeAdminAction(db, 'admin-1', {
      action: 'grant_credits', userEmail: 'missing@example.com', amount: 5, reason: 'support credit',
    });

    expect(response.status).toBe(404);
    expect(await responseBody(response)).toEqual({ error: 'User not found' });
    expect(dbState.run).not.toHaveBeenCalled();
  });

  it('adds credits to the latest existing one-time purchase and audits the change', async () => {
    dbState.first
      .mockResolvedValueOnce({ id: 'user-1', email: 'user@example.com' })
      .mockResolvedValueOnce({ id: 'purchase-1', credits_remaining: 20 });

    const response = await executeAdminAction(db, 'admin-1', {
      action: 'grant_credits', userEmail: 'user@example.com', amount: 15, reason: 'support credit',
    });

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({ ok: true, message: 'Granted 15 credits to user@example.com' });
    expect(dbState.run).toHaveBeenCalledOnce();
    expect(dbState.bind).toHaveBeenLastCalledWith(15, 'purchase-1');
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1', actionType: 'grant_credits', targetUserId: 'user-1',
      payload: { amount: 15, reason: 'support credit', purchaseId: 'purchase-1' },
    }));
  });

  it('creates a compensation purchase when no prior purchase exists', async () => {
    dbState.first
      .mockResolvedValueOnce({ id: 'user-2', email: 'new@example.com' })
      .mockResolvedValueOnce(null);

    const response = await executeAdminAction(db, 'admin-1', {
      action: 'grant_credits', userEmail: 'new@example.com', amount: 8, reason: 'service recovery',
    });

    expect(response.status).toBe(200);
    const [compensationId, userId, amount] = dbState.bind.mock.lastCall ?? [];
    expect(compensationId).toMatch(/^[a-f0-9]{32}$/);
    expect(userId).toBe('user-2');
    expect(amount).toBe(8);
    expect(dbState.prepare.mock.calls[2]?.[0]).toContain("'COMPENSATION'");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      targetUserId: 'user-2', payload: { amount: 8, reason: 'service recovery', purchaseId: undefined },
    }));
  });

  it('resets the active subscription tier when the user has an organization', async () => {
    dbState.first.mockResolvedValueOnce({ id: 'user-3', email: 'tier@example.com' });
    mocks.resolveOrgId.mockResolvedValueOnce('org-3');

    const response = await executeAdminAction(db, 'admin-1', {
      action: 'reset_tier', userEmail: 'tier@example.com', tier: 'ENTERPRISE',
    });

    expect(response.status).toBe(200);
    expect(mocks.resolveOrgId).toHaveBeenCalledWith('user-3', db);
    expect(dbState.run).toHaveBeenCalledOnce();
    expect(dbState.bind).toHaveBeenLastCalledWith('enterprise', 'org-3');
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'reset_tier', payload: { newTier: 'ENTERPRISE' },
    }));
  });

  it('audits a tier reset without issuing a subscription update when the user has no organization', async () => {
    dbState.first.mockResolvedValueOnce({ id: 'user-4', email: 'solo@example.com' });

    const response = await executeAdminAction(db, 'admin-1', {
      action: 'reset_tier', userEmail: 'solo@example.com', tier: 'BASIC',
    });

    expect(response.status).toBe(200);
    expect(dbState.run).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
  });

  it.each([
    ['pause_user', 'paused'],
    ['resume_user', 'active'],
  ] as const)('sets the user status for %s', async (action, status) => {
    dbState.first.mockResolvedValueOnce({ id: 'user-5', email: 'status@example.com' });

    const response = await executeAdminAction(db, 'admin-1', {
      action, userEmail: 'status@example.com',
    });

    expect(response.status).toBe(200);
    expect(dbState.bind).toHaveBeenLastCalledWith(status, 'user-5');
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: action, payload: { status },
    }));
  });

  it('returns 404 when replay cannot find a one-time purchase', async () => {
    dbState.first.mockResolvedValueOnce(null);

    const response = await executeAdminAction(db, 'admin-1', { action: 'replay_ipn', paymentId: 'payment-1' });

    expect(response.status).toBe(404);
    expect(dbState.run).not.toHaveBeenCalled();
  });

  it('marks a found purchase paid and writes an audit record', async () => {
    dbState.first.mockResolvedValueOnce({ id: 'purchase-2', user_id: 'user-6', sku: 'PREMIUM', status: 'failed' });

    const response = await executeAdminAction(db, 'admin-1', { action: 'replay_ipn', paymentId: 'payment-2' });

    expect(response.status).toBe(200);
    expect(dbState.bind).toHaveBeenLastCalledWith('purchase-2');
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'replay_ipn', targetUserId: 'user-6',
      payload: { paymentId: 'payment-2', purchaseId: 'purchase-2' },
    }));
  });

  it('returns a bad request response for an action outside the validated union', async () => {
    const invalidAction = { action: 'unknown' } as unknown as AdminActionBody;

    const response = await executeAdminAction(db, 'admin-1', invalidAction);

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ error: 'Unknown action' });
  });
});
