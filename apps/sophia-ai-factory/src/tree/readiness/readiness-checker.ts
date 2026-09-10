/**
 * Reusable System & User Readiness Checker — Sophia AI Factory.
 *
 * Implements ESCROW-2: Reusable verification logic shared across:
 * - /api/setup-wizard/readiness (Setup Wizard finish step)
 * - src/forest/mission/preflight-check.ts (Mission preflight gate)
 *
 * @module tree/readiness/readiness-checker
 */

import { getD1 } from '@/seed/db/client';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import { getBalance } from '@/tree/mcu/credits-repo';
import { getUserTier } from '@/seed/db/get-user-tier';
import {
  resolveCapabilities,
  type AICapability,
} from '@/seed/ai/capability-model';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface SystemReadiness {
  ownerVerified: boolean;
  byokEncrypted: boolean;
  providersConfigured: string[];
  providersReady: string[];
  subscriptionActive: boolean;
  tier: string;
  mcuBalance: number;
  capabilities: AICapability[];
  readyForMissions: boolean;
  issues: string[];
}

export interface VerifyReadinessOptions {
  userId: string;
  userEmail?: string | null;
  emailVerified?: boolean;
}

/**
 * Perform server-side dynamic readiness verification for a user.
 */
export async function verifyUserReadiness(
  opts: VerifyReadinessOptions
): Promise<SystemReadiness> {
  const { userId } = opts;
  const issues: string[] = [];

  let ownerVerified = Boolean(opts.emailVerified);
  let providersConfigured: string[] = [];
  let mcuBalance = 0;
  let tier = 'BASIC';
  let subscriptionActive = false;

  try {
    const d1 = await getD1();
    if (d1) {
      // Check user record if emailVerified wasn't provided directly
      if (!ownerVerified) {
        try {
          const userRow = await d1
            .prepare('SELECT emailVerified FROM "user" WHERE id = ?1 LIMIT 1')
            .bind(userId)
            .first<{ emailVerified: number | boolean | null }>();

          if (userRow) {
            ownerVerified = Boolean(userRow.emailVerified);
          }
        } catch {
          // Table structure fallback
        }
      }

      // Check subscription record
      try {
        const subRow = await d1
          .prepare('SELECT status, tier, plan FROM subscriptions WHERE user_id = ?1 LIMIT 1')
          .bind(userId)
          .first<{ status?: string; tier?: string; plan?: string }>();

        if (subRow && (subRow.status === 'active' || subRow.status === 'trialing')) {
          subscriptionActive = true;
        }
      } catch {
        // Fallback
      }
    }

    // Resolve BYOK configured providers
    const providers = await listUserApiKeyProviders(userId);
    providersConfigured = providers.map((p) => String(p));

    // Resolve Tier
    tier = await getUserTier(userId);
    if (tier === 'MASTER' || tier === 'PREMIUM' || tier === 'ENTERPRISE') {
      subscriptionActive = true;
    }

    // Resolve MCU balance
    const balance = await getBalance(userId);
    mcuBalance = balance.credits_remaining;
  } catch (err) {
    logger.error('[ReadinessChecker] Failed checking user readiness', toError(err), { userId });
  }

  const byokEncrypted = providersConfigured.length > 0;
  const providersReady = [...providersConfigured];

  // Resolve AI capabilities
  const capabilityResolution = resolveCapabilities(providersReady);
  const capabilities = capabilityResolution.availableCapabilities;

  // Identify issues
  if (!ownerVerified) {
    issues.push('EMAIL_NOT_VERIFIED');
  }
  if (!byokEncrypted) {
    issues.push('NO_BYOK_PROVIDERS_CONFIGURED');
  }
  if (mcuBalance <= 0) {
    issues.push('INSUFFICIENT_MCU_BALANCE');
  }
  if (capabilities.length === 0) {
    issues.push('NO_AI_CAPABILITIES_AVAILABLE');
  }

  // Ready for missions requires: byok configured + MCU balance + at least one capability
  const readyForMissions = byokEncrypted && mcuBalance > 0 && capabilities.length > 0;

  return {
    ownerVerified,
    byokEncrypted,
    providersConfigured,
    providersReady,
    subscriptionActive,
    tier,
    mcuBalance,
    capabilities,
    readyForMissions,
    issues,
  };
}
