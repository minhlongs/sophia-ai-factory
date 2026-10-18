/**
 * @file cloudflare-saas-http.ts
 * @description Shared HTTP transport helper for Cloudflare Custom Hostname API requests.
 * @layer tree
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  CloudflareApiResponse,
  CustomDomainError,
} from '@/seed/types/custom-domains';

export interface CloudflareRequestOptions {
  url: string;
  method: 'POST' | 'GET' | 'DELETE';
  apiToken: string;
  body?: Record<string, unknown>;
  fallbackErrorLabel: string;
  operationLogName: string;
}

export async function executeCloudflareCustomHostnameRequest<T>(
  options: CloudflareRequestOptions,
): Promise<Result<T, CustomDomainError>> {
  const { url, method, apiToken, body, fallbackErrorLabel, operationLogName } = options;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data = (await res.json()) as CloudflareApiResponse<T>;
    if (!res.ok || !data.success) {
      const errorMsg =
        data.errors?.[0]?.message ?? `HTTP ${res.status}: ${fallbackErrorLabel}`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error(`[CloudflareSaaS] ${operationLogName} request failed`, error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}
