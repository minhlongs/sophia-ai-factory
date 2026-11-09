/**
 * SEC-09: Organization Data Purge Service (`org/data.purge`)
 *
 * Hard-deletes tenant BYOK encrypted credentials, social OAuth tokens,
 * and R2 media objects under `orgs/{orgId}/` within the 24h offboarding SLA.
 *
 * Layer: tree (domain reusable logic)
 * @module tree/security/org-data-purge
 */

import { failure, success, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';

export interface PurgeD1BindingLike {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
    };
  };
}

export interface PurgeR2BucketLike {
  list(options: { prefix: string; cursor?: string }): Promise<{
    objects: Array<{ key: string }>;
    truncated?: boolean;
    cursor?: string;
  }>;
  delete(keys: string | string[]): Promise<void>;
}

export interface OrgDataPurgeInput {
  readonly orgId: string;
  readonly requestedByUserId: string;
  readonly d1: PurgeD1BindingLike;
  readonly r2Bucket?: PurgeR2BucketLike | null;
}

export interface OrgDataPurgeReceipt {
  readonly orgId: string;
  readonly r2PrefixPurged: string;
  readonly byokKeysDeleted: number;
  readonly oauthTokensDeleted: number;
  readonly r2ObjectsDeleted: number;
  readonly purgedAtIso: string;
}

/**
 * Executes a deterministic tenant data purge across D1 credential tables and R2 media prefix.
 */
export async function purgeOrganizationData(
  input: OrgDataPurgeInput,
): Promise<Result<OrgDataPurgeReceipt, { code: string; message: string }>> {
  const orgId = input.orgId?.trim();
  if (!orgId || orgId.includes('/') || orgId.includes('..')) {
    return failure({
      code: 'INVALID_ORG_ID',
      message: 'A valid non-empty organization ID is required for data purge',
    });
  }

  const r2Prefix = `orgs/${orgId}/`;

  try {
    const byokRes = await input.d1
      .prepare('DELETE FROM user_api_keys WHERE user_id = ?1 OR tenant_id = ?1')
      .bind(orgId)
      .run();
    const byokKeysDeleted = Number(byokRes.meta?.changes ?? 0);

    const oauthRes = await input.d1
      .prepare('DELETE FROM social_connections WHERE organization_id = ?1 OR user_id = ?1')
      .bind(orgId)
      .run();
    const oauthTokensDeleted = Number(oauthRes.meta?.changes ?? 0);

    let r2ObjectsDeleted = 0;
    if (input.r2Bucket) {
      let cursor: string | undefined;
      do {
        const listed = await input.r2Bucket.list({ prefix: r2Prefix, ...(cursor ? { cursor } : {}) });
        const keys = listed.objects
          .map((o) => o.key)
          .filter((k) => k.startsWith(r2Prefix));
        for (let i = 0; i < keys.length; i += 1000) {
          const batch = keys.slice(i, i + 1000);
          await input.r2Bucket.delete(batch);
          r2ObjectsDeleted += batch.length;
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    }

    const receipt: OrgDataPurgeReceipt = {
      orgId,
      r2PrefixPurged: r2Prefix,
      byokKeysDeleted,
      oauthTokensDeleted,
      r2ObjectsDeleted,
      purgedAtIso: new Date().toISOString(),
    };

    logger.info('org/data.purge completed', {
      orgId,
      requestedByUserId: input.requestedByUserId,
      byokKeysDeleted,
      oauthTokensDeleted,
      r2ObjectsDeleted,
    });

    return success(receipt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('org/data.purge failed', { orgId, error: msg });
    return failure({
      code: 'ORG_PURGE_FAILED',
      message: msg,
    });
  }
}
