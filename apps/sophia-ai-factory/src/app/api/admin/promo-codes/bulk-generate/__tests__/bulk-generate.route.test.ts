import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/seed/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/seed/security/rate-limiter", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("@/land/promo/bulk-generator", () => ({
  bulkGeneratePromoCodes: vi.fn(),
}));

import { requireAdmin } from "@/seed/auth/require-admin";
import { rateLimit } from "@/seed/security/rate-limiter";
import { bulkGeneratePromoCodes } from "@/land/promo/bulk-generator";
import { POST } from "../route";

type ReqAuth = Awaited<ReturnType<typeof requireAdmin>>;
type BulkResult = Awaited<ReturnType<typeof bulkGeneratePromoCodes>>;

const ADMIN = {
  id: "admin-1",
  email: "a@x.com",
  role: "admin",
} as Exclude<ReqAuth, NextResponse>["user"];

const STUB_RESULT: BulkResult = {
  codes: ["FREE100-AAAAAAAA"],
  promoCodeIds: ["pc-1"],
  csv: '"code"\n"FREE100-AAAAAAAA"',
  batchId: "bulk-1-XXXXXX",
  generatedAt: 1_700_000_000_000,
};

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/promo-codes/bulk-generate", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/admin/promo-codes/bulk-generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ user: ADMIN });
    vi.mocked(rateLimit).mockResolvedValue({
      allowed: true,
      resetAt: Date.now() + 3600_000,
    });
    vi.mocked(bulkGeneratePromoCodes).mockResolvedValue(STUB_RESULT);
  });

  it("returns 401/403 when requireAdmin rejects", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const resp = await POST(
      buildRequest({ baseCode: "FREE100", count: 1, tier: "MASTER" }),
    );
    expect(resp.status).toBe(401);
    expect(bulkGeneratePromoCodes).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit exceeded", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({
      allowed: false,
      resetAt: Date.now() + 1000,
    });
    const resp = await POST(
      buildRequest({ baseCode: "FREE100", count: 1, tier: "MASTER" }),
    );
    expect(resp.status).toBe(429);
    expect(bulkGeneratePromoCodes).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON body", async () => {
    const resp = await POST(buildRequest("not-json"));
    expect(resp.status).toBe(400);
  });

  it("returns 400 on schema validation failure", async () => {
    const resp = await POST(
      buildRequest({ baseCode: "FREE100", count: 0, tier: "MASTER" }),
    );
    expect(resp.status).toBe(400);
    expect(bulkGeneratePromoCodes).not.toHaveBeenCalled();
  });

  it("returns 200 + result on happy path", async () => {
    const resp = await POST(
      buildRequest({
        baseCode: "FREE100",
        count: 1,
        tier: "MASTER",
        description: "spring",
      }),
    );
    expect(resp.status).toBe(200);
    const json = (await resp.json()) as Record<string, unknown> & {
      codes?: string[];
      csv?: string;
      reason?: string;
    };
    expect(json.codes).toEqual(["FREE100-AAAAAAAA"]);
    expect(json.csv).toContain("FREE100-AAAAAAAA");
    expect(bulkGeneratePromoCodes).toHaveBeenCalledWith({
      baseCode: "FREE100",
      count: 1,
      tier: "MASTER",
      description: "spring",
      adminId: "admin-1",
    });
  });

  it("returns 500 when generator throws", async () => {
    vi.mocked(bulkGeneratePromoCodes).mockRejectedValueOnce(
      new Error("collision retry exhausted"),
    );
    const resp = await POST(
      buildRequest({ baseCode: "FREE100", count: 1, tier: "MASTER" }),
    );
    expect(resp.status).toBe(500);
    const json = (await resp.json()) as Record<string, unknown> & {
      codes?: string[];
      csv?: string;
      reason?: string;
    };
    expect(json.reason).toMatch(/collision/);
  });
});
