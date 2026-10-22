/**
 * audience-jurisdiction.ts — Resolve the jurisdiction a campaign publishes to.
 *
 * The compliance gate needs a jurisdiction to decide whether regulated content
 * may be published. Campaigns carry no jurisdiction of their own, so it is read
 * from the tenant's declared geo settings — the source the tenant actually
 * controls — with an explicit, conservative fallback.
 *
 * Channel adapters deliberately are NOT consulted: `GatewayChannel` and
 * `ChannelAdapter` carry no country field, so reading one would mean inventing
 * data that does not exist. Unknown is a valid answer and callers treat it as
 * blocked rather than guessing.
 *
 * @module tree/affiliates/audience-jurisdiction
 */

import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import { getOrDefault } from '@/seed/tenant-settings/registry';

interface GeoSettings {
  targetJurisdiction?: string;
  /** Free-form country hints the tenant may have recorded. */
  audienceCountries?: string[];
}

/**
 * Resolve the tenant's declared audience jurisdiction, or null when unknown.
 *
 * Returns null on any failure: a missing setting is normal for a tenant that
 * has not declared one, and a database error must surface as "unknown" rather
 * than silently defaulting to a permissive jurisdiction.
 */
export async function resolveAudienceJurisdiction(
  tenantId: string,
): Promise<string | null> {
  try {
    const db = await getD1();
    if (!db) return null;
    const geo = await getOrDefault<GeoSettings>(db, tenantId, 'geo', {});
    const declared = geo?.targetJurisdiction?.trim();
    return declared && declared.length > 0 ? declared.toUpperCase() : null;
  } catch (error) {
    logger.warn('[geo-gate] could not resolve audience jurisdiction, treating as unknown', {
      tenantId,
      error: String(error),
    });
    return null;
  }
}
