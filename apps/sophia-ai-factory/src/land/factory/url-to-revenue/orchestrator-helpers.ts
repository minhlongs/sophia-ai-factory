/**
 * URL-to-Revenue Orchestration Helpers
 *
 * Layer: land/factory
 */

import { extractProductInfo } from '@/seed/factory/url-product-extractor';
import { logger } from '@/seed/utils/logger-utility';
import type {
  URLToRevenueRequest,
  URLToRevenueVariant,
  Channel,
} from './types';

export interface SafeProductMetadata {
  productTitle: string;
  productDescription: string;
  productImageUrl: string;
  productPrice: string;
}

export async function extractSafeProductMetadata(url: string): Promise<SafeProductMetadata> {
  try {
    const info = await extractProductInfo(url);
    return {
      productTitle: info.title,
      productDescription: info.description,
      productImageUrl: info.imageUrl,
      productPrice: info.price,
    };
  } catch (err) {
    logger.warn(
      '[url-to-revenue] Product extraction failed, continuing with empty metadata',
      {
        url,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return {
      productTitle: '',
      productDescription: '',
      productImageUrl: '',
      productPrice: '',
    };
  }
}

export function buildVariantSlots(
  locales: string[],
  channels: Channel[],
  variantsCount: number,
): URLToRevenueVariant[] {
  const variantSlots: URLToRevenueVariant[] = [];
  outer: for (const locale of locales) {
    for (const channel of channels) {
      if (variantSlots.length >= variantsCount) break outer;
      variantSlots.push({ locale, channel });
    }
  }
  return variantSlots;
}

export function buildVariantPrompt(
  req: URLToRevenueRequest,
  meta: SafeProductMetadata,
): string {
  return [
    meta.productTitle ? `Product: ${meta.productTitle}` : '',
    meta.productDescription ? `Description: ${meta.productDescription}` : '',
    meta.productPrice ? `Price: ${meta.productPrice}` : '',
    `Affiliate URL: ${req.url}`,
    req.trackingId
      ? `Tracking URL: https://track.sophia.agencyos.network/r/${req.trackingId}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function dispatchVideoRequested(params: {
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
  logger.warn(
    '[url-to-revenue] video dispatch deprecated — use HeyGen mission path',
    {
      jobId: params.jobId,
      locale: params.locale,
      channel: params.channel,
    },
  );
}
