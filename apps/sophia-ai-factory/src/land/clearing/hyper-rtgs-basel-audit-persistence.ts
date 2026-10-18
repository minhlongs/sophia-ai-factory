/**
 * D1 Persistence Helper for Basel Solvency Audits in Hyper-RTGS.
 * @module land/clearing/hyper-rtgs-basel-audit-persistence
 */

import { getD1 } from '@/seed/db/client';

export async function insertBaselSolvencyAuditRow(
  tableName: string,
  auditRef: string,
  values: {
    commonEquityTier1Cents: number;
    totalRiskExposureCents: number;
    highQualityLiquidAssetsCents: number;
    netCashOutflows30DaysCents: number;
    availableStableFundingCents: number;
    requiredStableFundingCents: number;
    sovereignCapitalBufferCents: number;
    stressTestSurvivalDays: number;
    cet1RatioBps: number;
    liquidityCoverageRatioBps: number;
    netStableFundingRatioBps: number;
    solvencyStatus: string;
    supervisorySignature: string;
  },
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${tableName} (
         id, audit_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         high_quality_liquid_assets_cents, net_cash_outflows_30_days_cents,
         available_stable_funding_cents, required_stable_funding_cents,
         sovereign_capital_buffer_cents, stress_test_survival_days,
         cet1_ratio_bps, lcr_bps, nsfr_bps, solvency_status,
         supervisory_signature, audited_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      auditRef,
      values.commonEquityTier1Cents,
      values.totalRiskExposureCents,
      values.highQualityLiquidAssetsCents,
      values.netCashOutflows30DaysCents,
      values.availableStableFundingCents,
      values.requiredStableFundingCents,
      values.sovereignCapitalBufferCents,
      values.stressTestSurvivalDays,
      values.cet1RatioBps,
      values.liquidityCoverageRatioBps,
      values.netStableFundingRatioBps,
      values.solvencyStatus,
      values.supervisorySignature,
      new Date().toISOString(),
    )
    .run();
}
