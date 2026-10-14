/**
 * Executive BI Digest Dispatcher Orchestrator
 *
 * Layer: forest (side-effect orchestrator)
 * Allowed imports: @/seed/*, @/tree/*, @/forest/*
 *
 * @module forest/bi/executive-digest-dispatcher
 */

import type { D1Database } from '@/seed/db/client';
import {
  dispatchDigestForOrganization,
  type DispatchExecutiveDigestOptions,
  type DigestDeliveryReceipt,
} from './executive-digest-org-runner';

export type { DispatchExecutiveDigestOptions, DigestDeliveryReceipt };

/**
 * Coordinates automated executive digest generation and multi-channel delivery across organizations.
 */
export async function dispatchExecutiveDigest(
  db: D1Database,
  cadence: 'weekly' | 'monthly' = 'weekly',
  options: DispatchExecutiveDigestOptions = {},
): Promise<DigestDeliveryReceipt> {
  const now = Date.now();
  const periodDuration = cadence === 'weekly' ? 7 * 86400 * 1000 : 30 * 86400 * 1000;
  const periodStart = now - periodDuration;
  const periodEnd = now;

  let orgsQuery = `SELECT id, name, slug, tier FROM organizations WHERE status = 'active'`;
  const queryParams: unknown[] = [];

  if (options.orgId) {
    orgsQuery += ` AND id = ?1`;
    queryParams.push(options.orgId.trim());
  }

  const { results: orgs } = await db
    .prepare(orgsQuery)
    .bind(...queryParams)
    .all<{ id: string; name: string; slug: string; tier: string }>();

  const receipt: DigestDeliveryReceipt = {
    cadence,
    executedAt: now,
    periodStart,
    periodEnd,
    totalOrgs: orgs?.length ?? 0,
    telegramDeliveries: { attempted: 0, succeeded: 0, failed: 0 },
    emailDeliveries: { attempted: 0, succeeded: 0, failed: 0 },
    details: [],
  };

  if (!orgs || orgs.length === 0) {
    return receipt;
  }

  for (const org of orgs) {
    await dispatchDigestForOrganization({
      db,
      org,
      cadence,
      periodStart,
      periodEnd,
      options,
      receipt,
    });
  }

  return receipt;
}
