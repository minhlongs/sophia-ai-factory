/**
 * CJ Affiliate network client stub.
 * Fetches from CJ API when CJ_AFFILIATE_API_KEY is set.
 * Falls back to empty array with a logged warning if missing.
 * @module lib/affiliates/scout/client-cj
 */

import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { logger } from '@/seed/utils/logger-utility';

type AffiliateRaw = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

const API_BASE = 'https://advertiser-lookup.api.cj.com/v2';

/** CJ Affiliate client — stub implementation. Real API wired when key present. */
export const cjClient: NetworkClient = {
  network: 'cj',

  async fetch(env: ScoutEnv, _tenantId: string, credentialsOverride?: Record<string, string>): Promise<AffiliateRaw[]> {
    const apiKey = credentialsOverride?.api_key ?? env.CJ_AFFILIATE_API_KEY;

    if (!apiKey) {
      logger.warn('[affiliate-scout] CJ_AFFILIATE_API_KEY not set — skipping network');
      return [];
    }

    try {
      const url = `${API_BASE}/advertiser-lookup?category=financial_services,cryptocurrency&keywords=fintech`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        logger.warn(`[affiliate-scout] CJ Affiliate returned HTTP ${res.status}`);
        return [];
      }

      const body = await res.json() as { advertisers?: { advertiser?: unknown[] } };
      const advertisers = body.advertisers?.advertiser ?? [];

      return advertisers.map((a: unknown) => {
        const adv = a as Record<string, unknown>;
        return {
          network: 'cj' as const,
          externalId: String(adv['advertiser-id'] ?? adv['id'] ?? ''),
          productName: String(adv['advertiser-name'] ?? adv['name'] ?? ''),
          productUrl: adv['program-url'] ? String(adv['program-url']) : undefined,
          commissionPct: adv['commission-rate']
            ? parseFloat(String(adv['commission-rate']))
            : undefined,
          category: adv['primary-category'] ? String(adv['primary-category']) : undefined,
          description: adv['description'] ? String(adv['description']).slice(0, 500) : undefined,
          rawPayload: JSON.stringify(adv),
        } satisfies AffiliateRaw;
      });
    } catch (err) {
      logger.error('[affiliate-scout] CJ Affiliate fetch error', { err });
      return [];
    }
  },
};
