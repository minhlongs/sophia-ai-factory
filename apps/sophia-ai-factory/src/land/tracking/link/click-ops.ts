/**
 * Tracking Click and Conversion Operations
 *
 * Layer: land/tracking
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

export interface IdempotentConversionResult {
  conversionId: string | null;
  /** True when a previous postback with the same provider receipt already stored a row. */
  duplicate: boolean;
}

/**
 * Record an S2S postback conversion exactly once per provider receipt.
 *
 * Uses raw D1 with `ON CONFLICT DO NOTHING` against the partial unique index
 * from migration 0487 (`link_id, network, external_conversion_id`). Replays
 * return `{ duplicate: true }` instead of writing a second row. Rows without a
 * provider receipt id keep legacy append behavior (the index only covers
 * non-NULL receipt ids).
 *
 * The caller must have resolved + verified the tenant (link ownership and
 * HMAC) before calling: tenant is inherited from tracking_links via link_id.
 */
export async function recordConversionIdempotent(
  db: D1Database,
  linkId: string,
  network: string,
  payload: PostbackPayload,
): Promise<IdempotentConversionResult> {
  const conversionId = generateShortId() + generateShortId();
  const now = new Date().toISOString();
  const externalId = payload.externalConversionId?.toString().slice(0, 128) ?? null;

  const res = await db
    .prepare(
      `INSERT INTO tracking_conversions
         (id, link_id, network, external_conversion_id, amount_usd, ts, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(link_id, network, external_conversion_id, amount_usd)
         WHERE external_conversion_id IS NOT NULL DO NOTHING`,
    )
    .bind(
      conversionId,
      linkId,
      network.slice(0, 64),
      externalId,
      typeof payload.amountUsd === 'number' ? payload.amountUsd : null,
      now,
      JSON.stringify(payload).slice(0, 4096),
    )
    .run();

  if ((res.meta?.changes ?? 0) === 0 && externalId !== null) {
    return { conversionId: null, duplicate: true };
  }
  return { conversionId, duplicate: false };
}
