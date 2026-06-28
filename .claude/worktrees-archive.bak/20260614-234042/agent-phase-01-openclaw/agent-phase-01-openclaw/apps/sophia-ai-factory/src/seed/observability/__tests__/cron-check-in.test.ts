/**
 * Unit tests for cron-check-in helper.
 * Mocks @sentry/nextjs to verify check-in lifecycle emissions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock before importing the module under test
vi.mock('@sentry/nextjs', () => ({
  captureCheckIn: vi.fn(),
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '../cron-check-in';

const captureCheckIn = Sentry.captureCheckIn as Mock;
const captureException = Sentry.captureException as Mock;

const FAKE_CHECK_IN_ID = 'fake-check-in-id-abc123';

beforeEach(() => {
  vi.clearAllMocks();
  captureCheckIn.mockReturnValue(FAKE_CHECK_IN_ID);
});

describe('startCronCheckIn', () => {
  it('emits in_progress check-in and returns context with checkInId', () => {
    const ctx = startCronCheckIn('test-cron');

    expect(captureCheckIn).toHaveBeenCalledOnce();
    const [checkInArg] = captureCheckIn.mock.calls[0];
    expect(checkInArg).toMatchObject({
      monitorSlug: 'cron-test-cron',
      status: 'in_progress',
    });
    expect(ctx.checkInId).toBe(FAKE_CHECK_IN_ID);
    expect(typeof ctx.startedAt).toBe('number');
  });

  it('returns null checkInId when Sentry throws', () => {
    captureCheckIn.mockImplementationOnce(() => { throw new Error('sdk down'); });

    const ctx = startCronCheckIn('broken-cron');

    expect(ctx.checkInId).toBeNull();
    // startedAt still set
    expect(ctx.startedAt).toBeGreaterThan(0);
  });
});

describe('finishCronCheckIn', () => {
  it('emits ok check-in with same checkInId and positive duration', () => {
    const ctx = startCronCheckIn('test-cron');
    vi.clearAllMocks(); // reset after start

    finishCronCheckIn(ctx, 'test-cron');

    expect(captureCheckIn).toHaveBeenCalledOnce();
    const [checkInArg] = captureCheckIn.mock.calls[0];
    expect(checkInArg).toMatchObject({
      checkInId: FAKE_CHECK_IN_ID,
      monitorSlug: 'cron-test-cron',
      status: 'ok',
    });
    expect(checkInArg.duration).toBeGreaterThanOrEqual(0);
  });
});

describe('failCronCheckIn', () => {
  it('emits error check-in and captures exception with cron_route tag', () => {
    const ctx = startCronCheckIn('test-cron');
    vi.clearAllMocks();

    const err = new Error('something went wrong');
    failCronCheckIn(ctx, 'test-cron', err);

    expect(captureCheckIn).toHaveBeenCalledOnce();
    const [checkInArg] = captureCheckIn.mock.calls[0];
    expect(checkInArg).toMatchObject({
      checkInId: FAKE_CHECK_IN_ID,
      monitorSlug: 'cron-test-cron',
      status: 'error',
    });

    expect(captureException).toHaveBeenCalledOnce();
    const [excArg, excOpts] = captureException.mock.calls[0];
    expect(excArg).toBe(err);
    expect(excOpts).toMatchObject({
      tags: { cron_route: 'test-cron' },
      level: 'error',
    });
  });

  it('does not throw when Sentry SDK fails on both calls', () => {
    captureCheckIn.mockImplementation(() => { throw new Error('sdk down'); });
    captureException.mockImplementation(() => { throw new Error('sdk down'); });

    const ctx = { checkInId: null, startedAt: Date.now() };
    expect(() => failCronCheckIn(ctx, 'test-cron', new Error('cron err'))).not.toThrow();
  });
});
