/**
 * D1 & Issue Collection Helpers for System Readiness Checker
 *
 * @module tree/readiness/readiness-check-helpers
 */

import type { getD1 } from '@/seed/db/client';

type D1Database = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export async function checkEmailVerified(
  d1: D1Database | null,
  userId: string,
  initialVerified?: boolean
): Promise<boolean> {
  if (initialVerified) return true;
  if (!d1) return false;
  try {
    const userRow = await d1
      .prepare('SELECT emailVerified FROM "user" WHERE id = ?1 LIMIT 1')
      .bind(userId)
      .first<{ emailVerified: number | boolean | null }>();
    return Boolean(userRow?.emailVerified);
  } catch {
    return false;
  }
}

export async function checkSubscriptionActive(
  d1: D1Database | null,
  userId: string
): Promise<boolean> {
  if (!d1) return false;
  try {
    const subRow = await d1
      .prepare('SELECT status, tier, plan FROM subscriptions WHERE user_id = ?1 LIMIT 1')
      .bind(userId)
      .first<{ status?: string; tier?: string; plan?: string }>();
    return subRow?.status === 'active' || subRow?.status === 'trialing';
  } catch {
    return false;
  }
}

export function collectReadinessIssues(
  ownerVerified: boolean,
  byokEncrypted: boolean,
  mcuBalance: number,
  capabilitiesCount: number
): string[] {
  const issues: string[] = [];
  if (!ownerVerified) {
    issues.push('EMAIL_NOT_VERIFIED');
  }
  if (!byokEncrypted) {
    issues.push('NO_BYOK_PROVIDERS_CONFIGURED');
  }
  if (mcuBalance <= 0) {
    issues.push('INSUFFICIENT_MCU_BALANCE');
  }
  if (capabilitiesCount === 0) {
    issues.push('NO_AI_CAPABILITIES_AVAILABLE');
  }
  return issues;
}
