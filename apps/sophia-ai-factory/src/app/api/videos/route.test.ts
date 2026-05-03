import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/seed/auth/better-auth-session", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/seed/db/client", () => ({
  createServerClient: vi.fn(),
}));

import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { createServerClient } from "@/seed/db/client";

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedCreateServerClient = vi.mocked(createServerClient);

function buildDbStub(result: { data?: unknown[]; error?: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createServerClient>;
}

describe("GET /api/videos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when no auth", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/videos"));
    expect(res.status).toBe(401);
  });

  it("400 when limit invalid", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      full_name: undefined,
      avatar_url: undefined,
      role: "user",
    });
    const res = await GET(
      new Request("http://localhost/api/videos?limit=abc")
    );
    expect(res.status).toBe(400);
  });

  it("returns paginated list scoped to user", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      full_name: undefined,
      avatar_url: undefined,
      role: "user",
    });
    const stub = buildDbStub({
      data: [
        {
          id: "v1",
          title: "T",
          status: "completed",
          video_url: "https://x",
          thumbnail_url: null,
          duration_sec: 30,
          heygen_job_id: "h1",
          created_at: 1000,
        },
      ],
    });
    mockedCreateServerClient.mockReturnValue(stub);

    const res = await GET(
      new Request("http://localhost/api/videos?limit=10&offset=0")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      videos: unknown[];
      pagination: { limit: number; offset: number; count: number };
    };
    expect(body.videos).toHaveLength(1);
    expect(body.pagination.limit).toBe(10);
  });

  it("500 when db error", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      full_name: undefined,
      avatar_url: undefined,
      role: "user",
    });
    mockedCreateServerClient.mockReturnValue(
      buildDbStub({ error: { message: "db down" } })
    );
    const res = await GET(new Request("http://localhost/api/videos"));
    expect(res.status).toBe(500);
  });
});
