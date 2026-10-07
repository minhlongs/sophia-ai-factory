/**
 * Video Blueprints Registry & Schema Vitest Suite
 *
 * Verifies SaaS and Crypto video blueprint registrations, Zod schema validation,
 * and deterministic scene sequence timings.
 *
 * @module seed/config/video-blueprints/__tests__/video-blueprints.test
 */

import { describe, it, expect } from 'vitest';
import {
  getBlueprintById,
  listBlueprintsByNiche,
  getAllBlueprints,
  VideoBlueprintSchema,
  type VideoBlueprint,
} from '@/seed/config/video-blueprints';

describe('Video Blueprints Registry', () => {
  it('registers all 6 canonical blueprints for SaaS and Crypto', () => {
    const all = getAllBlueprints();
    expect(all).toHaveLength(6);

    const ids = all.map((b) => b.id);
    expect(ids).toContain('saas_problem_agitation_solution');
    expect(ids).toContain('saas_tool_battle_vs');
    expect(ids).toContain('saas_fast_listicle_top_tools');
    expect(ids).toContain('crypto_fee_discount_signup_bonus');
    expect(ids).toContain('crypto_trading_bot_copy_trading');
    expect(ids).toContain('crypto_exchange_launchpool');
  });

  it('filters blueprints accurately by niche', () => {
    const saasBlueprints = listBlueprintsByNiche('saas_global');
    expect(saasBlueprints).toHaveLength(3);
    for (const b of saasBlueprints) {
      expect(b.niche).toBe('saas_global');
      expect(b.aspectRatio).toBe('9:16');
    }

    const cryptoBlueprints = listBlueprintsByNiche('crypto_global');
    expect(cryptoBlueprints).toHaveLength(3);
    for (const b of cryptoBlueprints) {
      expect(b.niche).toBe('crypto_global');
      expect(b.complianceRequirements.requiresCryptoRiskBanner).toBe(true);
      expect(b.complianceRequirements.requiresEndCard15s).toBe(true);
      expect(b.complianceRequirements.restrictedJurisdictions).toEqual(['VN', 'SG']);
    }
  });

  it('retrieves blueprint by exact id or returns undefined for unknown id', () => {
    const bp = getBlueprintById('saas_problem_agitation_solution');
    expect(bp).toBeDefined();
    expect(bp?.name).toContain('Problem');
    expect(bp?.name).toContain('Agitation');

    const notFound = getBlueprintById('unknown_blueprint_999');
    expect(notFound).toBeUndefined();
  });

  it('validates every registered blueprint against VideoBlueprintSchema', () => {
    const all = getAllBlueprints();
    for (const bp of all) {
      const parsed = VideoBlueprintSchema.safeParse(bp);
      expect(parsed.success).toBe(true);
    }
  });

  it('ensures scene timelines are sequential and total duration matches defaultDurationSec', () => {
    const all = getAllBlueprints();
    for (const bp of all) {
      expect(bp.scenes.length).toBeGreaterThanOrEqual(4);

      let prevEnd = 0;
      for (const scene of bp.scenes) {
        expect(scene.startSec).toBeGreaterThanOrEqual(prevEnd);
        expect(scene.endSec).toBeGreaterThan(scene.startSec);
        prevEnd = scene.endSec;
      }
      expect(prevEnd).toBe(bp.defaultDurationSec);
    }
  });
});
