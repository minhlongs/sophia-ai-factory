/**
 * Distribution Asset CRUD tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDistributionAsset,
  getDistributionAsset,
  listDistributionAssets,
  updateDistributionAssetStatus,
  markDistributionAssetFailed,
  isValidAssetTransition,
} from '@/tree/distribution/assets';
import type { DistributionAsset } from '@/seed/types/creative-domain';
import { DistributionError } from '@/tree/distribution/errors';

const { mockStore, resetMockStore, mockBind, mockRun, mockFirst, mockPrepare } = vi.hoisted(() => {
  const mockStore = new Map<string, { data: Record<string, unknown>; ws: string }>();
  function resetMockStore() { mockStore.clear(); }
  let lastSql = "";
  let lastBound: unknown[] = [];
  const mockBind = vi.fn().mockReturnThis();
  const mockRun = vi.fn(async () => {
    if (lastSql.includes("INSERT INTO distribution_assets")) {
      const a = lastBound;
      const id = String(a[0]), ws = String(a[1]);
      mockStore.set(id, {
        ws,
        data: {
          id,
          workspace_id: ws,
          plan_id: a[2],
          asset_id: a[3],
          channel: a[4],
          platform_post_id: a[5] ?? null,
          status: a[6],
          scheduled_at: a[7],
          analytics: a[9],
          created_at: a[11],
          posted_at: a[8] ?? null,
          error: a[10] ?? null,
        },
      });
    } else if (lastSql.includes("UPDATE distribution_assets")) {
      const a = lastBound;
      if (lastSql.includes("status = 'failed'")) {
        const id = String(a[2]), ws = String(a[3]);
        const e = mockStore.get(id);
        if (e?.ws === ws) {
          e.data.status = "failed";
          e.data.error = String(a[0]);
          e.data.updated_at = a[1];
        }
      } else {
        const id = String(a[2]), ws = String(a[3]);
        const e = mockStore.get(id);
        if (e?.ws === ws) {
          e.data.status = a[0];
          e.data.updated_at = a[1];
        }
      }
    }
    return { success: true, meta: { changes: 1 } };
  });
  const mockFirst = vi.fn(async () => {
    if (lastSql.includes("id = ?1 AND workspace_id = ?2")) {
      const a = lastBound;
      const e = mockStore.get(String(a[0]));
      return e?.ws === String(a[1]) ? e.data : null;
    }
    if (lastSql.includes("id = ?1")) return mockStore.get(String(lastBound[0]))?.data ?? null;
    return null;
  });
  const mockPrepare = vi.fn((sql: string) => {
    lastSql = sql;
    return {
      bind(...args: unknown[]) { lastBound = args; return this; },
      first: mockFirst,
      all() {
        const ws = String(lastBound[0]);
        return { results: [...mockStore.values()].filter(e => e.ws === ws).map(e => e.data) };
      },
      run: mockRun,
    };
  });
  return { mockStore, resetMockStore, mockBind, mockRun, mockFirst, mockPrepare };
});

vi.mock("@/seed/db/client", () => ({
  getD1: vi.fn(() => ({ prepare: mockPrepare })),
}));

const WORKSPACE_ID = "ws_test_001";

function makeAsset(overrides: Partial<DistributionAsset> = {}): Omit<DistributionAsset, "id" | "createdAt"> {
  return {
    workspaceId: WORKSPACE_ID,
    planId: "dplan_001",
    assetId: "asset_001",
    channel: "youtube",
    status: "draft",
    scheduledAt: Date.now(),
    analytics: {},
    ...overrides,
  };
}

describe("Distribution Asset CRUD", () => {
  beforeEach(() => {
    resetMockStore();
    vi.clearAllMocks();
  });

  describe("createDistributionAsset", () => {
    it("creates and retrieves an asset", async () => {
      const asset = makeAsset();
      const created = await createDistributionAsset(asset);
      expect(created.id).toBeTruthy();
      expect(created.workspaceId).toBe(WORKSPACE_ID);
      const retrieved = await getDistributionAsset(created.id, WORKSPACE_ID);
      expect(retrieved.id).toBe(created.id);
    });
  });

  describe("IDOR prevention", () => {
    it("rejects cross-workspace access", async () => {
      const asset = await createDistributionAsset(makeAsset());
      await expect(getDistributionAsset(asset.id, "ws_other_999")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("rejects update from wrong workspace", async () => {
      const asset = await createDistributionAsset(makeAsset());
      await expect(updateDistributionAssetStatus(asset.id, "posted", "ws_other_999")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("status transitions", () => {
    it("rejects invalid transition", async () => {
      const asset = await createDistributionAsset(makeAsset({ status: "draft" }));
      await expect(updateDistributionAssetStatus(asset.id, "posted", WORKSPACE_ID)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    });
    it("allows draft -> scheduled transition", async () => {
      const asset = await createDistributionAsset(makeAsset({ status: "draft" }));
      const updated = await updateDistributionAssetStatus(asset.id, "scheduled", WORKSPACE_ID);
      expect(updated.status).toBe("scheduled");
    });
    it("marks asset as failed", async () => {
      const asset = await createDistributionAsset(makeAsset({ status: "posting" }));
      const failed = await markDistributionAssetFailed(asset.id, "API timeout", WORKSPACE_ID);
      expect(failed.status).toBe("failed");
      expect(failed.error).toBe("API timeout");
    });
  });

  describe("isValidAssetTransition", () => {
    it("accepts valid transitions", () => {
      expect(isValidAssetTransition("draft", "scheduled")).toBe(true);
      expect(isValidAssetTransition("posting", "posted")).toBe(true);
    });
    it("rejects invalid transitions", () => {
      expect(isValidAssetTransition("posted", "draft")).toBe(false);
      expect(isValidAssetTransition("failed", "posted")).toBe(false);
    });
  });
});
