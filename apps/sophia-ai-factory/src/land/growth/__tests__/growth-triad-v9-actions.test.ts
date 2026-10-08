import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRoutingTopologyAction,
  getShadowbanMatrixAction,
  requestCulturalScoresAction,
} from "../actions/growth-triad-v9-actions";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { inngest } from "@/seed/inngest/client";
import { ScriptCultureIndexRequest } from "@/seed/types/growth-triad-v9-types";

vi.mock("@/seed/auth/better-auth-session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/seed/inngest/client", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

describe("growth-triad-v9-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRoutingTopologyAction", () => {
    it("fails if unauthorized", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
      const result = await getRoutingTopologyAction();
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.message).toBe("Unauthorized");
    });

    it("returns topology data if authorized", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: "user_1" } as any);
      const result = await getRoutingTopologyAction();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].sourceUrl).toBe("https://example.com/source1");
      }
    });
  });

  describe("getShadowbanMatrixAction", () => {
    it("fails if unauthorized", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
      const result = await getShadowbanMatrixAction();
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.message).toBe("Unauthorized");
    });

    it("returns shadowban data if authorized", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: "user_2" } as any);
      const result = await getShadowbanMatrixAction();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].platform).toBe("TIKTOK");
      }
    });
  });

  describe("requestCulturalScoresAction", () => {
    const validData: ScriptCultureIndexRequest = {
      scriptId: "script_abc",
      regionalTarget: "SOUTH_AMERICA" as any, // Deliberately invalid based on schema which uses LATIN_AMERICA
      transcriptString: "Hello world",
    };

    const reallyValidData: ScriptCultureIndexRequest = {
      scriptId: "script_abc",
      regionalTarget: "LATIN_AMERICA",
      transcriptString: "Hello world",
    };

    it("fails if unauthorized", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
      const result = await requestCulturalScoresAction(reallyValidData);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.message).toBe("Unauthorized");
    });

    it("fails on zod validation error", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: "user_3" } as any);
      const result = await requestCulturalScoresAction(validData);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.message).toContain("Validation Error");
      expect(inngest.send).not.toHaveBeenCalled();
    });

    it("dispatches to inngest and succeeds on valid request", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: "user_3" } as any);
      const result = await requestCulturalScoresAction(reallyValidData);
      expect(result.ok).toBe(true);

      expect(inngest.send).toHaveBeenCalledTimes(1);
      expect(inngest.send).toHaveBeenCalledWith({
        name: "semantic.culture.scored",
        data: expect.objectContaining({
          scriptId: "script_abc",
          cultureMatch: "HIGH",
        }),
      });

      if (result.ok) {
        expect(result.value.status).toBe("success");
        expect(result.value.id).toBe("script_abc");
      }
    });
  });
});
