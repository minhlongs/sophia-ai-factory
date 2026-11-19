import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/seed/auth/better-auth-session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/seed/db/resolve-user-tier", () => ({
  resolveUserTier: vi.fn(),
}));

vi.mock("@/seed/ai/script-generator", async (importOriginal) => {
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

import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import { generateScript } from "@/seed/ai/script-generator";
import { lookupUserApiKey } from "@/tree/byok/user-api-key-store";
import { ProviderInvalidKeyError, ProviderQuotaExceededError } from "@/seed/services/errors";

vi.mock("@/tree/byok/user-api-key-store", () => ({ lookupUserApiKey: vi.fn() }));

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
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'FOUND', key: 'customer-key' });
  });

  it('requires the authenticated customer key before generating, even with a platform key', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'NOT_CONFIGURED' });
    const res = await POST(makeRequest({ topic: 'fitness', audience: 'beginners' })) as unknown as MockResponse;
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'OPENROUTER_KEY_REQUIRED' });
    expect(generateScript).not.toHaveBeenCalled();
  });

  it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED'] as const)(
    'fails closed for key lookup status %s', async (status) => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
      vi.mocked(lookupUserApiKey).mockResolvedValue({ status });
      const res = await POST(makeRequest({ topic: 'fitness', audience: 'beginners' })) as unknown as MockResponse;
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ code: 'OPENROUTER_KEY_UNAVAILABLE' });
      expect(generateScript).not.toHaveBeenCalled();
    },
  );

  it('passes explicit customer funding with the session owner to the generator', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
    vi.mocked(generateScript).mockResolvedValue(mockScriptOutput);
    await POST(makeRequest({ topic: 'fitness', audience: 'beginners', userId: 'victim' }));
    expect(lookupUserApiKey).toHaveBeenCalledWith('user-abc', 'openrouter');
    expect(generateScript).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-abc' }), {
      funding: { fund: 'byok', apiKey: 'customer-key' },
    });
  });

  it.each([
    [new ProviderInvalidKeyError('openrouter', 'sensitive-provider-detail'), 422, 'OPENROUTER_KEY_INVALID'],
    [new ProviderQuotaExceededError('openrouter', 'sensitive-provider-detail'), 402, 'OPENROUTER_CREDITS_EXHAUSTED'],
  ] as const)('returns an actionable provider error without exposing upstream details', async (error, status, code) => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
    vi.mocked(generateScript).mockRejectedValue(error);
    const res = await POST(makeRequest({ topic: 'fitness', audience: 'beginners' })) as unknown as MockResponse;
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ code });
    expect(JSON.stringify(res.body)).not.toContain('sensitive-provider-detail');
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST(makeRequest({ topic: "fitness", audience: "beginners" })) as unknown as MockResponse;

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 400 on missing topic", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue("BASIC");

    const res = await POST(makeRequest({ audience: "beginners" })) as unknown as MockResponse;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Validation failed" });
  });

  it("returns 400 on missing audience", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue("BASIC");

    const res = await POST(makeRequest({ topic: "fitness" })) as unknown as MockResponse;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Validation failed" });
  });

  it("returns 200 with valid script structure on happy path (BASIC)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue("BASIC");
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
    vi.mocked(resolveUserTier).mockResolvedValue("ENTERPRISE");
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
    vi.mocked(resolveUserTier).mockResolvedValue("BASIC");
    vi.mocked(generateScript).mockRejectedValue(new Error("OpenRouter down"));

    const res = await POST(
      makeRequest({ topic: "fitness", audience: "beginners" })
    ) as unknown as MockResponse;

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Script generation failed" });
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue("BASIC");

    const res = await POST(makeRawRequest("not json")) as unknown as MockResponse;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid JSON body" });
  });

  it("ignores client-supplied tier — BASIC user cannot escalate to MASTER", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(resolveUserTier).mockResolvedValue("BASIC");
    vi.mocked(generateScript).mockResolvedValue(mockScriptOutput);

    const res = await POST(
      makeRequest({ topic: "fitness", audience: "beginners", tier: "MASTER" })
    ) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect((res.body.metadata as Record<string, unknown>).tier).toBe("BASIC");
    expect((res.body.metadata as Record<string, unknown>).model).toBe("openai/gpt-4o-mini");
  });
});
