/**
 * Network Secret Resolver
 *
 * Resolves the HMAC signing secret for a given affiliate network + link.
 * Strategy:
 *   1. Map URL network slug → DB network name (affiliate_network_credentials.network)
 *   2. Look up tenant_id from tracking_links by link_id
 *   3. Fetch encrypted credentials for that tenant + network
 *   4. Return the appropriate signing secret field (api_secret / clerk_key / etc.)
 *
 * Returns null if network is unknown, tenant not found, or no credentials stored.
 */

import { getCredentials } from '@/lib/affiliates/credentials';
import type { AffiliateNetwork } from '@/lib/affiliates/credentials';

/** Maps postback URL network slug → D1 network enum value */
const NETWORK_SLUG_TO_DB: Readonly<Record<string, AffiliateNetwork>> = {
  'binance-link': 'binance',
  binance: 'binance',
  bybit: 'bybit',
  bitget: 'bitget',
  partnerstack: 'partnerstack',
  clickbank: 'clickbank',
  cj: 'cj',
  coinbase: 'coinbase',
  impact: 'impact_radius',
} as const;

/** D1 row shape for tracking_links (minimal, just what we need) */
interface TrackingLinkRow {
  tenant_id: string;
}

/**
 * Resolve the HMAC secret for a postback from a given network + link_id.
 *
 * @param db - Raw D1Database binding
 * @param networkSlug - URL path param (e.g. "binance-link", "bybit")
 * @param linkId - 8-char tracking link ID from postback payload
 * @returns signing secret string, or null if unavailable
 */
export async function resolveNetworkSecret(
  db: D1Database,
  networkSlug: string,
  linkId: string,
): Promise<string | null> {
  const dbNetwork = NETWORK_SLUG_TO_DB[networkSlug];
  if (!dbNetwork) return null;

  // Look up tenant_id from tracking_links
  const linkRow = await db
    .prepare('SELECT tenant_id FROM tracking_links WHERE id = ? LIMIT 1')
    .bind(linkId)
    .first<TrackingLinkRow>();

  if (!linkRow) return null;

  const tenantId = linkRow.tenant_id;
  const creds = await getCredentials(db, tenantId, dbNetwork);
  if (!creds) return null;

  // Extract the signing secret field per network
  switch (dbNetwork) {
    case 'binance':
    case 'bybit':
    case 'bitget':
    case 'coinbase':
      return (creds as { api_secret: string }).api_secret ?? null;

    case 'partnerstack':
    case 'cj':
      return (creds as { api_key: string }).api_key ?? null;

    case 'clickbank':
      // ClickBank uses clerk_key for webhook verification
      return (creds as { clerk_key: string }).clerk_key ?? null;

    case 'impact_radius':
      return (creds as { client_secret: string }).client_secret ?? null;

    default:
      return null;
  }
}
