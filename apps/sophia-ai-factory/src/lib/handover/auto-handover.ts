/**
 * Auto-handover orchestrator — triggered by payment IPN.
 * Wraps full handover pipeline: user create → tier → SOPs → record → magic link → email.
 * MUST be called inside try/catch — failure is non-fatal to payment flow.
 *
 * @module lib/handover/auto-handover
 */

import { getD1Raw } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { getErrorMessage } from '@/lib/utils/to-error';
import { createCustomerUser, upsertUserTier, preInstallSops, createHandoverRecord } from './handover-account-setup';
import { createMagicLinkToken } from './handover-magic-link';
import { sendAutoHandoverWelcomeEmail, sendTierUpgradeEmail } from './handover-email-service';
import { AGENCY_SOP_MAP, TIER_SOP_COUNTS } from './handover-types';
import type { AgencyType } from './handover-types';
import type { Tier } from '@/types';

export interface AutoHandoverOptions {
  paymentId: string;
  userId?: string | null;
  email: string;
  fullName?: string | null;
  tier: Tier;
  agencyType?: AgencyType;
  locale?: string;
  isFirstPurchase: boolean;
}

export interface AutoHandoverResult {
  handoverId: string | null;
  isNewCustomer: boolean;
  magicLink: string | null;
  sopsInstalled: string[];
  skipped: boolean;
  skipReason?: string;
}

/** Derive starter SOP slugs from tier + agencyType, capped to tier limit. */
function getStarterSops(tier: Tier, agencyType: AgencyType): string[] {
  const cap = TIER_SOP_COUNTS[tier] ?? 3;
  const candidates = AGENCY_SOP_MAP[agencyType] ?? AGENCY_SOP_MAP.other;
  return candidates.slice(0, cap);
}

/** Look up user by email in D1 users table. Returns userId or null. */
async function findUserByEmail(db: D1Database, email: string): Promise<string | null> {
  try {
    const row = await db
      .prepare(`SELECT id FROM user WHERE email = ?1 LIMIT 1`)
      .bind(email)
      .first<{ id: string }>();
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** Check if handover already exists for this paymentId (idempotency). */
async function handoverExistsForPayment(db: D1Database, paymentId: string): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT id FROM customer_handovers WHERE trigger_payment_id = ?1 LIMIT 1`)
      .bind(paymentId)
      .first<{ id: string }>();
    return !!row;
  } catch {
    return false;
  }
}

/** Check if user already has a handover (existing customer upgrading). */
async function getExistingHandoverId(db: D1Database, userId: string): Promise<string | null> {
  try {
    const row = await db
      .prepare(`SELECT id FROM customer_handovers WHERE customer_user_id = ?1 ORDER BY created_at DESC LIMIT 1`)
      .bind(userId)
      .first<{ id: string }>();
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** Count paid/completed purchases for user (to detect first purchase). */
async function countUserPurchases(db: D1Database, userId: string): Promise<number> {
  try {
    const row = await db
      .prepare(`SELECT COUNT(*) as cnt FROM user_purchases WHERE user_id = ?1 AND status = 'paid'`)
      .bind(userId)
      .first<{ cnt: number }>();
    return row?.cnt ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Trigger auto-handover from payment IPN.
 * Non-fatal — wrap in try/catch at call site.
 */
export async function triggerAutoHandover(opts: AutoHandoverOptions): Promise<AutoHandoverResult> {
  const {
    paymentId,
    email,
    tier,
    agencyType = 'other',
    locale = 'vi',
    isFirstPurchase,
  } = opts;
  const fullName = opts.fullName ?? email.split('@')[0];

  const db = await getD1Raw();

  // Idempotency — skip if already processed this paymentId
  const alreadyProcessed = await handoverExistsForPayment(db, paymentId);
  if (alreadyProcessed) {
    logger.info('[AutoHandover] Already processed — skip', { paymentId });
    return { handoverId: null, isNewCustomer: false, magicLink: null, sopsInstalled: [], skipped: true, skipReason: 'duplicate_payment_id' };
  }

  // Resolve userId
  let userId = opts.userId ?? null;
  let isNewCustomer = false;

  if (!userId) {
    userId = await findUserByEmail(db, email);
  }

  if (!userId) {
    // Create new customer user
    try {
      userId = await createCustomerUser(db, email, fullName);
      isNewCustomer = true;
      logger.info('[AutoHandover] New customer created', { userId, email });
    } catch (err) {
      logger.error('[AutoHandover] createCustomerUser failed', err instanceof Error ? err : undefined);
      return { handoverId: null, isNewCustomer: false, magicLink: null, sopsInstalled: [], skipped: true, skipReason: 'user_create_failed' };
    }
  }

  // Upsert tier
  await upsertUserTier(db, userId, tier);

  // Check existing handover
  const existingHandoverId = await getExistingHandoverId(db, userId);
  const purchaseCount = await countUserPurchases(db, userId);
  const isTierUpgrade = !!existingHandoverId && !isFirstPurchase && purchaseCount > 1;

  if (isTierUpgrade) {
    // Tier upgrade — just send upgrade email, no new SOPs
    try {
      await sendTierUpgradeEmail({
        toEmail: email,
        ownerFullName: fullName,
        newTier: tier,
        locale,
      });
    } catch (err) {
      logger.warn('[AutoHandover] Tier upgrade email failed (non-fatal)', { error: getErrorMessage(err) });
    }
    return {
      handoverId: existingHandoverId,
      isNewCustomer: false,
      magicLink: null,
      sopsInstalled: [],
      skipped: false,
    };
  }

  // First handover — install SOPs + create record + magic link + welcome email
  const sopSlugs = getStarterSops(tier, agencyType);
  const installedSops = await preInstallSops(db, userId, sopSlugs);

  let handoverId: string | null = null;
  try {
    handoverId = await createHandoverRecord(db, {
      userId,
      agencyName: fullName,
      agencyType,
      tier,
      installedSops,
      adminId: 'SYSTEM_AUTO',
      source: 'auto_payment',
      triggerPaymentId: paymentId,
    });
  } catch (err) {
    logger.error('[AutoHandover] createHandoverRecord failed', err instanceof Error ? err : undefined);
    return { handoverId: null, isNewCustomer, magicLink: null, sopsInstalled: installedSops, skipped: true, skipReason: 'record_create_failed' };
  }

  // Generate magic link
  let magicLink: string | null = null;
  try {
    const token = await createMagicLinkToken(handoverId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
    magicLink = `${appUrl}/${locale}/welcome/${token}`;
  } catch (err) {
    logger.warn('[AutoHandover] Magic link generation failed (non-fatal)', { error: getErrorMessage(err) });
  }

  // Send welcome email
  try {
    await sendAutoHandoverWelcomeEmail({
      toEmail: email,
      ownerFullName: fullName,
      tier,
      locale,
      magicLinkUrl: magicLink ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'}/login`,
    });

    // Mark email sent
    const nowSec = Math.floor(Date.now() / 1000);
    await db
      .prepare(`UPDATE customer_handovers SET welcome_email_sent_at = ?1 WHERE id = ?2`)
      .bind(nowSec, handoverId)
      .run();
  } catch (err) {
    logger.warn('[AutoHandover] Welcome email failed (non-fatal)', { error: getErrorMessage(err) });
  }

  logger.info('[AutoHandover] Handover complete', {
    handoverId,
    userId,
    tier,
    isNewCustomer,
    sopsInstalled: installedSops.length,
    paymentId,
  });

  return { handoverId, isNewCustomer, magicLink, sopsInstalled: installedSops, skipped: false };
}
