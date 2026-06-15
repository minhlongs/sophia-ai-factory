/**
 * PartnerStack network client stub.
 * Fetches from PartnerStack API when PARTNERSTACK_API_KEY is set.
 * Falls back to empty array with a logged warning if missing.
 * @module lib/affiliates/scout/client-partnerstack
 */

import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { logger } from '@/seed/utils/logger-utility';

type AffiliateRaw = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

const API_BASE = 'https://api.partnerstack.com/api/v2';

/** PartnerStack client — stub implementation. Real API wired when key present. */
export const partnerstackClient: NetworkClient = {
  network: 'partnerstack',

  async fetch(env: ScoutEnv, _tenantId: string, credentialsOverride?: Record<string, string>): Promise<AffiliateRaw[]> {
    const apiKey = credentialsOverride?.api_key ?? env.PARTNERSTACK_API_KEY;

    if (!apiKey) {
      logger.warn('[affiliate-scout] PARTNERSTACK_API_KEY not set — skipping network');
      return [];
    }

    try {
      const url = `${API_BASE}/programs?category=saas,fintech,crypto&active=true`;
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${btoa(apiKey + ':')}` },
      });

      if (!res.ok) {
        logger.warn(`[affiliate-scout] PartnerStack returned HTTP ${res.status}`);
        return [];
      }

      const body = await res.json() as { data?: unknown[] };
      const programs = body.data ?? [];

      return programs.map((p: unknown) => {
        const prog = p as Record<string, unknown>;
        return {
          network: 'partnerstack' as const,
          externalId: String(prog['key'] ?? prog['id'] ?? ''),
          productName: String(prog['name'] ?? ''),
          productUrl: prog['apply_url'] ? String(prog['apply_url']) : undefined,
          commissionPct: prog['default_commission_pct']
            ? parseFloat(String(prog['default_commission_pct']))
            : undefined,
          category: prog['vertical'] ? String(prog['vertical']) : undefined,
          description: prog['description'] ? String(prog['description']).slice(0, 500) : undefined,
          rawPayload: JSON.stringify(prog),
        } satisfies AffiliateRaw;
      });
    } catch (err) {
      logger.error('[affiliate-scout] PartnerStack fetch error', { err });
      return [];
    }
  },
};
