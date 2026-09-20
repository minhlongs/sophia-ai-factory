/**
 * Unit & Integration Tests for Forest Blueprint Service
 *
 * @module forest/marketplace/__tests__/blueprint-service.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  listMarketplaceBlueprints,
  cloneBlueprintForMission,
  getBlueprintById,
} from '../blueprint-service';

interface MockBlueprintRow {
  id: string;
  workspace_id: string;
  title: string;
  hook_style: string;
  target_platform: string;
  aspect_ratios: string;
  estimated_scenes: number;
  estimated_duration_seconds: number;
  estimated_cost_cents: number;
  marketplace_listed: number;
  niche: string;
  conversion_rate: number;
  remix_count: number;
  royalty_pct: number;
  creator_id: string;
  created_at: number;
}

interface MockMissionRow {
  id: string;
  workspace_id: string;
  creator_id: string;
  title: string;
  status: string;
  budget_cents: number;
  blueprint_id: string;
  created_at: number;
}

function createMockD1() {
  const blueprints: MockBlueprintRow[] = [];
  const missions: MockMissionRow[] = [];

  return {
    blueprints,
    missions,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (sql.includes('SELECT COUNT(*) as total FROM campaign_blueprints')) {
                let filtered = blueprints.filter((b) => b.marketplace_listed === 1);
                let argIdx = 0;
                if (sql.includes('AND niche = ?')) {
                  const niche = args[argIdx++] as string;
                  filtered = filtered.filter((b) => b.niche === niche);
                }
                if (sql.includes('AND target_platform = ?')) {
                  const plat = args[argIdx++] as string;
                  filtered = filtered.filter((b) => b.target_platform === plat);
                }
                if (sql.includes('AND conversion_rate >= ?')) {
                  const cvr = args[argIdx++] as number;
                  filtered = filtered.filter((b) => b.conversion_rate >= cvr);
                }
                if (sql.includes('AND (title LIKE ? OR hook_style LIKE ?)')) {
                  const pattern = (args[argIdx++] as string).replace(/%/g, '').toLowerCase();
                  filtered = filtered.filter(
                    (b) =>
                      b.title.toLowerCase().includes(pattern) ||
                      b.hook_style.toLowerCase().includes(pattern),
                  );
                }
                return { total: filtered.length } as unknown as T;
              }

              if (sql.includes('SELECT * FROM campaign_blueprints WHERE id = ?')) {
                const [id] = args as [string];
                const found = blueprints.find((b) => b.id === id);
                return (found ? (found as unknown as T) : null);
              }

              return null;
            },
            async all<T>(): Promise<{ results: T[] }> {
              if (sql.includes('FROM campaign_blueprints WHERE marketplace_listed = 1')) {
                let filtered = blueprints.filter((b) => b.marketplace_listed === 1);
                let argIdx = 0;
                if (sql.includes('AND niche = ?')) {
                  const niche = args[argIdx++] as string;
                  filtered = filtered.filter((b) => b.niche === niche);
                }
                if (sql.includes('AND target_platform = ?')) {
                  const plat = args[argIdx++] as string;
                  filtered = filtered.filter((b) => b.target_platform === plat);
                }
                if (sql.includes('AND conversion_rate >= ?')) {
                  const cvr = args[argIdx++] as number;
                  filtered = filtered.filter((b) => b.conversion_rate >= cvr);
                }
                if (sql.includes('AND (title LIKE ? OR hook_style LIKE ?)')) {
                  const pattern = (args[argIdx++] as string).replace(/%/g, '').toLowerCase();
                  argIdx++; // skip duplicate term
                  filtered = filtered.filter(
                    (b) =>
                      b.title.toLowerCase().includes(pattern) ||
                      b.hook_style.toLowerCase().includes(pattern),
                  );
                }

                // Sorting
                if (sql.includes('remix_count DESC')) {
                  filtered.sort((a, b) => b.remix_count - a.remix_count);
                } else {
                  filtered.sort((a, b) => b.conversion_rate - a.conversion_rate);
                }

                // Limit / Offset
                const pageSize = args[args.length - 2] as number;
                const offset = args[args.length - 1] as number;
                const paged = filtered.slice(offset, offset + pageSize);

                return { results: paged as unknown as T[] };
              }

              return { results: [] };
            },
            async run(): Promise<{ success: boolean }> {
              if (sql.includes('INSERT INTO creative_missions')) {
                const [id, workspace_id, creator_id, title, budget_cents, blueprint_id, created_at] =
                  args as [string, string, string, string, number, string, number];
                missions.push({
                  id,
                  workspace_id,
                  creator_id,
                  title,
                  status: 'draft',
                  budget_cents,
                  blueprint_id,
                  created_at,
                });
              } else if (sql.includes('UPDATE campaign_blueprints SET remix_count = remix_count + 1')) {
                const [blueprintId] = args as [string];
                const bp = blueprints.find((b) => b.id === blueprintId);
                if (bp) {
                  bp.remix_count += 1;
                }
              }
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database & {
    blueprints: MockBlueprintRow[];
    missions: MockMissionRow[];
  };
}

describe('Forest Blueprint Service', () => {
  let db: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    db = createMockD1();

    // Populate test blueprints
    db.blueprints.push(
      {
        id: 'bp_1',
        workspace_id: 'ws_1',
        title: 'Viral TikTok E-Commerce',
        hook_style: 'curiosity_gap',
        target_platform: 'tiktok',
        aspect_ratios: '["9:16"]',
        estimated_scenes: 5,
        estimated_duration_seconds: 30,
        estimated_cost_cents: 50,
        marketplace_listed: 1,
        niche: 'ecommerce',
        conversion_rate: 0.08,
        remix_count: 24,
        royalty_pct: 10,
        creator_id: 'creator_alice',
        created_at: 1000,
      },
      {
        id: 'bp_2',
        workspace_id: 'ws_1',
        title: 'Shorts SaaS Explainer',
        hook_style: 'bold_claim',
        target_platform: 'youtube_shorts',
        aspect_ratios: '["9:16"]',
        estimated_scenes: 6,
        estimated_duration_seconds: 45,
        estimated_cost_cents: 65,
        marketplace_listed: 1,
        niche: 'saas',
        conversion_rate: 0.06,
        remix_count: 15,
        royalty_pct: 15,
        creator_id: 'creator_bob',
        created_at: 2000,
      },
      {
        id: 'bp_3',
        workspace_id: 'ws_1',
        title: 'Fitness Transformation',
        hook_style: 'before_after',
        target_platform: 'tiktok',
        aspect_ratios: '["9:16"]',
        estimated_scenes: 5,
        estimated_duration_seconds: 30,
        estimated_cost_cents: 50,
        marketplace_listed: 1,
        niche: 'fitness',
        conversion_rate: 0.09,
        remix_count: 42,
        royalty_pct: 10,
        creator_id: 'creator_alice',
        created_at: 3000,
      },
      {
        id: 'bp_spike',
        workspace_id: 'ws_1',
        title: 'Extreme 10-Min Video',
        hook_style: 'documentary',
        target_platform: 'youtube_shorts',
        aspect_ratios: '["9:16"]',
        estimated_scenes: 100,
        estimated_duration_seconds: 600,
        estimated_cost_cents: 1050,
        marketplace_listed: 1,
        niche: 'education',
        conversion_rate: 0.03,
        remix_count: 0,
        royalty_pct: 10,
        creator_id: 'creator_charlie',
        created_at: 4000,
      },
    );
  });

  describe('listMarketplaceBlueprints', () => {
    it('returns paginated listed blueprints', async () => {
      const res = await listMarketplaceBlueprints(db, { page: 1, pageSize: 2 });
      expect(res.items).toHaveLength(2);
      expect(res.total).toBe(4);
      expect(res.totalPages).toBe(2);
    });

    it('filters blueprints by niche', async () => {
      const res = await listMarketplaceBlueprints(db, { niche: 'saas' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toBe('Shorts SaaS Explainer');
      expect(res.items[0].niche).toBe('saas');
    });

    it('filters blueprints by target platform', async () => {
      const res = await listMarketplaceBlueprints(db, { platform: 'tiktok' });
      expect(res.items).toHaveLength(2);
      expect(res.items.every((i) => i.targetPlatform === 'tiktok')).toBe(true);
    });

    it('filters by minimum conversion rate threshold', async () => {
      const res = await listMarketplaceBlueprints(db, { minConversionRate: 0.07 });
      expect(res.items).toHaveLength(2);
      expect(res.items.every((i) => i.conversionRate >= 0.07)).toBe(true);
    });

    it('searches by keyword matching title', async () => {
      const res = await listMarketplaceBlueprints(db, { search: 'Fitness' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toContain('Fitness');
    });

    it('clamps page 0 and negative pages to page 1', async () => {
      const res = await listMarketplaceBlueprints(db, { page: 0 });
      expect(res.page).toBe(1);
      const resNeg = await listMarketplaceBlueprints(db, { page: -3 });
      expect(resNeg.page).toBe(1);
    });

    it('clamps pageSize > 50 to 50', async () => {
      const res = await listMarketplaceBlueprints(db, { pageSize: 200 });
      expect(res.pageSize).toBe(50);
    });
  });

  describe('cloneBlueprintForMission', () => {
    it('successfully clones blueprint into creative_missions in draft status', async () => {
      const res = await cloneBlueprintForMission(db, 'bp_1', 'user_cloner', 'ws_studio');
      expect(res.success).toBe(true);
      expect(res.missionId).toBeDefined();
      expect(res.blueprintId).toBe('bp_1');

      const mission = db.missions.find((m) => m.id === res.missionId);
      expect(mission).toBeDefined();
      expect(mission?.title).toContain('Viral TikTok E-Commerce');
      expect(mission?.status).toBe('draft');
      expect(mission?.blueprint_id).toBe('bp_1');
    });

    it('monotonically increments remix_count on the blueprint', async () => {
      const initialCount = db.blueprints.find((b) => b.id === 'bp_1')?.remix_count ?? 0;
      await cloneBlueprintForMission(db, 'bp_1', 'user_cloner', 'ws_studio');
      const updatedCount = db.blueprints.find((b) => b.id === 'bp_1')?.remix_count ?? 0;
      expect(updatedCount).toBe(initialCount + 1);
    });

    it('rejects cloning when estimated cost exceeds $5.00 ceiling', async () => {
      const res = await cloneBlueprintForMission(db, 'bp_spike', 'user_cloner', 'ws_studio');
      expect(res.success).toBe(false);
      expect(res.error).toBe('COST_SPIKE_CEILING_EXCEEDED');
      expect(res.preflightCostCents).toBeGreaterThan(500);
    });

    it('returns BLUEPRINT_NOT_FOUND for non-existent blueprint', async () => {
      const res = await cloneBlueprintForMission(db, 'non_existent', 'user_cloner', 'ws_studio');
      expect(res.success).toBe(false);
      expect(res.error).toBe('BLUEPRINT_NOT_FOUND');
    });
  });

  describe('getBlueprintById', () => {
    it('returns blueprint by ID if found', async () => {
      const bp = await getBlueprintById(db, 'bp_2');
      expect(bp).not.toBeNull();
      expect(bp?.id).toBe('bp_2');
      expect(bp?.title).toBe('Shorts SaaS Explainer');
    });

    it('returns null if not found', async () => {
      const bp = await getBlueprintById(db, 'missing_id');
      expect(bp).toBeNull();
    });
  });
});
