/**
 * Tracking Click and Conversion Operations
 *
 * Layer: forest/tracking
 */

import { createServerClient } from '@/seed/db/client';
import type { PostbackPayload } from './types';
import { generateShortId, hashIp, getTenantSecret } from './crypto-id';

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
