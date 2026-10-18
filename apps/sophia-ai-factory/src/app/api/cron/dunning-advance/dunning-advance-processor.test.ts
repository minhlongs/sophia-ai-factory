import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  processDelinquentRow,
  processPastDueRow,
  runDunningAdvanceBatch,
  type DunningSettingsRow,
} from './dunning-advance-processor';

const mocks = vi.hoisted(() => ({
  transitionDunningState: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/land/billing/dunning/dunning-state-machine', () => ({
  transitionDunningState: mocks.transitionDunningState,
}));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/seed/utils/to-error', () => ({
  toError: (error: unknown) => error instanceof Error ? error : new Error(String(error)),
}));

const now = new Date('2026-10-18T12:00:00.000Z');

function row(overrides: Partial<DunningSettingsRow> = {}): DunningSettingsRow {
  return {
    id: 'setting-1',
    user_id: 'user-1',
    license_nonce: 'license-nonce-1234',
    dunning_state: 'past_due',
    dunning_state_changed_at: '2026-10-15T12:00:00.000Z',
    grace_period_days: 2,
    ...overrides,
  };
}

function makeDb(options: {
  pendingRetries?: unknown[];
  pastDueRows?: DunningSettingsRow[] | null;
  delinquentRows?: DunningSettingsRow[] | null;
  insertError?: Error;
} = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    if (table === 'billing_events') {
      return {
        insert: vi.fn(async (event: Record<string, unknown>) => {
          if (options.insertError) throw options.insertError;
          inserted.push(event);
          return { data: null, error: null };
        }),
      };
    }

    if (table === 'dunning_attempts') {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gt: vi.fn(() => builder),
        limit: vi.fn(async () => ({ data: options.pendingRetries ?? [] })),
      };
      return builder;
    }

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((_column: string, value: string) => Promise.resolve({
        data: value === 'past_due' ? (options.pastDueRows ?? []) : (options.delinquentRows ?? []),
      })),
    };
    return builder;
  });

  return { db: { from } as unknown as Parameters<typeof processPastDueRow>[0], from, inserted };
}

describe('dunning advance row processors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transitionDunningState.mockResolvedValue(undefined);
  });

  it('skips a past-due account before its grace period ends', async () => {
    const { db } = makeDb();
    const due = row({ dunning_state_changed_at: '2026-10-17T12:00:00.000Z', grace_period_days: 2 });

    await expect(processPastDueRow(db, due, now)).resolves.toBe('skipped');

    expect(mocks.transitionDunningState).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });

  it('suspends a past-due account when its grace period has expired exactly at the boundary', async () => {
    const { db, inserted } = makeDb();
    const due = row({ dunning_state_changed_at: '2026-10-16T12:00:00.000Z', grace_period_days: 2 });

    await expect(processPastDueRow(db, due, now)).resolves.toBe('advanced');

    expect(mocks.transitionDunningState).toHaveBeenCalledWith(due.license_nonce, due.user_id, 'suspended');
    expect(inserted).toEqual([expect.objectContaining({
      event_type: 'suspension_started', event_category: 'dunning',
      event_data: { reason: 'grace_period_expired', automated: true },
    })]);
  });

  it('returns an error and logs if the past-due transition or billing insert fails', async () => {
    const due = row();
    const { db } = makeDb();
    mocks.transitionDunningState.mockRejectedValueOnce(new Error('state transition rejected'));

    await expect(processPastDueRow(db, due, now)).resolves.toBe('error');
    expect(mocks.logger.error).toHaveBeenCalledWith(
      '[DunningAdvance] Error advancing past_due row',
      expect.objectContaining({ message: 'state transition rejected' }),
      { license_nonce: due.license_nonce.slice(0, 8) },
    );

    const insertFailure = new Error('billing event insert failed');
    const failingDb = makeDb({ insertError: insertFailure }).db;
    mocks.transitionDunningState.mockResolvedValue(undefined);
    await expect(processPastDueRow(failingDb, due, now)).resolves.toBe('error');
  });

  it('skips delinquent accounts with a pending future retry', async () => {
    const { db } = makeDb({ pendingRetries: [{ next_retry_at: '2026-10-20T12:00:00.000Z' }] });

    await expect(processDelinquentRow(db, row({ dunning_state: 'delinquent' }), now)).resolves.toBe('skipped');

    expect(mocks.transitionDunningState).not.toHaveBeenCalled();
    expect(db.from).toHaveBeenCalledWith('dunning_attempts');
  });

  it('suspends delinquent accounts at the configured grace-period boundary', async () => {
    const { db, inserted } = makeDb();
    const delinquent = row({ dunning_state: 'delinquent', dunning_state_changed_at: '2026-10-16T12:00:00.000Z' });

    await expect(processDelinquentRow(db, delinquent, now)).resolves.toBe('advanced');

    expect(mocks.transitionDunningState).toHaveBeenCalledWith(delinquent.license_nonce, delinquent.user_id, 'suspended');
    expect(inserted[0]).toEqual(expect.objectContaining({
      event_data: { reason: 'delinquent_max_retries_exceeded', automated: true },
    }));
  });

  it('skips delinquent accounts still within grace and reports database failures', async () => {
    const { db } = makeDb();
    const recent = row({ dunning_state: 'delinquent', dunning_state_changed_at: '2026-10-17T12:00:00.000Z' });
    await expect(processDelinquentRow(db, recent, now)).resolves.toBe('skipped');

    const brokenDb = {
      from: vi.fn(() => { throw new Error('attempt query failed'); }),
    } as unknown as Parameters<typeof processDelinquentRow>[0];
    await expect(processDelinquentRow(brokenDb, recent, now)).resolves.toBe('error');
    expect(mocks.logger.error).toHaveBeenCalledWith(
      '[DunningAdvance] Error advancing delinquent row',
      expect.objectContaining({ message: 'attempt query failed' }),
      { license_nonce: recent.license_nonce.slice(0, 8) },
    );
  });

  it('aggregates advanced and failed row outcomes across both state queries', async () => {
    const pastDue = row({ id: 'past-due' });
    const delinquent = row({
      id: 'delinquent', dunning_state: 'delinquent', license_nonce: 'delinquent-license-99',
    });
    const { db, from } = makeDb({ pastDueRows: [pastDue], delinquentRows: [delinquent] });
    mocks.transitionDunningState.mockImplementation(async (nonce: string) => {
      if (nonce === delinquent.license_nonce) throw new Error('delinquent transition failed');
    });

    await expect(runDunningAdvanceBatch(db, now)).resolves.toEqual({ advanced: 1, errors: 1 });

    expect(from).toHaveBeenCalledWith('dunning_settings');
    expect(mocks.logger.error).toHaveBeenCalledTimes(1);
  });

  it('treats null batch query results as empty', async () => {
    const { db } = makeDb({ pastDueRows: null, delinquentRows: null });

    await expect(runDunningAdvanceBatch(db, now)).resolves.toEqual({ advanced: 0, errors: 0 });
    expect(mocks.transitionDunningState).not.toHaveBeenCalled();
  });
});
