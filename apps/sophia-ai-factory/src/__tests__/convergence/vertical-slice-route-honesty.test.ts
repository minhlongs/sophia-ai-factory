/**
 * Guards the HTTP surface of /api/convergence/vertical-slice against two
 * false-success paths:
 *
 *  1. A caller choosing a contract mode that labels a synthesized run as
 *     executed and verified.
 *  2. Losing the database and still receiving a successful run from an
 *     ephemeral in-memory ledger.
 */
import { describe, it, expect } from 'vitest';
import {
  handleConvergencePostAction,
  runSliceSchema,
} from '@/app/api/convergence/vertical-slice/route-handlers';

const base = { jobId: 'job_honesty_1', workspaceId: 'ws_alpha' };

describe('vertical-slice contractMode is not caller-claimable', () => {
  it('rejects the modes that assert execution and verification', () => {
    for (const contractMode of ['ENABLED', 'LOCAL_TEST'] as const) {
      const parsed = runSliceSchema.safeParse({ ...base, contractMode });
      expect(parsed.success, contractMode).toBe(false);
    }
  });

  it('keeps accepting the modes that report a simulation as simulated', () => {
    for (const contractMode of ['DISABLED', 'SHADOW'] as const) {
      expect(runSliceSchema.safeParse({ ...base, contractMode }).success).toBe(true);
    }
    expect(runSliceSchema.safeParse(base).success).toBe(true);
  });
});

describe('vertical-slice run fails closed without durable storage', () => {
  it('returns 503 instead of a run backed by an ephemeral ledger', async () => {
    const res = await handleConvergencePostAction(null, 'user_alpha', {
      action: 'run',
      ...base,
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Database unavailable');
  });
});
