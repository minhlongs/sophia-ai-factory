/**
 * Helper utilities for URL-to-Revenue Job Orchestration
 *
 * Layer: seed/factory
 * @module seed/factory/url-to-revenue/orchestrator-helpers
 */

import { extractProductInfo } from '../url-product-extractor';
import { logger } from '@/seed/utils/logger-utility';
import type { Channel, URLToRevenueVariant } from './types';

export interface ExtractedProductMetadata {
  title: string;
  description: string;
  imageUrl: string;
  price: string;
}

export async function safeExtractProductInfo(url: string): Promise<ExtractedProductMetadata> {
  try {
    const info = await extractProductInfo(url);
    return {
      title: info.title,
      description: info.description,
      imageUrl: info.imageUrl,
      price: info.price,
    };
  } catch (err) {
    logger.warn(
      '[url-to-revenue] Product extraction failed, continuing with empty metadata',
      {
        url,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return { title: '', description: '', imageUrl: '', price: '' };
  }
}

export function buildVariantSlots(
  locales: string[],
  channels: Channel[],
  maxVariants: number,
): URLToRevenueVariant[] {
  const variantSlots: URLToRevenueVariant[] = [];
  outer: for (const locale of locales) {
    for (const channel of channels) {
      if (variantSlots.length >= maxVariants) break outer;
      variantSlots.push({ locale, channel });
    }
  }
  return variantSlots;
}

export function buildVariantPrompt(
  meta: ExtractedProductMetadata,
  url: string,
  trackingId?: string,
): string {
  return [
    meta.title ? `Product: ${meta.title}` : '',
    meta.description ? `Description: ${meta.description}` : '',
    meta.price ? `Price: ${meta.price}` : '',
    `Affiliate URL: ${url}`,
    trackingId
      ? `Tracking URL: https://track.sophia.agencyos.network/r/${trackingId}`
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
  logger.warn(
    '[url-to-revenue] video dispatch deprecated — use HeyGen mission path',
    {
      jobId: params.jobId,
      locale: params.locale,
      channel: params.channel,
    },
  );
}
