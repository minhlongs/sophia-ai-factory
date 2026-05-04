/**
 * Impact Radius network client stub.
 * Fetches from Impact Radius API when IMPACT_RADIUS_API_KEY is set.
 * Falls back to empty array with a logged warning if missing.
 * @module lib/affiliates/scout/client-impact-radius
 */

import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { logger } from '@/seed/utils/logger-utility';

type AffiliateRaw = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

const API_BASE = 'https://api.impact.com/Mediapartners';

/** Impact Radius client — stub implementation. Real API wired when key present. */
export const impactRadiusClient: NetworkClient = {
  network: 'impact_radius',

  async fetch(env: ScoutEnv, _tenantId: string): Promise<AffiliateRaw[]> {
    const apiKey = env.IMPACT_RADIUS_API_KEY;

    if (!apiKey) {
      logger.warn('[affiliate-scout] IMPACT_RADIUS_API_KEY not set — skipping network');
      return [];
    }

    try {
      const url = `${API_BASE}/Programs?Category=fintech,crypto,saas&MinEpc=5&format=json`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        logger.warn(`[affiliate-scout] Impact Radius returned HTTP ${res.status}`);
        return [];
      }

      const body = await res.json() as { Programs?: unknown[] };
      const programs = body.Programs ?? [];

      return programs.map((p: unknown) => {
        const prog = p as Record<string, unknown>;
        return {
          network: 'impact_radius' as const,
          externalId: String(prog['Id'] ?? ''),
          productName: String(prog['Name'] ?? ''),
          productUrl: prog['TrackingLink'] ? String(prog['TrackingLink']) : undefined,
          commissionPct: prog['DefaultPayout'] ? parseFloat(String(prog['DefaultPayout'])) : undefined,
          category: prog['Category'] ? String(prog['Category']) : undefined,
          description: prog['Description'] ? String(prog['Description']).slice(0, 500) : undefined,
          rawPayload: JSON.stringify(prog),
        } satisfies AffiliateRaw;
      });
    } catch (err) {
      logger.error('[affiliate-scout] Impact Radius fetch error', { err });
      return [];
    }
  },
};
