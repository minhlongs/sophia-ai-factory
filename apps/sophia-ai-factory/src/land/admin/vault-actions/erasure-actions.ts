/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: Erasure Actions
 *
 * Implements Right-to-be-Forgotten pipeline and Erasure Certificate verification.
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/erasure-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ErasureCertificate,
  ErasureRequestInput,
  ErasureExecutionResult,
} from '@/seed/types/sovereign-vault';
import {
  executeRightToBeForgotten,
  verifyErasureCertificate,
  getErasureCertificateByNumber,
} from '@/tree/sovereignty/right-to-be-forgotten-engine';
import { assertVaultAccess } from './auth-guard';
import type { SovereignVaultActionError } from './types';

/**
 * Triggers the automated Right-to-be-Forgotten pipeline and issues an Erasure Certificate.
 */
export async function executeRightToBeForgottenAction(
  input: ErasureRequestInput,
): Promise<Result<ErasureExecutionResult, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, input.orgId);
  if (!auth.ok) return auth;

  try {
    const result = await executeRightToBeForgotten(db, input, {
      actorId: auth.value.userId,
    });

    return success(result);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to execute right-to-be-forgotten', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to process erasure request' });
  }
}

/**
 * Verifies an Erasure Certificate by its unique certificate number.
 */
export async function verifyErasureCertificateAction(
  certificateNumber: string,
): Promise<
  Result<{ verified: boolean; certificate: ErasureCertificate }, SovereignVaultActionError>
> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  try {
    const cert = await getErasureCertificateByNumber(db, certificateNumber);
    if (!cert) {
      return failure({
        code: 'CERTIFICATE_NOT_FOUND',
        message: `Erasure certificate ${certificateNumber} was not found in the sovereign registry`,
      });
    }

    const signingKey = process.env.SOVEREIGN_COMPLIANCE_KEY ?? 'sophia_sov_vault_sec_master_2026';
    const verifyResult = await verifyErasureCertificate(cert, signingKey);

    if (!verifyResult.isValid) {
      return failure({
        code: 'INVALID_SIGNATURE',
        message: verifyResult.error ?? 'Certificate signature verification failed',
      });
    }

    return success({ verified: true, certificate: cert });
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to verify erasure certificate', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to verify erasure certificate' });
  }
}
