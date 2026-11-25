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
import { validateHttpsDestinationUrl } from '@/tree/first-value/pilot-shortlink-repo';

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
  readonly userId: string;
  readonly linkId: string;
  readonly newDestinationUrl: string;
  readonly nowIso?: string;
}

export interface HotSwapShortlinkOutput {
  readonly linkId: string;
  readonly orgId: string;
  readonly userId: string;
  readonly destinationUrl: string;
  readonly updatedAtIso: string;
}

export function validateHotSwapDestinationUrl(
  rawUrl: string,
): Result<string, { code: string; message: string }> {
  try {
    const normalized = validateHttpsDestinationUrl(rawUrl);
    return success(normalized.toString());
  } catch (err) {
    return failure({
      code: 'INVALID_DESTINATION_URL',
      message: err instanceof Error ? err.message : 'Invalid destination URL',
    });
  }
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
       WHERE id = ? AND org_id = ? AND user_id = ?`,
    )
    .bind(validated.value, updatedAtIso, input.linkId, input.orgId, input.userId)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return failure({
      code: 'LINK_NOT_FOUND',
      message: 'Shortlink not found for this organization and user',
    });
  }

  return success({
    linkId: input.linkId,
    orgId: input.orgId,
    userId: input.userId,
    destinationUrl: validated.value,
    updatedAtIso,
  });
}
