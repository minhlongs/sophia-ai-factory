/**
 * SOX 404 Filing Period Certification Helper
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/sox-certification-helper
 */

import { success, failure } from '@/seed/types/result';
import type { SoxAttestationCertificate } from '@/seed/types/ipo-filing';
import {
  evaluateAllControls,
  generateCryptographicAttestation,
} from '@/tree/ipo/sox404-control-ledger';
import type { ActionResult, resolveDb } from './common';

type ResolvedDb = Extract<Awaited<ReturnType<typeof resolveDb>>, { ok: true }>['value'];

export async function executeSoxFilingCertification(
  db: ResolvedDb,
  userId: string,
  periodKey: string
): Promise<ActionResult<SoxAttestationCertificate>> {
  const summary = await evaluateAllControls(db);
  if (summary.overallStatus !== 'certified_clean') {
    return failure({
      code: 'SOX_DEFICIENCY',
      message: `Cannot certify period ${periodKey}: SOX status is '${summary.overallStatus}' with ${summary.deficienciesCount} deficiencies.`,
    });
  }

  const certificate = await generateCryptographicAttestation(
    summary,
    userId,
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
      userId,
      timestamp,
      timestamp,
      periodKey
    )
    .run();

  return success(certificate);
}
