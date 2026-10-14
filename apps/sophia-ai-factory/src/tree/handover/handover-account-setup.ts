/** * Account and SOP setup helpers for handover creation. * Extracted from create/route for file size compliance. * @module lib/handover/handover-account-setup */
import { logger } from '@/seed/utils/logger-utility';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/** Create a new user in D1's Better Auth `user` table. Returns userId or throws. */
export async function createCustomerUser(
  db: D1Database,
  email: string,
  fullName: string,
): Promise<string> {
  const userId = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO user (id, email, name, emailVerified, role, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, 1, 'customer', ?4, ?4)`,
    )
    .bind(userId, email, fullName, nowSec)
    .run();

 // M1: Also create user_profiles row so downstream queries don't get null
 try {
 await db
 .prepare(
 `INSERT OR IGNORE INTO user_profiles (id, user_id, email, full_name, created_at, updated_at)
 VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
 )
 .bind(genId(), userId, email, fullName, nowSec)
 .run();
 } catch (err) {
 logger.warn(
 '[HandoverSetup] user_profiles insert failed (non-fatal)',
 err instanceof Error ? err : undefined,
 );
 }
  return userId;
}

/**
 * Idempotent: ensure a personal "customer org" exists for this user.
 * org_id NOT NULL constraint requires every subscription row has an org.
 * Creates: organizations + org_members (owner) + org_balances.
 * Returns the org id.
 */
export async function ensureCustomerOrg(
  db: D1Database,
  userId: string,
  email: string,
): Promise<string> {
  const slug = `customer-${userId.slice(0, 8)}`;

  // Check existing
  const existing = await db
    .prepare(`SELECT id FROM organizations WHERE slug = ?1 LIMIT 1`)
    .bind(slug)
    .first<{ id: string }>();
  if (existing) return existing.id;

  // Create org
  const orgId = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const displayName = email.split('@')[0];
  await db
    .prepare(
      `INSERT INTO organizations (id, name, slug, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)`,
    )
    .bind(orgId, displayName, slug, nowSec)
    .run();

  // Add as owner member
  await db
    .prepare(
      `INSERT OR IGNORE INTO org_members (id, org_id, user_id, role, created_at)
       VALUES (?1, ?2, ?3, 'owner', ?4)`,
    )
    .bind(genId(), orgId, userId, nowSec)
    .run();

  // Create org_balances row. Schema: id, org_id, balance, updated_at (REAL balance, not cents).
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO org_balances (id, org_id, balance, updated_at)
         VALUES (?1, ?2, 0, ?3)`,
      )
      .bind(genId(), orgId, nowSec)
      .run();
  } catch (err) {
    logger.warn(
      '[HandoverSetup] org_balances insert failed (non-fatal)',
      err instanceof Error ? err : undefined,
    );
  }
  return orgId;
}

/** Upsert subscription tier for a user. Also updates organizations.plan (F-02). */
export async function upsertUserTier(
  db: D1Database,
  userId: string,
  tier: string,
  email = '',
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  try {
    const orgId = await ensureCustomerOrg(db, userId, email || userId);
    await db
      .prepare(
        `INSERT OR REPLACE INTO subscriptions (id, org_id, user_id, plan, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5)`,
      )
      .bind(genId(), orgId, userId, tier.toUpperCase(), nowSec)
      .run();
    // F-02: Also sync organizations.plan so resolveUserTier() reads the correct plan
    await db
      .prepare(`UPDATE organizations SET plan = ?1, updated_at = ?2 WHERE id = ?3`)
      .bind(tier.toUpperCase(), nowSec, orgId)
      .run();
  } catch (err) {
    logger.error('[HandoverSetup] Subscription upsert failed', err instanceof Error ? err : undefined);
    throw new Error(`[HandoverSetup] upsertUserTier failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export { preInstallSops, createHandoverRecord } from './handover-sop-setup';
