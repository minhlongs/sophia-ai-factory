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

import { getCredentials } from '@/land/affiliates/credentials';
import type { AffiliateNetwork } from '@/land/affiliates/credentials';

/** Maps postback URL network slug → D1 network enum value */
const NETWORK_SLUG_TO_DB: Readonly<Record<string, string>> = {
  'binance-link': 'binance',
  binance: 'binance',
  bybit: 'bybit',
  bitget: 'bitget',
  okx: 'okx',
  partnerstack: 'partnerstack',
  rewardful: 'rewardful',
  clickbank: 'clickbank',
  cj: 'cj',
  coinbase: 'coinbase',
  impact: 'impact_radius',
  awin: 'awin',
  shareasale: 'shareasale',
  rakuten: 'rakuten',
  tiktok_shop: 'tiktok_shop',
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
  const creds = await getCredentials(db, tenantId, dbNetwork as AffiliateNetwork);
  if (!creds) return null;

  const credsRecord = creds as unknown as Record<string, string | undefined>;

  // Extract the signing secret field per network
  switch (dbNetwork) {
    case 'binance':
    case 'bybit':
    case 'bitget':
    case 'coinbase':
    case 'okx':
    case 'shareasale':
    case 'tiktok_shop':
      return credsRecord.api_secret ?? credsRecord.api_key ?? null;

    case 'partnerstack':
    case 'rewardful':
    case 'cj':
    case 'awin':
    case 'rakuten':
      return credsRecord.api_key ?? credsRecord.api_secret ?? credsRecord.oauth_token ?? null;

    case 'clickbank':
      // ClickBank uses clerk_key for webhook verification
      return credsRecord.clerk_key ?? credsRecord.api_secret ?? null;

    case 'impact_radius':
      return credsRecord.client_secret ?? credsRecord.api_secret ?? null;

    default:
      return credsRecord.api_secret ?? credsRecord.api_key ?? null;
  }
}
