/**
 * SEC Form S-1 / F-1 Prospectus Filing & SOX 404 Management Server Actions
 *
 * Provides authenticated, transactional server mutations and queries for:
 * - SEC Form S-1 / F-1 Prospectus filing period lifecycle
 * - ASC 830 Multi-Entity CTA consolidation execution and persistence
 * - SOX 404 automated control audit execution and attestation certification
 * - Real-time preventive manual adjustment quarantine gate
 *
 * Layer: land (Public business layer & server actions)
 * Dependencies: @/seed/*, @/tree/ipo/* (Never imports @/forest)
 *
 * @module land/ipo/ipo-management-actions
 */

'use server';

import type { D1Database } from '@/seed/db/client';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  type IpoFilingPeriod,
  type MultiEntityConsolidation,
  type MultiEntityConsolidationResult,
  type S1ProspectusDocument,
  type SoxEvaluationSummary,
  type SoxAttestationCertificate,
  type SoxValidationResult,
  type JournalAdjustmentInput,
  type CreateIpoPeriodInput,
  type ConsolidateCtaInput,
  type IpoFilingPeriodRow,
  type MultiEntityConsolidationRow,
  mapRowToIpoFilingPeriod,
  mapRowToMultiEntityConsolidation,
} from '@/seed/types/ipo-filing';
import {
  computeNonGaapMetrics,
  consolidateMultiEntityCta,
  generateS1ProspectusPackage,
} from '@/tree/ipo/s1-prospectus-engine';
import {
  validateManualAdjustment,
  recordQuarantineEventInDb,
  evaluateAllControls,
  generateCryptographicAttestation,
} from '@/tree/ipo/sox404-control-ledger';

// ============================================================================
// Types & Error Interfaces
// ============================================================================

export interface IpoActionError {
  code: string;
  message: string;
}

export type ActionResult<T> = Result<T, IpoActionError>;

interface AuthContext {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

function normalizeErrorArg(err: unknown): Error | Record<string, unknown> {
  if (err instanceof Error) return err;
  return { error: String(err) };
}

// ============================================================================
// Internal Authorization & DB Resolution Helpers
// ============================================================================

/**
 * Verifies that the caller has CFO, Controller, Auditor, or Platform Admin privileges.
 */
async function assertIpoAdminAccess(): Promise<Result<AuthContext, IpoActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required for IPO filing operations.' });
    }

    const { isAdmin } = await isUserAdminWithRole(user);
    if (!isAdmin && user.role !== 'admin') {
      return failure({
        code: 'FORBIDDEN',
        message: 'IPO filing and SOX 404 governance requires CFO, Controller, Auditor, or Admin privileges.',
      });
    }

    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  } catch (err) {
    logger.error('IPO admin auth assertion error', normalizeErrorArg(err));
    return failure({ code: 'AUTH_ERROR', message: 'Failed to verify administrative authorization.' });
  }
}

async function resolveDb(): Promise<Result<D1Database, IpoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({
      code: 'DATABASE_UNAVAILABLE',
      message: 'Cloudflare D1 Database binding is currently unavailable.',
    });
  }
  return success(db);
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Creates a new SEC Form S-1 / F-1 filing period.
 */
