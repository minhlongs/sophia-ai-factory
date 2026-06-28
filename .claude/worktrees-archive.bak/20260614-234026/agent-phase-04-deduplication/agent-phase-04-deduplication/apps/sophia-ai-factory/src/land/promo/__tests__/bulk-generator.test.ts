import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/seed/db/client", () => ({
  getD1Raw: vi.fn(),
}));

vi.mock("../promo-repo", () => ({
  getCodeByCode: vi.fn(),
}));

import { getD1Raw } from "@/seed/db/client";
import { getCodeByCode } from "../promo-repo";
import {
  bulkGeneratePromoCodes,
  BulkIdempotencyConflict,
} from "../bulk-generator";

/**
 * D1 mock that records prepare → bind → terminal-call invocations.
 * Routes SELECT/INSERT statements distinctly so individual specs can stub
 * the response of the collision-check SELECT or the idempotency SELECT.
 */
interface MockD1 {
  prepare: ReturnType<typeof vi.fn>;
  bind: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  /** captured SQL of last prepare() */
  lastSql: { value: string };
  /** result returned by .all() — override per test */
  allResult: { results: Array<{ code: string }> };
  /** result returned by .first() — override per test */
  firstResult: { payload: string } | null;
}

function buildD1Mock(): MockD1 {
  const lastSql = { value: "" };
  const allResult = { results: [] as Array<{ code: string }> };
  let firstResult: { payload: string } | null = null;
  const ctx = {
    get firstResult() {
      return firstResult;
    },
    set firstResult(v: { payload: string } | null) {
      firstResult = v;
    },
  };
  const run = vi.fn().mockResolvedValue({});
  const all = vi.fn(async () => allResult);
  const first = vi.fn(async () => ctx.firstResult);
  const bind = vi.fn(() => ({ run, all, first }));
  const prepare = vi.fn((sql: string) => {
    lastSql.value = sql;
    return { bind };
  });
  const batch = vi.fn().mockResolvedValue([]);
  vi.mocked(getD1Raw).mockResolvedValue(
    { prepare, batch } as unknown as Awaited<ReturnType<typeof getD1Raw>>,
  );
  return {
    prepare,
    bind,
    batch,
    lastSql,
    allResult,
    get firstResult() {
      return firstResult;
    },
    set firstResult(v: { payload: string } | null) {
      firstResult = v;
    },
  } as MockD1;
}

