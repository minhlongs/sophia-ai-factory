/**
 * Affiliate Scout Orchestrator
 *
 * @module land/affiliates/scout/writer/orchestrator
 */

import type { ScoutEnv, ScoutResult } from '../types';
import { mockClient } from '../client-mock';
import type { ScoringContext } from '../scoring';
import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_SCORING } from '@/seed/tenant-settings/defaults';
import type { ScoringSettings } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import { ALL_CLIENTS } from './client-registry';
import { processOffer } from './offer-processor';
import type { ScoutRunResult } from './types';
import { getCredentials, type AffiliateNetwork } from '@/land/affiliates/credentials';

/**
 * Run the affiliate scout for a single tenant.
 * - Loads per-tenant scoring weights/threshold from tenant-settings (falls back to DEFAULT_SCORING).
 * - Queries D1 for per-tenant BYOK credentials; only queries networks with valid BYOK.
 * - In non-test environments, zero-mock policy is enforced (never falls back to mock).
 * - Scores each affiliate; skips insert if score < threshold (default 0.7).
 * - Inserts new qualifying affiliates (UNIQUE constraint prevents duplicates).
 * - Emits `affiliate.discovered` webhook for each new insert, unless geo-blocked.
 */
export async function runAffiliateScout(
  env: ScoutEnv,
  tenantId: string,
  scoringCtx?: ScoringContext,
  tenantCountry?: string,
): Promise<ScoutRunResult> {
  const db = env.DB;
  if (!db) {
    logger.warn('[affiliate-scout] No D1 binding — aborting scout');
    return { discovered: 0, errors: [] };
  }

  const tenantScoring = await getOrDefault<ScoringSettings>(db, tenantId, 'scoring', DEFAULT_SCORING);
  const effectiveScoringCtx: ScoringContext = {
    weights: { ...tenantScoring.weights, ...scoringCtx?.weights },
    threshold: scoringCtx?.threshold ?? tenantScoring.threshold,
    ...scoringCtx,
  };

  const isTestEnv = process.env.NODE_ENV === 'test';
  const clientTargets: Array<{ client: (typeof ALL_CLIENTS)[number]; creds?: Record<string, string> }> = [];

  for (const client of ALL_CLIENTS) {
    try {
      const cred = await getCredentials(db, tenantId, client.network as AffiliateNetwork);
      if (cred) {
        clientTargets.push({ client, creds: cred as unknown as Record<string, string> });
      }
    } catch {
      // Ignored: network has no configured credentials for this tenant
    }
  }

  if (clientTargets.length === 0) {
    if (isTestEnv) {
      logger.info('[affiliate-scout] Test environment with no BYOK: using test mock client');
      clientTargets.push({ client: mockClient });
    } else {
      logger.warn(`[affiliate-scout] Tenant ${tenantId} has zero configured BYOK affiliate credentials — aborting run without mocks`);
      return {
        discovered: 0,
        errors: [{
          network: 'mock',
          affiliates: [],
          error: `NO_CONFIGURED_CREDENTIALS: Tenant ${tenantId} has no configured BYOK affiliate network credentials`,
        }],
      };
    }
  }

  const settled = await Promise.allSettled(
    clientTargets.map(async ({ client, creds }) => {
      const raw = await client.fetch(env, tenantId, creds);
      return { network: client.network, affiliates: raw };
    }),
  );

  const now = new Date().toISOString();
  const errors: ScoutResult[] = [];
  let discovered = 0;

  for (const result of settled) {
    if (result.status === 'rejected') {
      errors.push({
        network: 'mock',
        affiliates: [],
        error: String(result.reason),
      });
      continue;
    }

    const { network, affiliates: rawList } = result.value;
    for (const raw of rawList) {
      const isNew = await processOffer(
        env,
        db,
        tenantId,
        raw,
        now,
        effectiveScoringCtx,
        tenantCountry,
      );
      if (isNew) {
        discovered++;
      }
    }

    logger.info(`[affiliate-scout] ${network}: ${rawList.length} fetched, ${discovered} new so far`);
  }

  return { discovered, errors };
}
