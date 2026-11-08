/**
 * Unit tests for BYOK receipt payload builder & month-to-date spend aggregation.
 * @module tree/byok/__tests__/receipt-payload-builder.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getD1Mock, getUserWorkspaceIdsMock } = vi.hoisted(() => ({
  getD1Mock: vi.fn(),
  getUserWorkspaceIdsMock: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: getD1Mock,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  getUserWorkspaceIds: getUserWorkspaceIdsMock,
}));

import {
  buildReceiptPayload,
  computeUtcMonthStartUnix,
  readMonthlySpendUsd,
} from '../receipt-payload-builder';

interface FakeCall {
  sql: string;
  params: unknown[];
}

function makeFakeD1(options: {
  policyRow?: {
    capability_mask?: string | null;
    monthly_budget_usd?: number | null;
    cooldown_until?: number | null;
  } | null;
  totalCents?: number | string | null;
  throwOnAgentRuns?: boolean;
  throwOnPolicy?: boolean;
}) {
  const calls: FakeCall[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          calls.push({ sql, params });
          return {
            async first<T>() {
              if (sql.includes('FROM user_api_keys')) {
                if (options.throwOnPolicy) throw new Error('d1 policy read failure');
                return (options.policyRow ?? null) as unknown as T | null;
              }
              if (sql.includes('FROM agent_runs')) {
                if (options.throwOnAgentRuns) throw new Error('no such table: agent_runs');
                return { total_cents: options.totalCents ?? 0 } as unknown as T;
              }
              return null;
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

describe('receipt-payload-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes the exact UTC start of the calendar month in Unix seconds', () => {
    // 2026-11-15T14:23:10Z -> 2026-11-01T00:00:00Z
    const midNov = Math.floor(Date.UTC(2026, 10, 15, 14, 23, 10) / 1000);
    const expectedStart = Math.floor(Date.UTC(2026, 10, 1, 0, 0, 0) / 1000);
    expect(computeUtcMonthStartUnix(midNov)).toBe(expectedStart);
  });

  it('aggregates agent_runs spend across the user and all their workspaces', async () => {
    getUserWorkspaceIdsMock.mockResolvedValueOnce(['org_alpha', 'org_beta']);
    const { db, calls } = makeFakeD1({ totalCents: 1875 });
    const nowUnix = Math.floor(Date.UTC(2026, 10, 15, 12, 0, 0) / 1000);

    const spentUsd = await readMonthlySpendUsd(db as never, 'user_1', nowUnix);
    expect(spentUsd).toBe(18.75);

    const spendCall = calls.find((c) => c.sql.includes('FROM agent_runs'));
    expect(spendCall).toBeDefined();
    expect(spendCall?.params).toEqual([
      'user_1',
      'org_alpha',
      'org_beta',
      computeUtcMonthStartUnix(nowUnix),
    ]);
  });

  it('reports real monthSpentUsd in buildReceiptPayload and exhausts budget when cap is reached', async () => {
    getUserWorkspaceIdsMock.mockResolvedValueOnce(['org_alpha']);
    const { db } = makeFakeD1({
      policyRow: {
        capability_mask: 'json_schema,tool_call',
        monthly_budget_usd: 25,
        cooldown_until: null,
      },
      totalCents: 2650, // $26.50 >= $25.00 cap
    });
    getD1Mock.mockResolvedValueOnce(db);

    const nowUnix = Math.floor(Date.UTC(2026, 10, 15, 12, 0, 0) / 1000);
    const { payload, receipt } = await buildReceiptPayload({
      userId: 'user_1',
      provider: 'openrouter',
      maskedKey: 'sk-or-...1234',
      nowUnix,
    });

    expect(payload.budget.monthlyBudgetUsd).toBe(25);
    expect(payload.budget.monthSpentUsd).toBe(26.5);
    expect(payload.budgetStatus).toBe('budget_exhausted');
    expect(receipt.verdict.outcome).toBe('budget_exhausted');
    expect(payload.capabilities).toEqual(['json_schema', 'tool_call']);
  });

  it('fails open with monthSpentUsd = 0 when agent_runs read fails transiently', async () => {
    getUserWorkspaceIdsMock.mockRejectedValueOnce(new Error('org_members timeout'));
    const { db } = makeFakeD1({
      policyRow: {
        capability_mask: 'tool_call',
        monthly_budget_usd: 50,
        cooldown_until: null,
      },
      throwOnAgentRuns: true,
    });
    getD1Mock.mockResolvedValueOnce(db);

    const nowUnix = Math.floor(Date.UTC(2026, 10, 15, 12, 0, 0) / 1000);
    const { payload, receipt } = await buildReceiptPayload({
      userId: 'user_1',
      provider: 'openrouter',
      maskedKey: 'sk-or-...1234',
      nowUnix,
    });

    expect(payload.budget.monthSpentUsd).toBe(0);
    expect(payload.budget.monthlyBudgetUsd).toBe(50);
    expect(payload.budgetStatus).toBe('within_budget');
    expect(receipt.policyStatus).toBe('found');
  });

  it('marks policyStatus as absent when no user_api_keys row exists', async () => {
    const { db } = makeFakeD1({ policyRow: null });
    getD1Mock.mockResolvedValueOnce(db);

    const { receipt } = await buildReceiptPayload({
      userId: 'user_missing',
      provider: 'openrouter',
      maskedKey: '',
      nowUnix: 1700000000,
    });

    expect(receipt.policyStatus).toBe('absent');
    expect(receipt.budget.monthSpentUsd).toBe(0);
  });

  it('marks policyStatus as unreadable when D1 is unavailable', async () => {
    getD1Mock.mockResolvedValueOnce(null);

    const { receipt, payload } = await buildReceiptPayload({
      userId: 'user_1',
      provider: 'openrouter',
      maskedKey: '',
      nowUnix: 1700000000,
    });

    expect(receipt.policyStatus).toBe('unreadable');
    expect(payload.budgetStatus).toBe('no_cap_set');
  });
});