export async function createIpoFilingPeriodAction(
  input: CreateIpoPeriodInput
): Promise<ActionResult<IpoFilingPeriod>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const timestamp = Date.now();
    const filingDate = new Date().toISOString().split('T')[0];
    const targetExchanges = (input.targetExchanges || ['NASDAQ', 'SGX']).join(',');

    // Calculate Non-GAAP metrics
    const nonGaap = computeNonGaapMetrics(input.gaapFinancials);

    await db
      .prepare(
        `INSERT INTO ipo_filing_periods (
          period_key, filing_type, target_exchanges, status, filing_date,
          total_customers, mrr_cents, arr_cents, arpu_cents, nrr_pct, gross_margin_pct,
          gaap_revenue_cents, gaap_cost_of_revenue_cents, gaap_gross_profit_cents,
          gaap_operating_expenses_cents, gaap_operating_income_cents, gaap_net_income_cents,
          gaap_operating_cash_flow_cents, capex_cents,
          stock_based_compensation_cents, depreciation_amortization_cents,
          unrealized_fx_gain_loss_cents, one_time_mna_restructuring_cents,
          adjusted_ebitda_cents, adjusted_ebitda_margin_pct,
          free_cash_flow_cents, free_cash_flow_margin_pct,
          magic_number, rule_of_40_pct, yoy_revenue_growth_pct,
          sox_404_status, prospectus_metadata_json, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'draft', ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          'untested', ?, ?, ?
        )`
      )
      .bind(
        input.periodKey,
        input.filingType,
        targetExchanges,
        filingDate,
        input.totalCustomers,
        input.mrrCents,
        input.arrCents,
        input.arpuCents,
        input.nrrPct,
        nonGaap.grossMarginPct,
        input.gaapFinancials.revenueCents,
        input.gaapFinancials.costOfRevenueCents,
        nonGaap.gaapGrossProfitCents,
        input.gaapFinancials.operatingExpensesCents,
        nonGaap.gaapOperatingIncomeCents,
        input.gaapFinancials.netIncomeCents,
        input.gaapFinancials.operatingCashFlowCents,
        input.gaapFinancials.capexCents,
        input.gaapFinancials.stockBasedCompensationCents,
        input.gaapFinancials.depreciationAmortizationCents,
        input.gaapFinancials.unrealizedFxGainLossCents || 0,
        input.gaapFinancials.oneTimeMnaRestructuringCents || 0,
        nonGaap.adjustedEbitdaCents,
        nonGaap.adjustedEbitdaMarginPct,
        nonGaap.freeCashFlowCents,
        nonGaap.freeCashFlowMarginPct,
        nonGaap.magicNumber,
        nonGaap.ruleOf40Pct,
        nonGaap.yoyRevenueGrowthPct,
        JSON.stringify(input.prospectusMetadata || {}),
        timestamp,
        timestamp
      )
      .run();

    const createdRow = await db
      .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
      .bind(input.periodKey)
      .first<IpoFilingPeriodRow>();

    if (!createdRow) {
      return failure({ code: 'CREATION_FAILED', message: 'Filing period was not found after insertion.' });
    }

    return success(mapRowToIpoFilingPeriod(createdRow));
  } catch (err) {
    logger.error('Failed to create IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Database insertion error: ${String(err)}` });
  }
}

/**
 * Retrieves an IPO filing period by period key.
 */
export async function getIpoFilingPeriodAction(
  periodKey: string
): Promise<ActionResult<IpoFilingPeriod>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const row = await db
      .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
      .bind(periodKey)
      .first<IpoFilingPeriodRow>();

    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `Filing period '${periodKey}' does not exist.` });
    }

    return success(mapRowToIpoFilingPeriod(row));
  } catch (err) {
    logger.error('Failed to query IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Query error: ${String(err)}` });
  }
}

/**
 * Generates an end-to-end Form S-1 / F-1 Prospectus document package.
 */
export async function generateS1ProspectusPackageAction(
  periodKey: string
): Promise<ActionResult<S1ProspectusDocument>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const doc = await generateS1ProspectusPackage(db, periodKey);
    return success(doc);
  } catch (err) {
    logger.error('Failed to generate S-1 prospectus package', normalizeErrorArg(err));
    return failure({ code: 'PROSPECTUS_ERROR', message: `Prospectus engine failure: ${String(err)}` });
  }
}

/**
 * Runs automated evaluation across all 6 SOX 404 ICFR internal controls.
 */
export async function runSox404AuditsAction(): Promise<ActionResult<SoxEvaluationSummary>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const summary = await evaluateAllControls(db);
    return success(summary);
  } catch (err) {
    logger.error('Failed to evaluate SOX 404 controls', normalizeErrorArg(err));
    return failure({ code: 'SOX_AUDIT_ERROR', message: `SOX audit engine failure: ${String(err)}` });
  }
}

/**
 * Submits a manual journal adjustment through the preventive SOX 404 quarantine gate.
 */
export async function submitJournalAdjustmentAction(
  input: JournalAdjustmentInput
): Promise<ActionResult<SoxValidationResult>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const validation = validateManualAdjustment(input);

    if (validation.quarantined) {
      await recordQuarantineEventInDb(db, validation);
      logger.warn('Manual journal adjustment quarantined by SOX 404 gate', {
        periodKey: input.periodKey,
        reason: validation.reason,
        violatedControlIds: validation.violatedControlIds,
      });
    }

    return success(validation);
  } catch (err) {
    logger.error('Failed to validate journal adjustment', normalizeErrorArg(err));
    return failure({ code: 'VALIDATION_ERROR', message: `Validation error: ${String(err)}` });
  }
}

/**
 * Certifies an IPO filing period under Sarbanes-Oxley Section 302/404.
 */
