/**
 * Edge Tracking — cookieless S2S affiliate link tracking.
 *
 * Features:
 * - Base62 8-char short IDs (Web Crypto)
 * - IP hashing for privacy (sha256 + tenant_secret)
 * - Country extraction from CF-IPCountry header
 * - D1 persistence for clicks + conversions
 *
 * Raw IP is NEVER stored — only sha256(ip + tenant_secret).
 *
 * Subdomain: track.sophia.agencyos.network/r/[id]
 * See tracking-README.md for DNS + Wrangler route setup.
 */

import { createServerClient } from '@/seed/db/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateLinkParams {
  tenantId: string;
  destinationUrl: string;
  affiliateId?: string;
  campaignId?: string;
}

export interface TrackingLink {
  id: string;
  tenantId: string;
  destinationUrl: string;
  affiliateId: string | null;
  campaignId: string | null;
  active: boolean;
  createdAt: string;
  /** Short URL for embedding in content */
  shortUrl: string;
}

export interface PostbackPayload {
  externalConversionId?: string;
  amountUsd?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ID generation — Web Crypto base62
// ---------------------------------------------------------------------------

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORT_ID_LENGTH = 8;

/**
 * Generate a cryptographically random 8-char base62 ID.
 * Uses Web Crypto (available in CF Workers + Node 20+).
 */
export function generateShortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHORT_ID_LENGTH));
  return Array.from(bytes)
    .map((b) => BASE62[b % 62])
    .join('');
}

// ---------------------------------------------------------------------------
// IP hashing — privacy-preserving
// ---------------------------------------------------------------------------

/**
 * Hash IP address using sha256(ip + tenantSecret).
 * Raw IP is NOT stored — only the hash.
 */
async function hashIp(ip: string, tenantSecret: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}:${tenantSecret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getTenantSecret(tenantId: string): string {
  // Derives a per-tenant secret from env + tenantId.
  // In production, TRACKING_HMAC_SECRET should be a 32+ byte random value.
  const base = (globalThis as Record<string, unknown>).__env as Record<string, string> | undefined;
  const envSecret = base?.TRACKING_HMAC_SECRET ?? 'sophia-tracking-secret';
  return `${envSecret}:${tenantId}`;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Create a tracking link and persist to D1.
 * Returns the link with a shortUrl for embedding in content.
 */
export async function createTrackingLink(
  params: CreateLinkParams,
): Promise<{ id: string; shortUrl: string }> {
  const id = generateShortId();
  const now = new Date().toISOString();

  const db = createServerClient();
  await db.from('tracking_links').insert({
    id,
    tenant_id: params.tenantId,
    destination_url: params.destinationUrl,
    affiliate_id: params.affiliateId ?? null,
    campaign_id: params.campaignId ?? null,
    created_at: now,
    active: 1,
  });

  const shortUrl = `https://track.sophia.agencyos.network/r/${id}`;
  return { id, shortUrl };
}

/**
 * Record a click on a tracking link.
 * Extracts metadata from the incoming request.
 * Returns the destination URL for 302 redirect.
 */
export async function recordClick(
  linkId: string,
  request: Request,
): Promise<string> {
  const db = createServerClient();

  // Fetch link with tenant for privacy scope
  const { data, error } = await db
    .from('tracking_links')
    .select('destination_url,tenant_id,active')
    .eq('id', linkId)
    .single();

  if (error || !data) throw new Error('Link not found');

  const row = data as { destination_url: string; tenant_id: string; active: number };

  if (!row.active) throw new Error('Link inactive');

  // Extract request metadata
  const headers = request.headers as unknown as { get(name: string): string | null };
  const rawIp =
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';
  const country = headers.get('cf-ipcountry') ?? '';
  const userAgent = headers.get('user-agent') ?? '';
  const referrer = headers.get('referer') ?? '';

  const ipHash = rawIp
    ? await hashIp(rawIp, getTenantSecret(row.tenant_id))
    : null;

  const clickId = generateShortId() + generateShortId(); // 16-char for clicks
  const now = new Date().toISOString();

  await db.from('tracking_clicks').insert({
    id: clickId,
    link_id: linkId,
    ts: now,
    ip_hash: ipHash,
    user_agent: userAgent.slice(0, 512), // cap UA length
    referrer: referrer.slice(0, 1024),
    country: country.slice(0, 10),
  });

  return row.destination_url;
}

/**
 * Record an affiliate network S2S postback conversion.
 */
export async function recordConversion(
  linkId: string,
  network: string,
  payload: PostbackPayload,
): Promise<void> {
  const conversionId = generateShortId() + generateShortId();
  const now = new Date().toISOString();

  const db = createServerClient();
  await db.from('tracking_conversions').insert({
    id: conversionId,
    link_id: linkId,
    network: network.slice(0, 64),
    external_conversion_id: payload.externalConversionId?.toString().slice(0, 128) ?? null,
    amount_usd: typeof payload.amountUsd === 'number' ? payload.amountUsd : null,
    ts: now,
    raw_payload: JSON.stringify(payload).slice(0, 4096),
  });
}

/**
 * Look up a tracking link by ID with tenant validation.
 */
export async function getTrackingLink(
  tenantId: string,
  linkId: string,
): Promise<TrackingLink | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('tracking_links')
    .select('id,tenant_id,destination_url,affiliate_id,campaign_id,active,created_at')
    .eq('id', linkId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) return null;

  const row = data as {
    id: string;
    tenant_id: string;
    destination_url: string;
    affiliate_id: string | null;
    campaign_id: string | null;
    active: number;
    created_at: string;
  };

  return {
    id: row.id,
    tenantId: row.tenant_id,
    destinationUrl: row.destination_url,
    affiliateId: row.affiliate_id,
    campaignId: row.campaign_id,
    active: row.active === 1,
    createdAt: row.created_at,
    shortUrl: `https://track.sophia.agencyos.network/r/${row.id}`,
  };
}
