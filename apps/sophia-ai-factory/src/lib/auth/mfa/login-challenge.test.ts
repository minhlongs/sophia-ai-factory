/**
 * Unit tests for MFA login-challenge helpers.
 *
 * Coverage:
 *   1. requireMfaIfEnabled — returns required=false when no MFA row exists
 *   2. requireMfaIfEnabled — returns required=false when totp_enabled=0
 *   3. requireMfaIfEnabled — returns required=true when totp_enabled=1
 *   4. markSessionMfaPending — inserts a row with future expires_at
 *   5. isSessionMfaPending — returns true for live pending session
 *   6. isSessionMfaPending — returns false for expired row
 *   7. isSessionMfaPending — returns false when no row exists
 *   8. clearSessionMfaPending — removes the row so subsequent check returns false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- D1 client mock --------------------------------------------------------
// We mock the module so that createServerClient() returns a controllable stub.

const mockDb: {
  rows: Map<string, Record<string, unknown>>;
  mfaRows: Map<string, Record<string, unknown>>;
} = {
  rows: new Map(),   // mfa_pending_sessions
  mfaRows: new Map(), // mfa_secrets
};

function makeDbStub() {
  return {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, val: string) => ({
          single: async () => {
            if (table === 'mfa_secrets') {
              const row = mockDb.mfaRows.get(val);
              return { data: row ?? null };
            }
            const row = mockDb.rows.get(val);
            return { data: row ?? null };
          },
        }),
      }),
      insert: async (data: Record<string, unknown>) => {
        if (table === 'mfa_pending_sessions') {
          mockDb.rows.set(data.session_id as string, data);
        }
        return {};
      },
      delete: () => ({
        eq: (_col: string, val: string) => ({
          // execute immediately
          then: (resolve: () => void) => {
            if (table === 'mfa_pending_sessions') {
              mockDb.rows.delete(val);
            }
            resolve();
            return { catch: () => ({}) };
          },
        }),
        // Allow awaiting delete().eq() directly
        eq_async: async (_col: string, val: string) => {
          if (table === 'mfa_pending_sessions') {
            mockDb.rows.delete(val);
          }
        },
      }),
    }),
  };
}

// Patch delete to be awaitable
function makeDbStubV2() {
  return {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, val: string) => ({
          single: async () => {
            if (table === 'mfa_secrets') {
              return { data: mockDb.mfaRows.get(val) ?? null };
            }
            return { data: mockDb.rows.get(val) ?? null };
          },
        }),
      }),
      insert: async (data: Record<string, unknown>) => {
        if (table === 'mfa_pending_sessions') {
          mockDb.rows.set(data.session_id as string, data);
        }
        return {};
      },
      delete: () => ({
        eq: async (_col: string, val: string) => {
          if (table === 'mfa_pending_sessions') {
            mockDb.rows.delete(val);
          }
          return {};
        },
      }),
    }),
  };
}

vi.mock('@/lib/db/client', () => ({
  createServerClient: () => makeDbStubV2(),
}));

import {
  requireMfaIfEnabled,
  markSessionMfaPending,
  isSessionMfaPending,
  clearSessionMfaPending,
} from './login-challenge';

beforeEach(() => {
  mockDb.rows.clear();
  mockDb.mfaRows.clear();
});

// ---------------------------------------------------------------------------

describe('requireMfaIfEnabled', () => {
  it('returns required=false when no mfa_secrets row exists', async () => {
    const result = await requireMfaIfEnabled('user-no-mfa');
    expect(result.required).toBe(false);
  });

  it('returns required=false when totp_enabled=0', async () => {
    mockDb.mfaRows.set('user-disabled', { totp_enabled: 0 });
    const result = await requireMfaIfEnabled('user-disabled');
    expect(result.required).toBe(false);
  });

  it('returns required=true when totp_enabled=1', async () => {
    mockDb.mfaRows.set('user-enabled', { totp_enabled: 1 });
    const result = await requireMfaIfEnabled('user-enabled');
    expect(result.required).toBe(true);
  });
});

describe('markSessionMfaPending + isSessionMfaPending', () => {
  it('marks session as pending and isSessionMfaPending returns true', async () => {
    await markSessionMfaPending('sess-abc');
    const pending = await isSessionMfaPending('sess-abc');
    expect(pending).toBe(true);
  });

  it('returns false for expired row', async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 100;
    mockDb.rows.set('sess-expired', {
      session_id: 'sess-expired',
      expires_at: pastExpiry,
      created_at: pastExpiry - 600,
    });
    const pending = await isSessionMfaPending('sess-expired');
    expect(pending).toBe(false);
  });

  it('returns false when no row exists', async () => {
    const pending = await isSessionMfaPending('sess-nonexistent');
    expect(pending).toBe(false);
  });
});

describe('clearSessionMfaPending', () => {
  it('removes row so subsequent isSessionMfaPending returns false', async () => {
    await markSessionMfaPending('sess-clear');
    expect(await isSessionMfaPending('sess-clear')).toBe(true);
    await clearSessionMfaPending('sess-clear');
    expect(await isSessionMfaPending('sess-clear')).toBe(false);
  });
});
