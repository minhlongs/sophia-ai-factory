/**
 * dual-listing-actions.ts — Gate 11 Dual-Listing & BEPS Pillar Two Server Actions
 * Layer: LAND (Server Actions / Controllers)
 *
 * Provides authenticated server actions for NASDAQ / SGX dual-listing filings,
 * OECD BEPS Pillar Two GloBE tax calculations, and FCPA anti-bribery screening.
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  type DualListingPeriod,
  type DualListingFilingType,
  type BepsComputationInput,
  type BepsComputationResult,
  type DualListingConsolidatedPackage,
  type FcpaComplianceScreening,
} from '@/seed/types/dual-listing';
import { DualListingEngine } from '@/tree/listing/dual-listing-engine';
import { FcpaComplianceLedger, type FcpaScreeningInput } from '@/tree/listing/fcpa-compliance-ledger';
import { assembleAndPersistDualListingPackage } from './dual-listing-action-helpers';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Generates and stores a complete Gate 11 Dual-Listing Package.
 */
export async function generateDualListingPackageAction(
  fiscalYear = 2026,
  filingType: DualListingFilingType = 'SEC_10K'
): Promise<ActionResponse<DualListingConsolidatedPackage>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const pkg = await assembleAndPersistDualListingPackage(fiscalYear, filingType);
    return { success: true, data: pkg };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate dual listing package';
    logger.error('generateDualListingPackageAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Calculates OECD BEPS Pillar Two GloBE Effective Tax Rate and Top-up Tax.
 */
export async function calculateBepsPillarTwoAction(
  input: BepsComputationInput
): Promise<ActionResponse<BepsComputationResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const result = DualListingEngine.calculateBepsPillarTwo(input);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate BEPS tax';
    logger.error('calculateBepsPillarTwoAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Conducts and records an FCPA compliance anti-bribery screening.
 */
export async function recordFcpaScreeningAction(
  input: FcpaScreeningInput
): Promise<ActionResponse<FcpaComplianceScreening>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const screening = FcpaComplianceLedger.conductScreening(input);
    const db = await getD1();

    if (db) {
      await FcpaComplianceLedger.recordScreening(db, screening);
    }

    return { success: true, data: screening };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record FCPA screening';
    logger.error('recordFcpaScreeningAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Retrieves a Dual-Listing Period by ID.
 */
export async function getDualListingPeriodAction(
  id: string
): Promise<ActionResponse<DualListingPeriod | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding not available' };
    }

    const period = await DualListingEngine.getFilingPeriod(db, id);
    return { success: true, data: period };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch filing period';
    logger.error('getDualListingPeriodAction failed', { error: message });
    return { success: false, error: message };
  }
}
