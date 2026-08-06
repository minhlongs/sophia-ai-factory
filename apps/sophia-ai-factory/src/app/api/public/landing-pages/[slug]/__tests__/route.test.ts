import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const { mockGetBySlug } = vi.hoisted(() => ({ mockGetBySlug: vi.fn() }));
vi.mock("@/seed/db/repositories/landing-pages-repo", () => ({
  getBySlug: mockGetBySlug,
}));

vi.mock("@/seed/utils/logger-utility", () => ({
  logger: { error: vi.fn() },
}));

describe("GET /api/public/landing-pages/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when page does not exist", async () => {
    mockGetBySlug.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/public/landing-pages/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ slug: "nonexistent" }) });
    expect(res.status).toBe(404);
    expect(mockGetBySlug).toHaveBeenCalledWith("nonexistent");
  });

  it("returns 404 when page is not published", async () => {
    mockGetBySlug.mockResolvedValue({ id: 1, slug: "draft", isPublished: false, title: "Draft" });
    const req = new NextRequest("http://localhost/api/public/landing-pages/draft");
    const res = await GET(req, { params: Promise.resolve({ slug: "draft" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 with page data when published", async () => {
    const page = { id: 1, slug: "welcome", isPublished: true, title: "Welcome", content: "Hello" };
    mockGetBySlug.mockResolvedValue(page);
    const req = new NextRequest("http://localhost/api/public/landing-pages/welcome");
    const res = await GET(req, { params: Promise.resolve({ slug: "welcome" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(page);
  });

  it("handles server error gracefully", async () => {
    mockGetBySlug.mockRejectedValue(new Error("DB down"));
    const req = new NextRequest("http://localhost/api/public/landing-pages/any");
    const res = await GET(req, { params: Promise.resolve({ slug: "any" }) });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to get landing page" });
  });
});
