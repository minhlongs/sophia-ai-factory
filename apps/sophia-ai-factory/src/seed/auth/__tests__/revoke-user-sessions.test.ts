/**
 * Unit tests for revoke-user-sessions.ts
 *
 * Verifies session revocation behavior, parameter validation,
 * error handling, and multi-table cleanup (Risk #10).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revokeAllUserSessions } from '../revoke-user-sessions';

function makeMockD1(sessionChanges = 2) {
  const runSessionDelete = vi.fn().mockResolvedValue({ meta: { changes: sessionChanges } });
  const runMfaDelete = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const runUserUpdate = vi.fn().mockResolvedValue({ meta: { changes: 1 } });

  const prepareFn = vi.fn().mockImplementation((sql: string) => {
    let runFn = runSessionDelete;
    if (sql.includes('mfa_pending_sessions')) {
      runFn = runMfaDelete;
    } else if (sql.includes('UPDATE "user"')) {
      runFn = runUserUpdate;
    }
    return {
      bind: vi.fn().mockReturnValue({
        run: runFn,
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    };
  });

  return {
    prepare: prepareFn,
    _runSessionDelete: runSessionDelete,
    _runMfaDelete: runMfaDelete,
    _runUserUpdate: runUserUpdate,
  };
}

describe('revokeAllUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty or invalid userId without throwing', async () => {
    const mockDb = makeMockD1();

    const emptyRes = await revokeAllUserSessions('', mockDb as never);
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.revokedCount).toBe(0);

    const whitespaceRes = await revokeAllUserSessions('   ', mockDb as never);
    expect(whitespaceRes.success).toBe(false);

    const nullRes = await revokeAllUserSessions(null as unknown as string, mockDb as never);
    expect(nullRes.success).toBe(false);

    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('successfully revokes sessions and returns deleted count', async () => {
    const mockDb = makeMockD1(3);

    const result = await revokeAllUserSessions('user-abc-123', mockDb as never);

    expect(result.success).toBe(true);
    expect(result.revokedCount).toBe(3);

    // Verify SQL executions
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM mfa_pending_sessions'),
    );
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'DELETE FROM "session" WHERE userId = ?1',
    );
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'UPDATE "user" SET updatedAt = ?1 WHERE id = ?2',
    );
  });

  it('tolerates failure in non-fatal mfa_pending_sessions cleanup', async () => {
    const runSessionDelete = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const runMfaDelete = vi.fn().mockRejectedValue(new Error('no such table: mfa_pending_sessions'));
    const runUserUpdate = vi.fn().mockResolvedValue({ meta: { changes: 1 } });

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        let runFn = runSessionDelete;
        if (sql.includes('mfa_pending_sessions')) {
          runFn = runMfaDelete;
        } else if (sql.includes('UPDATE "user"')) {
          runFn = runUserUpdate;
        }
        return {
          bind: vi.fn().mockReturnValue({ run: runFn }),
        };
      }),
    };

    const result = await revokeAllUserSessions('user-xyz', mockDb as never);

    expect(result.success).toBe(true);
    expect(result.revokedCount).toBe(1);
    expect(runSessionDelete).toHaveBeenCalled();
  });

  it('handles database connection failure gracefully', async () => {
    const brokenDb = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 connection lost');
      }),
    };

    const result = await revokeAllUserSessions('user-test', brokenDb as never);

    expect(result.success).toBe(false);
    expect(result.revokedCount).toBe(0);
    expect(result.error).toContain('D1 connection lost');
  });
});
