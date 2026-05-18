import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/seed/db/client", () => ({
  getD1Raw: vi.fn(),
}));

vi.mock("../promo-repo", () => ({
  createCode: vi.fn(),
  getCodeByCode: vi.fn(),
}));

import { getD1Raw } from "@/seed/db/client";
import { createCode, getCodeByCode } from "../promo-repo";
import { bulkGeneratePromoCodes } from "../bulk-generator";
import type { PromoCodeRow } from "../promo-types";

function stubRow(code: string, id: string): PromoCodeRow {
  return {
    id,
    code,
    description: null,
    discount_type: "free_full",
    discount_value: 100,
    applies_to_tier: "MASTER",
    applies_to_sku: null,
    max_uses: 1,
    used_count: 0,
    max_uses_per_user: 1,
    valid_from: 0,
    valid_until: null,
    status: "active",
    created_by_admin_id: "admin-1",
    created_at: 0,
    metadata: null,
  };
}

function mockD1Raw() {
  const run = vi.fn().mockResolvedValue({});
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  vi.mocked(getD1Raw).mockResolvedValue({ prepare } as unknown as Awaited<ReturnType<typeof getD1Raw>>);
  return { prepare, bind, run };
}

describe("bulkGeneratePromoCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCodeByCode).mockResolvedValue(null);
    let n = 0;
    vi.mocked(createCode).mockImplementation(async (input) =>
      stubRow(input.code, `id-${++n}`),
    );
    mockD1Raw();
  });

  it("generates N codes with FREE100-XXXXXXXX format", async () => {
    const res = await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 5,
      tier: "MASTER",
      adminId: "admin-1",
    });
    expect(res.codes).toHaveLength(5);
    expect(res.promoCodeIds).toHaveLength(5);
    res.codes.forEach((c) => {
      expect(c).toMatch(/^FREE100-[A-Z2-7]{8}$/);
    });
    expect(new Set(res.codes).size).toBe(5);
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

  it("retries on collision then succeeds", async () => {
    const calls = vi.mocked(getCodeByCode);
    calls
      .mockResolvedValueOnce(stubRow("FREE100-COLLIDE1", "x"))
      .mockResolvedValueOnce(stubRow("FREE100-COLLIDE2", "y"))
      .mockResolvedValue(null);
    const res = await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 1,
      tier: "MASTER",
      adminId: "admin-1",
    });
    expect(res.codes).toHaveLength(1);
    expect(calls).toHaveBeenCalledTimes(3);
  });

  it("throws after collision retry exhaust", async () => {
    vi.mocked(getCodeByCode).mockResolvedValue(stubRow("FREE100-X", "y"));
    await expect(
      bulkGeneratePromoCodes({
        baseCode: "FREE100",
        count: 1,
        tier: "MASTER",
        adminId: "admin-1",
      }),
    ).rejects.toThrow(/collision retry exhausted/);
  });

  it("writes admin_audit_log row + returns batchId + CSV header", async () => {
    const { prepare, bind, run } = mockD1Raw();
    const res = await bulkGeneratePromoCodes({
      baseCode: "FREE100",
      count: 2,
      tier: "MASTER",
      adminId: "admin-1",
      description: "spring-campaign",
    });
    expect(res.batchId).toMatch(/^bulk-\d+-[A-Z2-7]{6}$/);
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO admin_audit_log"),
    );
    expect(bind).toHaveBeenCalledWith(
      "admin-1",
      "promo_bulk_generate",
      expect.stringContaining('"batchId"'),
      expect.any(Number),
    );
    expect(run).toHaveBeenCalled();
    expect(res.csv.split("\n")[0]).toBe(
      '"code","tier","valid_until_unix","description"',
    );
    expect(res.csv.split("\n")).toHaveLength(3);
  });
});
