/**
 * Request logging for agent API.
 * @module tree/api/agent-auth/request-logger
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export interface LogApiRequestParams {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  requestBodySize?: number;
  responseBodySize?: number;
  errorMessage?: string;
  ipAddress?: string;
}

/** Log an API request to api_request_log. Fire-and-forget — errors are swallowed. */
export async function logApiRequest(params: LogApiRequestParams): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    await db
      .prepare(
        `INSERT INTO api_request_log
           (id, api_key_id, endpoint, method, status_code, duration_ms,
            request_body_size, response_body_size, error_message, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        params.apiKeyId,
        params.endpoint,
        params.method,
        params.statusCode,
        params.durationMs,
        params.requestBodySize ?? null,
        params.responseBodySize ?? null,
        params.errorMessage ?? null,
        params.ipAddress ?? null,
        Math.floor(Date.now() / 1000),
      )
      .run();
  } catch (err) {
    logger.warn('Failed to log API request', { apiKeyId: params.apiKeyId, error: getErrorMessage(err) });
  }
}
