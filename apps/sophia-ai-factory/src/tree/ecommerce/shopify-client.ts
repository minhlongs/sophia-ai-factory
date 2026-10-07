/**
 * Shopify Admin GraphQL Client
 *
 * Fetches product catalog data from Shopify Admin API using GraphQL.
 * Protected with per-store circuit breaker and FailureKind classification.
 *
 * Layer: tree (reusable domain logic, imports seed only)
 * @module tree/ecommerce/shopify-client
 */

import { type Result, success, failure } from '@/seed/types/result';
import { FailureKind, classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { logger } from '@/seed/utils/logger-utility';
import type { ShopifyStoreConfig, CommerceClientError } from '@/seed/types/ecommerce';

export interface ShopifyProductNode {
  id: string;
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  status: string;
  tags: string[];
  onlineStoreUrl?: string;
  variants?: {
    edges: Array<{
      node: {
        price: string;
      };
    }>;
  };
  images?: {
    edges: Array<{
      node: {
        url: string;
      };
    }>;
  };
}

const PRODUCTS_QUERY = `
query GetProducts($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        descriptionHtml
        vendor
        productType
        status
        tags
        onlineStoreUrl
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
        images(first: 5) {
          edges {
            node {
              url
            }
          }
        }
      }
    }
  }
}
`;

export async function fetchShopifyProducts(
  config: ShopifyStoreConfig,
  options: { limit?: number; query?: string } = {}
): Promise<Result<ShopifyProductNode[], CommerceClientError>> {
  const serviceKey = 'shopify';
  const limit = options.limit ?? 20;

  if (!shouldAllowRequest(serviceKey, config.shopDomain)) {
    return failure({
      kind: FailureKind.RATE_LIMIT,
      message: `Shopify circuit breaker active for domain ${config.shopDomain}`,
    });
  }

  const cleanDomain = config.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const endpoint = `https://${cleanDomain}/admin/api/${config.apiVersion ?? '2024-04'}/graphql.json`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.accessToken,
      },
      body: JSON.stringify({
        query: PRODUCTS_QUERY,
        variables: { first: limit, query: options.query ?? null },
      }),
    });

    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure(serviceKey, kind, config.shopDomain);
      return failure({
        kind,
        message: `Shopify HTTP ${res.status}: ${res.statusText}`,
        status: res.status,
      });
    }

    const payload = (await res.json()) as {
      data?: { products?: { edges?: Array<{ node: ShopifyProductNode }> } };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors && payload.errors.length > 0) {
      recordFailure(serviceKey, FailureKind.SERVER_ERROR, config.shopDomain);
      return failure({
        kind: FailureKind.SERVER_ERROR,
        message: payload.errors.map((e) => e.message).join('; '),
      });
    }

    recordSuccess(serviceKey, config.shopDomain);
    const edges = payload.data?.products?.edges ?? [];
    const products = edges.map((e) => e.node);
    return success(products);
  } catch (err) {
    const kind = classifyError(err);
    recordFailure(serviceKey, kind, config.shopDomain);
    logger.warn('[ShopifyClient] Request failed', {
      shopDomain: config.shopDomain,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({
      kind,
      message: err instanceof Error ? err.message : 'Unknown Shopify request error',
    });
  }
}
