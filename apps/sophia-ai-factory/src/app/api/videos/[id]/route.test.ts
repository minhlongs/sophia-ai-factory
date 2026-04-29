import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/better-auth-session", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({
  createServerClient: vi.fn(),
}));

import { getCurrentUser } from "@/lib/better-auth-session";
import { createServerClient } from "@/lib/db/client";

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedCreateServerClient = vi.mocked(createServerClient);

function buildDbStub(result: { data?: unknown; error?: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createServerClient>;
}

const mockUser = {
  id: "u1",
  email: "a@b.c",
  full_name: undefined,
  avatar_url: undefined,
  role: "user",
};

const baseReq = new Request("http://localhost/api/videos/v1");

describe("GET /api/videos/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when no auth", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const res = await GET(baseReq, { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(401);
  });

  it("404 when not found", async () => {
    mockedGetCurrentUser.mockResolvedValue(mockUser);
    mockedCreateServerClient.mockReturnValue(buildDbStub({ data: null }));
    const res = await GET(baseReq, { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(404);
  });

  it("403 when user_id mismatch", async () => {
    mockedGetCurrentUser.mockResolvedValue(mockUser);
    mockedCreateServerClient.mockReturnValue(
      buildDbStub({ data: { id: "v1", user_id: "OTHER", title: "T" } })
    );
    const res = await GET(baseReq, { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(403);
  });

  it("returns video when owner matches", async () => {
    mockedGetCurrentUser.mockResolvedValue(mockUser);
    mockedCreateServerClient.mockReturnValue(
      buildDbStub({
        data: {
          id: "v1",
          user_id: "u1",
          title: "T",
          status: "completed",
          video_url: "https://x",
          thumbnail_url: null,
          duration_sec: 30,
          heygen_job_id: "h1",
          script_request_id: null,
          error: null,
          created_at: 1000,
          updated_at: "2026-04-28",
        },
      })
    );
    const res = await GET(baseReq, { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { video: { id: string } };
    expect(body.video.id).toBe("v1");
  });
});
