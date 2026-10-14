/**
 * Tracking Link Operations
 *
 * Layer: land/tracking
 */

import { createServerClient } from '@/seed/db/client';
import type { CreateLinkParams, TrackingLink } from './types';
import { generateShortId } from './crypto-id';

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
