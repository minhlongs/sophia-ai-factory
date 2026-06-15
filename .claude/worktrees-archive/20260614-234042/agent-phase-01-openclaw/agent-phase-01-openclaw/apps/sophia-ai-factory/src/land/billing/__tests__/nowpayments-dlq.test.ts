/**
 * Unit tests: NOWPayments IPN Dead-Letter Queue (DLQ)
 *
 * Verifies the 3 fixes:
 * F1: enqueueDlqEntry() handles UNIQUE(event_id) violations by bumping retry_count
 *     instead of silently dropping or throwing an unhandled error.
 * F2: enqueueDlqEntry() requires caller-supplied db as first arg — no implicit globals.
 * F3: resolveDlqEntry() and getStaleDlqEntries() operate correctly on injected clients.
 */

import { describe, it, expect } from 'vitest';

import type { D1LikeClient } from '../nowpayments-ipn-dead-letter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unique-violation error returned by D1 on duplicate PK. */
function uniqueViolation() {
  const err: Record<string, unknown> = { message: 'UNIQUE violation' };
  (err as Record<string, unknown>).code = '23505';
  return err;
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------
// Build a fluent mock that matches the D1Like interface:
//
//   db.from(tbl).insert(row)           -> Promise<{error}>
//   db.from(tbl).update(obj)           -> { eq(col,val): Thenable<{count,error}> }
//   db.from(tbl).select(...).eq(...)   -> Thenable<{data,error,count}>
//   db.from(tbl).delete().eq(...)      -> Thenable<{count,error}>
//
// A Thenable is any object with a `.then(fn)` method, which makes it
// awaitable.  The source code does `await db.from(t).update({...}).eq(...).eq(...)`
// and destructures `{ count, error }` — so the awaited value must have
// both fields.

type Thenable<T> = { then: (fn: (v: T) => unknown) => Thenable<T> };

function makeThenable<T>(value: T): Thenable<T> {
  return {
    then: (fn: (v: T) => unknown) => {
      // Synchronously drive the promise so vitest sees no residual promise.
      Promise.resolve(fn(value)).catch(() => {});
      return makeThenable(value);
    },
  };
}

function resolvedThenable(value: Record<string, unknown>) {
  return makeThenable(value);
}

function failedThenable(error: Record<string, unknown>) {
  return makeThenable({ count: 0, error });
}

/** Minimal in-memory D1-like client.  Accepts hook functions to drive behavior. */
function buildD1Client(opts?: {
  insertResult?: Record<string, unknown>;
  updateResult?: Record<string, unknown>;
  selectSingleResult?: { data: Record<string, unknown> | null; error: Record<string, unknown> | null };
  selectOrderResult?: { data: unknown[]; error: null };
  updateLog?: Array<Record<string, unknown>>;
  selectLog?: Array<{ columns: string }>;
  onDelete?: () => void;
}): D1LikeClient {
  const updateLog: Array<Record<string, unknown>> = opts?.updateLog ?? [];
  const selectLog: Array<{ columns: string }> = opts?.selectLog ?? [];

  // D1 `insert()` returns `{ error }`. Source reads `const { error } = await insert(...)`,
  // so we always wrap the caller-supplied value as the `error` field.
  const insertResult = { error: opts?.insertResult ?? null } as Record<string, unknown>;
  const updateBase: Record<string, unknown> = opts?.updateResult ?? { count: 0, error: null };
  const selectSingle: { data: Record<string, unknown> | null; error: Record<string, unknown> | null } =
    opts?.selectSingleResult ?? { data: { resolved: 0 }, error: null };
  const selectOrder: { data: unknown[]; error: null } =
    opts?.selectOrderResult ?? { data: [], error: null };

  // build a chainable "eq" step — the source does `update(...).eq(a,v).eq(b,v)`.
  function makeEqStep(): Record<string, unknown> {
    const base: Record<string, unknown> = Object.assign({}, updateBase);
    return {
      eq: (_col: string, _val: unknown) => makeEqStep(),
      lt: (_col: string, _val: unknown) => makeEqStep(),
      gte: (_col: string, _val: unknown) => makeEqStep(),
      then: (fn: (v: Record<string, unknown>) => unknown) => {
        Promise.resolve(fn(base)).catch(() => {});
        return makeThenable(base);
      },
    };
  }

  return {
    from: (_tbl: string) => ({
      insert: async () => insertResult,
      update: (_updates: Record<string, unknown>) => {
        updateLog.push(_updates);
        return makeEqStep();
      },
      select: (columns: string) => {
        selectLog.push({ columns });
        function makeSelectChain(): Record<string, unknown> {
          const base: Record<string, unknown> = Object.assign({}, selectOrder);
          const ch = {
            eq: (_col: string, _val: unknown) => makeSelectChain(),
            lt: (_col: string, _val: unknown) => makeSelectChain(),
            gte: (_col: string, _val: unknown) => makeSelectChain(),
            limit: (_n: number) => makeSelectChain(),
            order: (_col: string) => makeSelectChain(),
            single: async () => selectSingle,
            maybeSingle: async () => ({ data: null, error: null }),
            then: (fn: (v: Record<string, unknown>) => unknown) => {
              Promise.resolve(fn(base)).catch(() => {});
              return makeThenable(base);
            },
          };
          return ch;
        }
        return makeSelectChain();
      },
      delete: () => ({
        eq: () => resolvedThenable({ count: 0, error: null }),
        then: (fn: (v: Record<string, unknown>) => unknown) => {
          Promise.resolve(fn({ count: 0, error: null })).catch(() => {});
          return makeThenable({ count: 0, error: null });
        },
      }),
    }),
    batch: async () => ({ error: null }),
  } as unknown as D1LikeClient;
}

// ---------------------------------------------------------------------------
// F1 — UNIQUE-violation handling
// ---------------------------------------------------------------------------
describe('F1: enqueueDlqEntry handles UNIQUE(event_id) by bumping retry_count', () => {
  it('inserts a fresh event when event_id is not yet in the DLQ', async () => {
    const { enqueueDlqEntry } = await import('../nowpayments-ipn-dead-letter');
    const updateLog: Array<Record<string, unknown>> = [];
    const db = buildD1Client({ updateLog });
    const err = await enqueueDlqEntry(db, {
      eventId: 'ev-new',
      paymentId: 'pay-1',
      paymentStatus: 'waiting',
      orderId: 'ord-1',
      payload: { amount: '1.5' },
      failureReason: 'timeout',
      retryCount: 2,
    });
    expect(err).toBeUndefined();
    // Fresh insert path — updateLog stays empty (no UNIQUE-violation branch)
    expect(updateLog).toHaveLength(0);
  });

  it('on UNIQUE-violation, calls update with retry_count bumped and first_failed_at set', async () => {
    const { enqueueDlqEntry } = await import('../nowpayments-ipn-dead-letter');
    const updateLog: Array<Record<string, unknown>> = [];
    const db = buildD1Client({
      updateLog,
      // First insert returns a UNIQUE-violation
      insertResult: uniqueViolation(),
      // .select().single() returns a row so the update-eq chain resolves count:1
      selectSingleResult: { data: { resolved: 0 }, error: null },
      updateResult: { count: 1, error: null },
    });

    const err = await enqueueDlqEntry(db, {
      eventId: 'ev-dup',
      paymentId: 'pay-dup',
      paymentStatus: 'waiting',
      orderId: 'ord-dup',
      payload: {},
      failureReason: 'dup-test',
      retryCount: 3,
    });

    // Unique-violation branch must NOT throw — it must resolve the update
    expect(err).toBeUndefined();
    expect(updateLog.length).toBeGreaterThanOrEqual(1);

    // Find the update payload whose shape is the DLQ retry bump
    const dlqUpdate = updateLog.find(
      (u) => (u as Record<string, unknown>).retry_count !== undefined,
    );
    expect(dlqUpdate).toBeDefined();

    // F1 fix: source uses client-side `opts.retryCount + 1` (was: db.raw("retry_count + 1") / SQL)
    expect((dlqUpdate as Record<string, unknown>).retry_count).toBe(4);

    // F3 fix: first_failed_at is present on the retry path
    expect((dlqUpdate as Record<string, unknown>).first_failed_at).toBeDefined();
    expect(typeof (dlqUpdate as Record<string, unknown>).first_failed_at).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// F2 — caller-supplied db (no implicit globals)
// ---------------------------------------------------------------------------
describe('F2: enqueueDlqEntry requires caller-supplied db as first arg', () => {
  it('rejects a missing/undefined db at runtime', async () => {
    const { enqueueDlqEntry } = await import('../nowpayments-ipn-dead-letter');
    let threw = false;
    try {
            await enqueueDlqEntry(undefined as unknown as D1LikeClient, {
        eventId: 'x',
        paymentId: 'p',
        paymentStatus: 'waiting',
        orderId: 'o',
        payload: {},
        failureReason: '',
        retryCount: 0,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('uses only the provided db — no implicit globals', async () => {
    const { enqueueDlqEntry } = await import('../nowpayments-ipn-dead-letter');
    const updateLog: Array<Record<string, unknown>> = [];
    const db = buildD1Client({ updateLog });
    const err = await enqueueDlqEntry(db, {
      eventId: 'ev-scoped',
      paymentId: 'pay-s',
      paymentStatus: 'waiting',
      orderId: 'ord-s',
      payload: { t: 1 },
      failureReason: '',
      retryCount: 0,
    });
    expect(err).toBeUndefined();
    expect(updateLog).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// F3 — resolveDlqEntry / getStaleDlqEntries on injected client
// ---------------------------------------------------------------------------

describe('P2: regression — event_id is passed as a bind value and retry_count bumps', () => {
  it('event_id containing SQL metacharacters is passed as a bind parameter to .eq()', async () => {
    const { enqueueDlqEntry } = await import('../nowpayments-ipn-dead-letter');
    const eqValues: unknown[] = [];

    // Minimal mock whose `.eq` captures its second arg.
    function buildCaptureDb(): D1LikeClient {
      return {
        from: () => ({
          insert: async () => ({ error: { code: '23505', message: 'unique violation', name: 'unique_violation' } }),
          update: (updates: Record<string, unknown>) => {
            // Source path for UNIQUE-violation: update({...}).eq('event_id', eventId).eq('resolved', 0)
            return {
              eq: (_col: string, val: unknown) => {
                if (_col === 'event_id') eqValues.push(val);
                return {
                  eq: async (_c2: string, _v2: unknown) => ({ count: 1, error: null }),
                  then: async (onF: (v: unknown) => unknown) =>
                    onF({ count: 1, error: null }),
                } as unknown as Thenable<{ count: number; error: null }>;
              },
              then: async (onF: (v: unknown) => unknown) =>
                onF({ count: 1, error: null }),
            } as unknown as Thenable<{ count: number; error: null }>;
          },
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: { resolved: 0 }, error: null }),
              single: async () => ({ data: { resolved: 0 }, error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          delete: () => ({
            eq: async () => ({ count: 0, error: null }),
            then: async (onF: (v: unknown) => unknown) =>
              onF({ count: 0, error: null }),
          }),
        }),
        batch: async () => ({ error: null }),
      } as unknown as D1LikeClient;
    }

    const sqlInjection = "foo; DROP TABLE payment_events; --";
    await enqueueDlqEntry(buildCaptureDb(), {
      eventId: sqlInjection,
      paymentId: 'pay-inj',
      paymentStatus: 'waiting',
      orderId: 'ord-inj',
      payload: {},
      failureReason: '',
      retryCount: 0,
    });

    // The literal string (not a concatenated SQL fragment) must be bound.
    expect(eqValues).toContain(sqlInjection);
  });

  it('each UNIQUE-violation re-enqueue uses the caller-supplied retryCount as base', async () => {
    const { enqueueDlqEntry } = await import('../nowpayments-ipn-dead-letter');
    const updateLog: Array<Record<string, unknown>> = [];
    const db = buildD1Client({
      updateLog,
      insertResult: uniqueViolation(),
      selectSingleResult: { data: { resolved: 0 }, error: null },
      updateResult: { count: 1, error: null },
    });

    // Re-enqueue three times with retryCount = 0, 1, 2.
    for (let i = 0; i < 3; i++) {
      await enqueueDlqEntry(db, {
        eventId: 'ev-bump',
        paymentId: 'pay-b',
        paymentStatus: 'waiting',
        orderId: 'ord-b',
        payload: {},
        failureReason: 'bump',
        retryCount: i,
      });
    }

    const bumps = updateLog.filter(
      (u) => (u as Record<string, unknown>).retry_count !== undefined,
    );
    expect(bumps).toHaveLength(3);
    expect((bumps[0] as Record<string, unknown>).retry_count).toBe(1);
    expect((bumps[1] as Record<string, unknown>).retry_count).toBe(2);
    expect((bumps[2] as Record<string, unknown>).retry_count).toBe(3);
  });
});

describe('F3: resolveDlqEntry / getStaleDlqEntries — isolated mock client', () => {
  it('resolveDlqEntry chains .update({ resolved: 1 }).eq("event_id", ...) on the provided client', async () => {
    const { resolveDlqEntry } = await import('../nowpayments-ipn-dead-letter');
    const updateLog: Array<Record<string, unknown>> = [];
    const db = buildD1Client({
      updateLog,
      updateResult: { count: 1, error: null },
    });

    const err = await resolveDlqEntry(db, 'ev-resolve');
    expect(err).toBeUndefined();
    expect(updateLog.length).toBeGreaterThanOrEqual(1);
    const last = updateLog[updateLog.length - 1];
    expect((last as Record<string, unknown>).resolved).toBe(1);
  });

  it('getStaleDlqEntries returns [] when no rows match on the provided client', async () => {
    const { getStaleDlqEntries } = await import('../nowpayments-ipn-dead-letter');
    const selectLog: Array<{ columns: string }> = [];
    const db = buildD1Client({
      selectLog,
      selectOrderResult: { data: [], error: null },
    });

    const entries = await getStaleDlqEntries(db, 1);
    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(0);
    // Verify the client's .select() chain is what drives the result
    expect(selectLog.length).toBeGreaterThanOrEqual(1);
  });
});
