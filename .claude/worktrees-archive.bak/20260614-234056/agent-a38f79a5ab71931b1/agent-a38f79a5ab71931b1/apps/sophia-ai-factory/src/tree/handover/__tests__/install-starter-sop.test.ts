/**
 * Unit tests for installStarterSop — idempotency and error handling.
 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installStarterSop } from '@/tree/handover/install-starter-sop';

const USER_ID = 'user-test-123';
const TEMPLATE_ID = 'tpl-abc-456';

function makeD1(firstResult: unknown, secondResult: unknown = null) {
  let callCount = 0;
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(firstResult);
      return Promise.resolve(secondResult);
    }),
    run: vi.fn().mockResolvedValue({ success: true }),
  };
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt,
  };
}

describe('installStarterSop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts installation when template exists and not already installed', async () => {
    const db = makeD1(
      { id: TEMPLATE_ID },   // resolveTemplateId
      null,                   // alreadyInstalled → false
    );
    await installStarterSop(db as unknown as D1Database, USER_ID);

    expect(db.prepare).toHaveBeenCalledTimes(3); // 1=template, 2=check, 3=insert
    expect(db._stmt.run).toHaveBeenCalledOnce();
  });

  it('skips insert when template not found in DB (not seeded yet)', async () => {
    const db = makeD1(null); // resolveTemplateId returns null
    await installStarterSop(db as unknown as D1Database, USER_ID);

    // No insert should be attempted
    expect(db._stmt.run).not.toHaveBeenCalled();
  });

  it('skips insert when installation already exists (idempotent)', async () => {
    const db = makeD1(
      { id: TEMPLATE_ID },   // resolveTemplateId
      { id: 'existing-inst' }, // alreadyInstalled → true
    );
    await installStarterSop(db as unknown as D1Database, USER_ID);

    expect(db._stmt.run).not.toHaveBeenCalled();
  });

  it('does not throw when D1 insert fails (non-fatal)', async () => {
    let callCount = 0;
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ id: TEMPLATE_ID });
        return Promise.resolve(null);
      }),
      run: vi.fn().mockRejectedValue(new Error('D1 constraint violation')),
    };
    const db = { prepare: vi.fn().mockReturnValue(stmt) };

    // Should not throw
    await expect(installStarterSop(db as unknown as D1Database, USER_ID)).resolves.toBeUndefined();
  });
});
