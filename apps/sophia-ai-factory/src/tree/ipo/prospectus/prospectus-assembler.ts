/**
 * S-1 Prospectus Engine: Prospectus Document Assembler
 *
 * Assembles full SEC Form S-1 / F-1 prospectus package with Merkle anchoring.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/prospectus-assembler
 */

import type { D1Database } from '@/seed/db/client';
import {
  type S1ProspectusDocument,
  type IpoFilingPeriodRow,
  mapRowToIpoFilingPeriod,
} from '@/seed/types/ipo-filing';
import {
  canonicalJson,
  sha256Hex,
  buildMerkleTree,
  hmacSha256Hex,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';
import { evaluateAllControls } from '@/tree/ipo/sox404-control-ledger';
import { computeNonGaapMetrics } from './non-gaap-metrics';
import { buildDefaultPeriod } from './default-period-helper';
import {
  buildGaapFinancialsFromPeriod,
  persistProspectusPeriodMetrics,
  resolveMultiEntityConsolidation,
} from './prospectus-section-builders';

export * from './prospectus-section-builders';

export async function generateS1ProspectusPackage(
  db: D1Database,
  periodKey: string
): Promise<S1ProspectusDocument> {
  const timestamp = Date.now();

  const periodRow = await db
    .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
    .bind(periodKey)
    .first<IpoFilingPeriodRow>();

  const period = periodRow
    ? mapRowToIpoFilingPeriod(periodRow)
    : buildDefaultPeriod(periodKey, timestamp);

  const gaapFinancials = buildGaapFinancialsFromPeriod(period);
  const nonGaapFinancials = computeNonGaapMetrics(gaapFinancials);
  const consolidationSummary = await resolveMultiEntityConsolidation(db, periodKey);
  const sox404Evaluation = await evaluateAllControls(db);

  const scaleHash = await sha256Hex(
    canonicalJson({
      totalCustomers: period.totalCustomers,
      mrrCents: period.mrrCents,
      arrCents: period.arrCents,
      arpuCents: period.arpuCents,
      nrrPct: period.nrrPct,
    })
  );
  const gaapHash = await sha256Hex(canonicalJson(gaapFinancials));
  const nonGaapHash = await sha256Hex(canonicalJson(nonGaapFinancials));
  const consolidationHash = consolidationSummary.merkleSnapshotHash;
  const soxHash = sox404Evaluation.merkleRootHash;

  const prospectusMerkleTree = await buildMerkleTree([
    scaleHash,
    gaapHash,
    nonGaapHash,
    consolidationHash,
    soxHash,
  ]);
  const merkleRootHash = prospectusMerkleTree.rootHash;

  const secFilingSignature = await hmacSha256Hex(
    `${periodKey}:${period.filingType}:${merkleRootHash}:${sox404Evaluation.overallStatus}`,
    DEFAULT_AUDIT_SECRET
  );

  await persistProspectusPeriodMetrics(
    db,
    periodKey,
    merkleRootHash,
    secFilingSignature,
    sox404Evaluation.overallStatus,
    nonGaapFinancials,
    timestamp,
  );

  return {
    filingId: period.id,
    periodKey,
    filingType: period.filingType,
    targetExchanges: period.targetExchanges,
    status: period.status,
    scaleMetrics: {
      totalCustomers: period.totalCustomers,
      mrrCents: period.mrrCents,
      arrCents: period.arrCents,
      arpuCents: period.arpuCents,
      nrrPct: period.nrrPct,
      grossMarginPct: nonGaapFinancials.grossMarginPct,
    },
    gaapFinancials,
    nonGaapFinancials,
    consolidationSummary,
    sox404Evaluation,
    merkleRootHash,
    secFilingSignature,
    generatedAt: timestamp,
  };
}