describe("bulkGeneratePromoCodes (Phase 03b)", () => {
  let d1: MockD1;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCodeByCode).mockResolvedValue(null);
    d1 = buildD1Mock();
  });

  it("generates N codes with FREE100-XXXXXXXX format (happy path)", async () => {
    const res = await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 5,
      tier: "MASTER",
      adminId: "admin-1",
    });
    expect(res.codes).toHaveLength(5);
    expect(res.promoCodeIds).toHaveLength(5);
    expect(new Set(res.codes).size).toBe(5);
    res.codes.forEach((c) => expect(c).toMatch(/^FREE100-[A-Z2-7]{8}$/));
    expect(res.batchId).toMatch(/^bulk-\d+-[A-Z2-7]{6}$/);
    expect(res.csv.split("\n")[0]).toBe(
      '"code","tier","valid_until_unix","description"',
    );
  });

  it("throws on count out of range", async () => {
    await expect(
      bulkGeneratePromoCodes({
        baseCode: "FREE100",
        count: 0,
        tier: "MASTER",
        adminId: "admin-1",
      }),
    ).rejects.toThrow(/count out of range/);
    await expect(
      bulkGeneratePromoCodes({
        baseCode: "FREE100",
        count: 1001,
        tier: "MASTER",
        adminId: "admin-1",
      }),
    ).rejects.toThrow(/count out of range/);
  });

  it("regenerates colliding codes via single SELECT IN (...)", async () => {
    // First SELECT call returns 1 collision; subsequent pass returns none.
    let pass = 0;
    d1.prepare.mockImplementation((sql: string) => {
      d1.lastSql.value = sql;
      return {
        bind: (...args: unknown[]) => ({
          run: vi.fn().mockResolvedValue({}),
          all: vi.fn(async () => {
            if (sql.includes("SELECT code FROM promo_codes")) {
              pass++;
              if (pass === 1) {
                // Collide with the first candidate
                return { results: [{ code: String(args[0]) }] };
              }
              return { results: [] };
            }
            return { results: [] };
          }),
          first: vi.fn(async () => null),
        }),
      };
    });

    const res = await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 3,
      tier: "MASTER",
      adminId: "admin-1",
    });
    expect(res.codes).toHaveLength(3);
    expect(pass).toBeGreaterThanOrEqual(2); // at least 1 collision + 1 retry
  });

  it("throws when collisions persist beyond retry budget", async () => {
    // All SELECTs return every candidate as a collision
    d1.prepare.mockImplementation((sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn(async () => {
          if (sql.includes("SELECT code FROM promo_codes")) {
            return { results: args.map((a) => ({ code: String(a) })) };
          }
          return { results: [] };
        }),
        first: vi.fn(async () => null),
      }),
    }));
    await expect(
      bulkGeneratePromoCodes({
        baseCode: "FREE100",
        count: 2,
        tier: "MASTER",
        adminId: "admin-1",
      }),
    ).rejects.toThrow(/collision retry exhausted/);
  });

  it("inserts via db.batch() in chunks (no per-row .run())", async () => {
    await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 120,
      tier: "MASTER",
      adminId: "admin-1",
    });
    // 120 codes / 50 per chunk = 3 batches (50+50+20)
    expect(d1.batch).toHaveBeenCalledTimes(3);
    const firstBatch = d1.batch.mock.calls[0][0] as unknown[];
    expect(firstBatch).toHaveLength(50);
    const lastBatch = d1.batch.mock.calls[2][0] as unknown[];
    expect(lastBatch).toHaveLength(20);
  });

  it("writes admin_audit_log row with idempotencyKey field", async () => {
    const res = await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 1,
      tier: "MASTER",
      adminId: "admin-1",
      idempotencyKey: "test-key-abc",
    });
    expect(res.batchId).toBeTruthy();
    // Find the audit_log INSERT bind() call — last bind invocation should carry the JSON payload
    const auditBindCall = d1.bind.mock.calls.find((c) =>
      typeof c[2] === "string" && (c[2] as string).includes('"idempotencyKey"'),
    );
    expect(auditBindCall).toBeTruthy();
    expect(auditBindCall![2] as string).toContain('"test-key-abc"');
  });

  it("throws BulkIdempotencyConflict when prior key found within window", async () => {
    // Idempotency lookup SELECT returns a prior row
    d1.prepare.mockImplementation((sql: string) => ({
      bind: () => ({
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn(async () => ({ results: [] })),
        first: vi.fn(async () => {
          if (sql.includes("FROM admin_audit_log")) {
            return {
              payload: JSON.stringify({
                batchId: "bulk-PRIOR-AAAAAA",
                idempotencyKey: "dup-key",
              }),
            };
          }
          return null;
        }),
      }),
    }));
    await expect(
      bulkGeneratePromoCodes({
        baseCode: "FREE100",
        count: 1,
        tier: "MASTER",
        adminId: "admin-1",
        idempotencyKey: "dup-key",
      }),
    ).rejects.toBeInstanceOf(BulkIdempotencyConflict);
    try {
      await bulkGeneratePromoCodes({
        baseCode: "FREE100",
        count: 1,
        tier: "MASTER",
        adminId: "admin-1",
        idempotencyKey: "dup-key",
      });
    } catch (err) {
      expect((err as BulkIdempotencyConflict).priorBatchId).toBe(
        "bulk-PRIOR-AAAAAA",
      );
    }
  });

  it("does NOT call idempotency SELECT when Idempotency-Key header omitted", async () => {
    let auditLookupSeen = false;
    d1.prepare.mockImplementation((sql: string) => {
      if (
        sql.includes("FROM admin_audit_log") &&
        sql.includes("payload LIKE")
      ) {
        auditLookupSeen = true;
      }
      return {
        bind: () => ({
          run: vi.fn().mockResolvedValue({}),
          all: vi.fn(async () => ({ results: [] })),
          first: vi.fn(async () => null),
        }),
      };
    });
    await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 1,
      tier: "MASTER",
      adminId: "admin-1",
    });
    expect(auditLookupSeen).toBe(false);
  });
});
