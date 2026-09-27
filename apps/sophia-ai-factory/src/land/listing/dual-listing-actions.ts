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

    const db = await getD1();
    const period = DualListingEngine.createGate11FilingPeriod(fiscalYear, filingType);

    // Default canonical Gate 11 entities (US, SG, VN, IE)
    const bepsInputs: BepsComputationInput[] = [
      { jurisdictionCode: 'US', coveredTaxesCents: 15_000_000_00, globeIncomeCents: 75_000_000_00 }, // 20% ETR
      { jurisdictionCode: 'SG', coveredTaxesCents: 2_500_000_00, globeIncomeCents: 25_000_000_00 }, // 10% ETR -> triggers 5% top-up
      { jurisdictionCode: 'VN', coveredTaxesCents: 3_000_000_00, globeIncomeCents: 15_000_000_00 }, // 20% ETR
      { jurisdictionCode: 'IE', coveredTaxesCents: 625_000_00, globeIncomeCents: 5_000_000_00 }, // 12.5% ETR -> triggers 2.5% top-up
    ];

    const pkg = DualListingEngine.assembleConsolidatedPackage(period, bepsInputs);

    if (db) {
      await DualListingEngine.persistFilingPeriod(db, period);
    }

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