export async function certifyIpoFilingAction(
  periodKey: string
): Promise<ActionResult<SoxAttestationCertificate>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const summary = await evaluateAllControls(db);
    if (summary.overallStatus !== 'certified_clean') {
      return failure({
        code: 'SOX_DEFICIENCY',
        message: `Cannot certify period ${periodKey}: SOX status is '${summary.overallStatus}' with ${summary.deficienciesCount} deficiencies.`,
      });
    }

    const certificate = await generateCryptographicAttestation(
      summary,
      authRes.value.userId,
      'CFO / Principal Financial Officer',
      periodKey
    );

    const timestamp = Date.now();
    await db
      .prepare(
        `UPDATE ipo_filing_periods SET
          status = 'sox_certified',
          sox_404_status = 'certified_clean',
          merkle_root_hash = ?,
          sec_filing_signature = ?,
          certified_by = ?,
          certified_at = ?,
          updated_at = ?
        WHERE period_key = ?`
      )
      .bind(
        certificate.merkleRootHash,
        certificate.digitalSignature,
        authRes.value.userId,
        timestamp,
        timestamp,
        periodKey
      )
      .run();

    return success(certificate);
  } catch (err) {
    logger.error('Failed to certify IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'CERTIFICATION_ERROR', message: `Certification error: ${String(err)}` });
  }
}

/**
 * Executes and persists an ASC 830 Multi-Entity CTA consolidation batch.
 */
export async function consolidateMultiEntityCtaAction(
  input: ConsolidateCtaInput
): Promise<ActionResult<MultiEntityConsolidationResult>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const result = await consolidateMultiEntityCta(input.entities, input.periodKey);

    // Persist all entity records and consolidated group to D1
    const allRecords = [...result.entities, result.consolidatedGroup];
    for (const rec of allRecords) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO multi_entity_consolidations (
            id, consolidation_batch_id, period_key, reporting_currency, entity_code, functional_currency,
            local_revenue_units, local_operating_expenses_units, local_net_income_units,
            local_total_assets_units, local_total_liabilities_units, local_equity_units,
            period_end_spot_rate, period_weighted_average_rate, historical_equity_rate,
            translated_revenue_cents, translated_expenses_cents, translated_net_income_cents,
            translated_assets_cents, translated_liabilities_cents, translated_equity_cents,
            intercompany_receivables_eliminated_cents, intercompany_payables_eliminated_cents,
            intercompany_revenue_eliminated_cents, intercompany_expense_eliminated_cents,
            cumulative_translation_adjustment_cents, cta_balance_type, elimination_balanced,
            zero_penny_leakage_verified, merkle_snapshot_hash, audited_by, status, notes,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
          )`
        )
        .bind(
          rec.id,
          rec.consolidationBatchId,
          rec.periodKey,
          rec.reportingCurrency,
          rec.entityCode,
          rec.functionalCurrency,
          rec.localRevenueUnits,
          rec.localOperatingExpensesUnits,
          rec.localNetIncomeUnits,
          rec.localTotalAssetsUnits,
          rec.localTotalLiabilitiesUnits,
          rec.localEquityUnits,
          rec.periodEndSpotRate,
          rec.periodWeightedAverageRate,
          rec.historicalEquityRate,
          rec.translatedRevenueCents,
          rec.translatedExpensesCents,
          rec.translatedNetIncomeCents,
          rec.translatedAssetsCents,
          rec.translatedLiabilitiesCents,
          rec.translatedEquityCents,
          rec.intercompanyReceivablesEliminatedCents,
          rec.intercompanyPayablesEliminatedCents,
          rec.intercompanyRevenueEliminatedCents,
          rec.intercompanyExpenseEliminatedCents,
          rec.cumulativeTranslationAdjustmentCents,
          rec.ctaBalanceType,
          rec.eliminationBalanced ? 1 : 0,
          rec.zeroPennyLeakageVerified ? 1 : 0,
          rec.merkleSnapshotHash,
          rec.auditedBy,
          rec.status,
          rec.notes,
          rec.createdAt,
          rec.updatedAt
        )
        .run();
    }

    return success(result);
  } catch (err) {
    logger.error('Failed to execute multi-entity consolidation', normalizeErrorArg(err));
    return failure({ code: 'CONSOLIDATION_ERROR', message: `Consolidation error: ${String(err)}` });
  }
}

/**
 * Retrieves the historical consolidation batch records for a specific period.
 */
export async function getConsolidationHistoryAction(
  periodKey: string
): Promise<ActionResult<MultiEntityConsolidation[]>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const rows = await db
      .prepare('SELECT * FROM multi_entity_consolidations WHERE period_key = ? ORDER BY created_at DESC')
      .bind(periodKey)
      .all<MultiEntityConsolidationRow>();

    const items = (rows.results || []).map(mapRowToMultiEntityConsolidation);
    return success(items);
  } catch (err) {
    logger.error('Failed to query consolidation history', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Query error: ${String(err)}` });
  }
}
