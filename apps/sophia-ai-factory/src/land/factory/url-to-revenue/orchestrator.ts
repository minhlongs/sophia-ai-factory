/**
 * URL-to-Revenue Job Orchestration
 *
 * Layer: land/factory
 */

import { randomUUID } from 'crypto';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  URLToRevenueRequest,
  URLToRevenueResult,
  URLToRevenueVariant,
  JobStatus,
} from './types';
import { validateRequest } from './validator';
import {
  buildVariantPrompt,
  buildVariantSlots,
  dispatchVideoRequested,
  extractSafeProductMetadata,
} from './orchestrator-helpers';

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

  const meta = await extractSafeProductMetadata(req.url);
  const variantSlots = buildVariantSlots(locales, req.channels, variants);

  const db = createServerClient();
  await db.from('url_to_revenue_jobs').insert({
    id: jobId,
    tenant_id: req.tenantId,
    url: req.url,
    status: 'queued',
    channels_json: JSON.stringify(req.channels),
    locales_json: JSON.stringify(locales),
    variants_count: variants,
    tracking_id: req.trackingId ?? null,
    product_title: meta.productTitle,
    product_description: meta.productDescription,
    product_image_url: meta.productImageUrl,
    product_price: meta.productPrice,
    variants_json: JSON.stringify(variantSlots),
    error_message: null,
    created_at: now,
    updated_at: now,
  });

  const prompt = buildVariantPrompt(req, meta);
  for (const variant of variantSlots) {
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
  const db = createServerClient();
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
  } catch {
    /* malformed json — return empty */
  }

  return { jobId: row.id, status: row.status, variants };
}
