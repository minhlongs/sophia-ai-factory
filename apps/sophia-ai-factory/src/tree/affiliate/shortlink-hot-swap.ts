/**
 * First-Party Link Router Hot-Swap (Affiliate Sovereignty Layer 1).
 *
 * Allows a Crypto + SaaS affiliate to reroute any existing `/api/r/[code]`
 * shortlink from Merchant A to Merchant B in 1 second without editing published
 * videos or losing verified click history.
 *
 * Enforces:
 * - Strict `https:` protocol only (blocks `javascript:`, `data:`, `http:`)
 * - Blocks localhost / private IP ranges (SSRF protection)
 * - Strict tenant isolation (`WHERE id = ? AND org_id = ?`)
 *
 * @module tree/affiliate/shortlink-hot-swap
 */

import { success, failure, type Result } from '@/seed/types/result';

export interface HotSwapD1Prepared {
  bind(...values: unknown[]): {
    run(): Promise<{ meta?: { changes?: number } }>;
  };
}

export interface HotSwapD1Like {
  prepare(sql: string): HotSwapD1Prepared;
}

export interface HotSwapShortlinkInput {
  readonly db: HotSwapD1Like;
  readonly orgId: string;
  readonly linkId: string;
  readonly newDestinationUrl: string;
  readonly nowIso?: string;
}

export interface HotSwapShortlinkOutput {
  readonly linkId: string;
  readonly orgId: string;
  readonly destinationUrl: string;
  readonly updatedAtIso: string;
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|\[::1\])/i;

export function validateHotSwapDestinationUrl(
  rawUrl: string,
): Result<string, { code: string; message: string }> {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return failure({ code: 'INVALID_URL', message: 'Destination URL is malformed' });
  }

  if (parsed.protocol !== 'https:') {
    return failure({
      code: 'HTTPS_REQUIRED',
      message: 'Destination URL must use https://',
    });
  }

  if (PRIVATE_HOST_RE.test(parsed.hostname) || parsed.hostname.endsWith('.local')) {
    return failure({
      code: 'PRIVATE_HOST_BLOCKED',
      message: 'Private or local hostnames are not allowed',
    });
  }

  return success(parsed.toString());
}

export async function hotSwapShortlinkDestination(
  input: HotSwapShortlinkInput,
): Promise<Result<HotSwapShortlinkOutput, { code: string; message: string }>> {
  const validated = validateHotSwapDestinationUrl(input.newDestinationUrl);
  if (!validated.ok) return validated;

  const updatedAtIso = input.nowIso ?? new Date().toISOString();
  const res = await input.db
    .prepare(
      `UPDATE pilot_affiliate_links
       SET destination_url = ?, updated_at = ?
       WHERE id = ? AND org_id = ?`,
    )
    .bind(validated.value, updatedAtIso, input.linkId, input.orgId)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return failure({
      code: 'LINK_NOT_FOUND',
      message: 'Shortlink not found for this organization',
    });
  }

  return success({
    linkId: input.linkId,
    orgId: input.orgId,
    destinationUrl: validated.value,
    updatedAtIso,
  });
}
