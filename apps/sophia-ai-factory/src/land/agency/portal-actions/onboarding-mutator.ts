/**
 * Agency Client Subaccount Onboarding Server Action
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/onboarding-mutator
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import type {
  AgencyOnboardingSubmission,
  AgencyOnboardingResult,
} from '@/seed/types';
import { validateCompleteSubmission } from '@/tree/agency/onboarding-validator';
import { resolveDb } from './common';
import {
  insertSubaccountCoreRecords,
  deploySeedAgentsLedger,
} from './onboarding-mutator-helpers';

/**
 * Executes atomic client subaccount onboarding, branding setup, quota allocation, and seed agent deployment.
 */
export async function submitAgencyOnboardingAction(
  submission: AgencyOnboardingSubmission,
  dbOverride?: unknown
): Promise<AgencyOnboardingResult> {
  const validation = validateCompleteSubmission(submission);
  if (!validation.valid) {
    return {
      success: false,
      stepErrors: validation.stepErrors,
      error: 'VALIDATION_FAILED',
    };
  }

  const db = resolveDb(dbOverride);
  const { agencyOrgId, profile, seedAgents } = submission;
  const normalizedSlug = profile.agencySlug.trim().toLowerCase();
  const now = new Date().toISOString();

  try {
    // 1. Check slug uniqueness within agency organization
    const existing = await db
      .prepare('SELECT id FROM client_subaccounts WHERE agency_org_id = ?1 AND lower(slug) = ?2 LIMIT 1')
      .bind(agencyOrgId, normalizedSlug)
      .first<{ id: string }>();

    if (existing) {
      return {
        success: false,
        error: 'SLUG_ALREADY_EXISTS',
        stepErrors: { profile: ['SLUG_ALREADY_EXISTS'] },
      };
    }

    const subaccountId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 2-4. Insert client subaccount, branding, and MCU quota allocation
    await insertSubaccountCoreRecords(db, submission, subaccountId, normalizedSlug, now);

    // 5. Deploy enabled seed agents into AGY governance ledger
    const deployedAgentsCount = await deploySeedAgentsLedger(
      db,
      agencyOrgId,
      seedAgents,
      now
    );

    const portalUrl = `/portal/${normalizedSlug}`;
    logger.info('[Agency Actions] Client onboarded successfully', {
      subaccountId,
      agencyOrgId,
      slug: normalizedSlug,
      deployedAgentsCount,
    });

    return {
      success: true,
      subaccountId,
      agencySlug: normalizedSlug,
      portalUrl,
      deployedAgentsCount,
    };
  } catch (err) {
    logger.error('[Agency Actions] Onboarding transaction failed', {
      error: String(err),
      agencyOrgId,
      slug: normalizedSlug,
    });
    return {
      success: false,
      error: 'DATABASE_ERROR',
    };
  }
}
