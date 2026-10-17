/**
 * Right-to-be-Forgotten Certificate Signing and Verification Helper
 *
 * @module tree/sovereignty/forgotten/rtbf-certificate
 */

import type {
  ErasureCertificate,
  ErasureMethod,
  ErasureRequestInput,
  VerifyCertificateResult,
} from './types';
import { DEFAULT_SIGNING_KEY_ID } from './types';
import { bytesToHex } from '../cmek-envelope-engine';
import { signContentHash, verifySignature } from '../compliance-ledger';

export async function buildSignedErasureCertificate(params: {
  input: ErasureRequestInput;
  pseudonym: string;
  recordsManifestHash: string;
  affectedRecordsCount: number;
  shreddedCount: number;
  fingerprint: string | null;
  now: number;
  signingKey: string;
}): Promise<ErasureCertificate> {
  const {
    input,
    pseudonym,
    recordsManifestHash,
    affectedRecordsCount,
    shreddedCount,
    fingerprint,
    now,
    signingKey,
  } = params;

  const randomSuffix = bytesToHex(new Uint8Array(4)).toUpperCase();
  const certNumber = `SOV-ERASURE-${now}-${randomSuffix}`;
  const certId = `ec_${bytesToHex(new Uint8Array(16))}`;

  const signatureData = `${certNumber}|${pseudonym}|${input.jurisdiction}|${recordsManifestHash}|${now}`;
  const digitalSignature = await signContentHash(signatureData, signingKey);

  const erasureMethod: ErasureMethod =
    input.erasureMethod ?? (shreddedCount > 0 ? 'hybrid_shred_and_redact' : 'anonymization_and_redaction');
  const legalBasis =
    input.legalBasis ?? (input.jurisdiction === 'EU_GDPR' ? 'GDPR Article 17(1)' : 'Vietnam PDPD Article 16');

  const certMetadata = {
    affectedRecordIdsCount: affectedRecordsCount,
    shreddedKeysCount: shreddedCount,
    statutoryNotice: 'This digital certificate constitutes cryptographic non-repudiation proof of data erasure.',
  };

  return {
    id: certId,
    certificateNumber: certNumber,
    orgId: input.orgId ?? null,
    subjectIdPseudonym: pseudonym,
    jurisdiction: input.jurisdiction,
    legalBasis,
    erasureMethod,
    shreddedKeyFingerprint: fingerprint,
    affectedRecordsCount,
    recordsManifestHash,
    verifierPublicKeyId: DEFAULT_SIGNING_KEY_ID,
    digitalSignature,
    issuedAt: now,
    certificatePdfUrl: null,
    metadata: certMetadata,
    createdAt: now,
  };
}

/**
 * Validates the cryptographic non-repudiation signature of an Erasure Certificate.
 */
export async function verifyErasureCertificate(
  certificate: ErasureCertificate,
  signingKeySecret: string,
): Promise<VerifyCertificateResult> {
  const signatureData = `${certificate.certificateNumber}|${certificate.subjectIdPseudonym}|${certificate.jurisdiction}|${certificate.recordsManifestHash}|${certificate.issuedAt}`;
  const isValid = await verifySignature(signatureData, certificate.digitalSignature, signingKeySecret);

  if (!isValid) {
    return {
      isValid: false,
      error: 'Digital signature mismatch: Certificate content or Merkle manifest has been altered.',
    };
  }

  return { isValid: true };
}
