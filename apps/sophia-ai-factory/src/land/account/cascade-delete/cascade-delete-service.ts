import type { R2Bucket, D1Database } from '@cloudflare/workers-types';
import type { CascadeDeleteResult } from './types';
import { collectTenantR2Keys, deleteR2Objects } from './r2-asset-purger';
import {
  fetchOrgId,
  executeD1Cascade,
  cleanupCooldownRow,
  logR2DeadLetter,
} from './d1-relational-cleaner';

export async function cascadeDeleteAccount(
  db: D1Database,
  userId: string,
  tenantId: string,
  r2Bucket?: R2Bucket,
): Promise<CascadeDeleteResult> {
  // Pre-fetch org_id once — needed for org-scoped tables (org_members, subscriptions, etc.)
  const orgId = await fetchOrgId(db, userId);

  // Phase 1: collect R2 keys before rows are deleted
  const r2Keys =
    r2Bucket !== undefined ? await collectTenantR2Keys(db, tenantId) : [];

  // Phase 2: D1 cascade delete (dependents-first order)
  const { total, byTable } = await executeD1Cascade(db, userId, tenantId, orgId);

  // Phase 3: R2 cleanup with retry and dead-letter queuing (non-fatal)
  let r2Deleted = 0;
  let r2Failed: string[] | undefined = undefined;

  if (r2Bucket !== undefined && r2Keys.length > 0) {
    const r2Summary = await deleteR2Objects(r2Bucket, r2Keys);
    r2Deleted = r2Summary.deleted;
    if (r2Summary.failedKeys.length > 0) {
      r2Failed = r2Summary.failedKeys;
      await logR2DeadLetter(db, userId, tenantId, r2Summary.failedKeys);
    }
  }

  // Phase 4: cleanup cooldown row regardless of cascade outcome
  // (so it doesn't loop on subsequent cron passes)
  await cleanupCooldownRow(db, userId);

  return {
    totalDeleted: total,
    byTable,
    r2Deleted,
    ...(r2Failed && r2Failed.length > 0 ? { r2Failed } : {}),
  };
}
