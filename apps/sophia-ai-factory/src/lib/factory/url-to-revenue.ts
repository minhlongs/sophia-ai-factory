/**
 * URL-to-Revenue Orchestrator
 *
 * Sophia's moat feature: paste affiliate URL → persist job + variants → embed tracking link.
 *
 * Architecture: orchestrator-only pattern.
 * - Extracts product info from URL
 * - Persists job + variants to D1
 *
 * NOTE (2026-05-17, ADR 0007): Video chain dispatch (Inngest video.requested → scripting → tts
 * → compose → upload → publish) was deprecated because its underlying `video_jobs` table was
 * never applied to prod D1. `dispatchVideoRequest` is now a no-op stub; video generation has
 * moved to the HeyGen mission flow.
 */

import { randomUUID } from 'crypto';
import { getD1Client } from '@/seed/db/client';
import { extractProductInfo } from './url-product-extractor';
import { logger } from '@/seed/utils/logger-utility';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobStatus =
  | 'queued'
  | 'scripting'
  | 'rendering'
  | 'publishing'
  | 'completed'
  | 'failed';

export type Channel = 'youtube' | 'tiktok' | 'instagram';

export interface URLToRevenueRequest {
  /** Affiliate landing page URL — must be HTTPS */
  url: string;
  tenantId: string;
  channels: Channel[];
  /** Number of variants per locale (default 3, max 5 per YAGNI) */
  variants?: number;
  /** Locales to generate (default ['vi', 'en']) */
  locales?: string[];
  /** Tracking link ID from edge tracking (optional) */
  trackingId?: string;
}

export interface URLToRevenueVariant {
  locale: string;
  channel: Channel;
  videoJobId?: string;
  publishedUrl?: string;
  error?: string;
}

export interface URLToRevenueResult {
  jobId: string;
  status: JobStatus;
  variants: URLToRevenueVariant[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRequest(req: URLToRevenueRequest): string | null {
  if (!req.url || !req.url.startsWith('https://')) {
    return 'url must be an HTTPS URL';
  }
  if (!req.tenantId || req.tenantId.trim() === '') {
    return 'tenantId is required';
  }
  if (!req.channels || req.channels.length === 0) {
    return 'channels must be a non-empty array';
  }
  const validChannels: Channel[] = ['youtube', 'tiktok', 'instagram'];
  for (const ch of req.channels) {
    if (!validChannels.includes(ch)) {
      return `invalid channel: ${ch}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Inngest event dispatch (lazy import to avoid build-time coupling)
// ---------------------------------------------------------------------------

async function dispatchVideoRequested(params: {
  jobId: string;
  tenantId: string;
  prompt: string;
  locale: string;
  channel: Channel;
  trackingLink?: string;
}): Promise<void> {
  // Deprecated 2026-05-17 (ADR 0007): the `url_revenue.video.requested` chain
  // depended on the `video_jobs` table which was never applied to prod D1.
  // The handler chain has been removed from Inngest serve registration.
  // URL-to-Revenue jobs are still persisted in `url_to_revenue_jobs`; video
  // generation is handled by HeyGen direct path (mission video:create).
  logger.warn('[url-to-revenue] video dispatch deprecated — use HeyGen mission path', {
    jobId: params.jobId,
    locale: params.locale,
    channel: params.channel,
  });
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Start a URL-to-revenue job.
 * Extracts product info, persists to D1, queues Inngest events per variant.
 */
export async function startUrlToRevenue(
  req: URLToRevenueRequest,
): Promise<URLToRevenueResult> {
  const validationError = validateRequest(req);
  if (validationError) throw new Error(validationError);

  const variants = Math.min(req.variants ?? 3, 5);
  const locales = req.locales?.length ? req.locales : ['vi', 'en'];
  const jobId = randomUUID();
  const now = new Date().toISOString();

  // Extract product info (non-blocking failure: use empty defaults)
  let productTitle = '';
  let productDescription = '';
  let productImageUrl = '';
  let productPrice = '';

  try {
    const info = await extractProductInfo(req.url);
    productTitle = info.title;
    productDescription = info.description;
    productImageUrl = info.imageUrl;
    productPrice = info.price;
  } catch (err) {
    logger.warn('[url-to-revenue] Product extraction failed, continuing with empty metadata', {
      url: req.url,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Build variant slots (locale × channel combinations, capped at variants count)
  const variantSlots: URLToRevenueVariant[] = [];
  outer: for (const locale of locales) {
    for (const channel of req.channels) {
      if (variantSlots.length >= variants) break outer;
      variantSlots.push({ locale, channel });
    }
  }

  // Persist job to D1
  const db = await getD1Client();
  await db.from('url_to_revenue_jobs').insert({
    id: jobId,
    tenant_id: req.tenantId,
    url: req.url,
    status: 'queued',
    channels_json: JSON.stringify(req.channels),
    locales_json: JSON.stringify(locales),
    variants_count: variants,
    tracking_id: req.trackingId ?? null,
    product_title: productTitle,
    product_description: productDescription,
    product_image_url: productImageUrl,
    product_price: productPrice,
    variants_json: JSON.stringify(variantSlots),
    error_message: null,
    created_at: now,
    updated_at: now,
  });

  // Dispatch Inngest events for each variant
  for (const variant of variantSlots) {
    const prompt = [
      productTitle ? `Product: ${productTitle}` : '',
      productDescription ? `Description: ${productDescription}` : '',
      productPrice ? `Price: ${productPrice}` : '',
      `Affiliate URL: ${req.url}`,
      req.trackingId ? `Tracking URL: https://track.sophia.agencyos.network/r/${req.trackingId}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await dispatchVideoRequested({
      jobId,
      tenantId: req.tenantId,
      prompt,
      locale: variant.locale,
      channel: variant.channel,
      trackingLink: req.trackingId,
    });
  }

  logger.info('[url-to-revenue] Job created', {
    jobId,
    tenantId: req.tenantId,
    variants: variantSlots.length,
  });

  return { jobId, status: 'queued', variants: variantSlots };
}

/**
 * Get current status of a URL-to-revenue job.
 * Enforces tenant isolation.
 */
export async function getJobStatus(
  tenantId: string,
  jobId: string,
): Promise<URLToRevenueResult> {
  const db = await getD1Client();
  const { data, error } = await db
    .from('url_to_revenue_jobs')
    .select('id,status,variants_json')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const row = data as { id: string; status: JobStatus; variants_json: string };
  let variants: URLToRevenueVariant[] = [];
  try {
    variants = JSON.parse(row.variants_json) as URLToRevenueVariant[];
  } catch { /* malformed json — return empty */ }

  return { jobId: row.id, status: row.status, variants };
}
