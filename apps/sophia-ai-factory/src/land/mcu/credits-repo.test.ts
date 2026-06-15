import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  getD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: mocks.getD1,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { addCredits, deductCredits } from './credits-repo';

function mockRun(changes = 1) {
  const run = vi.fn().mockResolvedValue({ meta: { changes } });
  const bind = vi.fn().mockReturnValue({ run });
  return { bind, run };
}

describe('credits-repo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getD1.mockReturnValue({ prepare: mocks.prepare });
  });

  it('deductCredits uses raw D1 atomic update and writes a debit ledger row', async () => {
    const update = mockRun(1);
    const ledger = mockRun(1);
    mocks.prepare.mockReturnValueOnce(update).mockReturnValueOnce(ledger);

    await expect(deductCredits('user-1', 7, 'mission-1', 'command:test')).resolves.toBe(true);

    expect(mocks.prepare).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE user_mcu_balance'));
    expect(update.bind).toHaveBeenCalledWith(7, 7, 'user-1', 7);
    expect(mocks.prepare).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO mcu_transactions'));
    expect(ledger.bind).toHaveBeenCalledWith('user-1', -7, 'command:test', 'mission-1', JSON.stringify({ auto: true }));
  });

  it('deductCredits returns false and skips ledger when balance update writes zero rows', async () => {
    const update = mockRun(0);
    mocks.prepare.mockReturnValueOnce(update);

    await expect(deductCredits('user-1', 7, 'mission-1', 'command:test')).resolves.toBe(false);

    expect(mocks.prepare).toHaveBeenCalledTimes(1);
  });

  it('addCredits uses raw D1 upsert and writes a credit ledger row', async () => {
    const upsert = mockRun(1);
    const ledger = mockRun(1);
    mocks.prepare.mockReturnValueOnce(upsert).mockReturnValueOnce(ledger);

    await expect(addCredits('user-1', 3, 'reaper_refund', { mission_id: 'mission-1' })).resolves.toBe(true);

    expect(mocks.prepare).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO user_mcu_balance'));
    expect(upsert.bind).toHaveBeenCalledWith('user-1', 3, 3);
    expect(mocks.prepare).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO mcu_transactions'));
    expect(ledger.bind).toHaveBeenCalledWith('user-1', 3, 'reaper_refund', JSON.stringify({ mission_id: 'mission-1' }));
  });

  it('addCredits returns false when raw D1 is unavailable', async () => {
    mocks.getD1.mockReturnValue(null);

    await expect(addCredits('user-1', 3, 'reaper_refund')).resolves.toBe(false);
  });
});
