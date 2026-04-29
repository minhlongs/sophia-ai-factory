import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/better-auth-session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/db/get-user-tier", () => ({
  getUserTier: vi.fn(),
}));

vi.mock("@/lib/ai/script-generator", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    generateScript: vi.fn(),
    selectModelForTier: (tier: string) =>
      tier === "ENTERPRISE" ? "anthropic/claude-3.5-sonnet" : "openai/gpt-4o-mini",
  };
});

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    NextResponse: {
      json: vi.fn((body: unknown, init?: { status?: number }) => ({
        body,
        status: init?.status ?? 200,
      })),
    },
  };
});

import { getCurrentUser } from "@/lib/better-auth-session";
import { getUserTier } from "@/lib/db/get-user-tier";
import { generateScript } from "@/lib/ai/script-generator";

interface MockResponse {
  body: Record<string, unknown>;
  status: number;
}

const mockUser = {
  id: "user-abc",
  email: "test@example.com",
  full_name: "Test User",
  avatar_url: undefined,
  role: "user",
};

const mockScriptOutput = {
  title: "Test Script",
  scenes: [
    { scene_number: 1, visual_description: "opener", narration: "Hook here", duration_estimate: 5 },
    { scene_number: 2, visual_description: "body", narration: "Body content", duration_estimate: 10 },
    { scene_number: 3, visual_description: "close", narration: "CTA here", duration_estimate: 5 },
  ],
  total_duration: 20,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/scripts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string): Request {
  return new Request("http://localhost/api/scripts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

describe("POST /api/scripts/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST(makeRequest({ topic: "fitness", audience: "beginners" })) as unknown as MockResponse;

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 400 on missing topic", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getUserTier).mockResolvedValue("BASIC");

    const res = await POST(makeRequest({ audience: "beginners" })) as unknown as MockResponse;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Validation failed" });
  });

  it("returns 400 on missing audience", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getUserTier).mockResolvedValue("BASIC");

    const res = await POST(makeRequest({ topic: "fitness" })) as unknown as MockResponse;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Validation failed" });
  });

  it("returns 200 with valid script structure on happy path (BASIC)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getUserTier).mockResolvedValue("BASIC");
    vi.mocked(generateScript).mockResolvedValue(mockScriptOutput);

    const res = await POST(
      makeRequest({ topic: "fitness", audience: "beginners" })
    ) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      requestId: expect.any(String),
      content: {
        hook: "Hook here",
        body: "Body content",
        cta: "CTA here",
      },
      metadata: {
        tier: "BASIC",
        model: "openai/gpt-4o-mini",
        generatedAt: expect.any(String),
      },
    });
    expect(res.body.scriptId).toBeUndefined();
  });

  it("returns 200 with claude model for ENTERPRISE tier", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getUserTier).mockResolvedValue("ENTERPRISE");
    vi.mocked(generateScript).mockResolvedValue(mockScriptOutput);

    const res = await POST(
      makeRequest({ topic: "fitness", audience: "beginners" })
    ) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect((res.body.metadata as Record<string, unknown>).tier).toBe("ENTERPRISE");
    expect((res.body.metadata as Record<string, unknown>).model).toBe("anthropic/claude-3.5-sonnet");
  });

  it("returns 500 on generator error", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getUserTier).mockResolvedValue("BASIC");
    vi.mocked(generateScript).mockRejectedValue(new Error("OpenRouter down"));

    const res = await POST(
      makeRequest({ topic: "fitness", audience: "beginners" })
    ) as unknown as MockResponse;

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Script generation failed" });
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getUserTier).mockResolvedValue("BASIC");

    const res = await POST(makeRawRequest("not json")) as unknown as MockResponse;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid JSON body" });
  });

  it("ignores client-supplied tier — BASIC user cannot escalate to MASTER", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getUserTier).mockResolvedValue("BASIC");
    vi.mocked(generateScript).mockResolvedValue(mockScriptOutput);

    const res = await POST(
      makeRequest({ topic: "fitness", audience: "beginners", tier: "MASTER" })
    ) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect((res.body.metadata as Record<string, unknown>).tier).toBe("BASIC");
    expect((res.body.metadata as Record<string, unknown>).model).toBe("openai/gpt-4o-mini");
  });
});
