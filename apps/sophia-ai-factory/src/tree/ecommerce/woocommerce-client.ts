/**
 * WooCommerce REST v3 Client
 *
 * Fetches product catalog from WooCommerce store using REST API v3.
 * Protected with per-store circuit breaker and FailureKind classification.
 *
 * Layer: tree (reusable domain logic, imports seed only)
 * @module tree/ecommerce/woocommerce-client
 */

import { type Result, success, failure } from '@/seed/types/result';
import { FailureKind, classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import type { WooCommerceStoreConfig, CommerceClientError } from '@/seed/types/ecommerce';

export interface WooCommerceProductPayload {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  status: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  currency?: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  tags: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; name?: string; alt?: string }>;
}

export async function fetchWooCommerceProducts(
  config: WooCommerceStoreConfig,
  options: { limit?: number; status?: string; search?: string } = {}
): Promise<Result<WooCommerceProductPayload[], CommerceClientError>> {
  const serviceKey = 'woocommerce';
  const cleanUrl = config.storeUrl.replace(/\/$/, '');
  const host = new URL(cleanUrl).host;

  if (!shouldAllowRequest(serviceKey, host)) {
    return failure({
      kind: FailureKind.RATE_LIMIT,
      message: `WooCommerce circuit breaker active for store ${host}`,
    });
  }

  const limit = options.limit ?? 20;
  const status = options.status ?? 'publish';
  const searchParam = options.search ? `&search=${encodeURIComponent(options.search)}` : '';
  const version = config.version ?? 'wc/v3';
  const endpoint = `${cleanUrl}/wp-json/${version}/products?per_page=${limit}&status=${status}${searchParam}`;

  // Basic authentication token
  const authCredentials = `${config.consumerKey}:${config.consumerSecret}`;
  const base64Auth = typeof btoa === 'function'
    ? btoa(authCredentials)
    : Buffer.from(authCredentials).toString('base64');

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${base64Auth}`,
      },
    });

    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure(serviceKey, kind, host);
      return failure({
        kind,
        message: `WooCommerce HTTP ${res.status}: ${res.statusText}`,
        status: res.status,
      });
    }

    const products = (await res.json()) as WooCommerceProductPayload[];
    recordSuccess(serviceKey, host);
    return success(products);
  } catch (err) {
    const kind = classifyError(err);
    recordFailure(serviceKey, kind, host);
    logger.warn('[WooCommerceClient] Request failed', {
      storeHost: host,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({
      kind,
      message: err instanceof Error ? err.message : 'Unknown WooCommerce request error',
    });
  }
}
