import type {
  EnterpriseContract,
  ContractSignatureVerificationResult,
} from '@/seed/types/enterprise-contracts';
import { timingSafeEqual } from '@/seed/security/signature';
import { extractSignablePayload, computeContractHash } from './hashing';
import { verifyCustomerSignature } from './customer-signature';
import { verifyPlatformSignature } from './platform-signature';

/**
 * Comprehensive dual-sided verification of contract integrity and cryptographic signatures.
 * Detects any tampering in contract terms, values, dates, or signatures.
 */
export async function verifyContractIntegrity(
  contract: EnterpriseContract,
  customerSecret: string,
  platformSecret?: string,
): Promise<ContractSignatureVerificationResult> {
  // 1. Recompute SHA-256 hash of canonical terms
  const payload = extractSignablePayload(contract);
  const recomputedHash = await computeContractHash(payload);

  if (!timingSafeEqual(recomputedHash, contract.contractSha256)) {
    return {
      isValid: false,
      contractSha256: recomputedHash,
      customerSignatureValid: false,
      platformSignatureValid: false,
      reason: 'Contract terms hash mismatch: canonical payload has been modified or tampered with.',
    };
  }

  // 2. Verify customer signature if present
  let customerSignatureValid = false;
  if (
    contract.customerSignatureHash &&
    contract.customerSignerEmail &&
    contract.customerSignedAt
  ) {
    customerSignatureValid = await verifyCustomerSignature(
      recomputedHash,
      {
        email: contract.customerSignerEmail,
        timestamp: contract.customerSignedAt,
      },
      contract.customerSignatureHash,
      customerSecret,
    );

    if (!customerSignatureValid) {
      return {
        isValid: false,
        contractSha256: recomputedHash,
        customerSignatureValid: false,
        platformSignatureValid: false,
        reason: 'Customer cryptographic signature verification failed.',
      };
    }
  }

  // 3. Verify platform counter-signature if present
  let platformSignatureValid = false;
  if (contract.platformSignatureHash && contract.customerSignatureHash) {
    platformSignatureValid = await verifyPlatformSignature(
      recomputedHash,
      contract.customerSignatureHash,
      contract.platformSignatureHash,
      platformSecret,
    );

    if (!platformSignatureValid) {
      return {
        isValid: false,
        contractSha256: recomputedHash,
        customerSignatureValid,
        platformSignatureValid: false,
        reason: 'Platform counter-signature verification failed.',
      };
    }
  }

  const fullySigned = Boolean(customerSignatureValid && platformSignatureValid);

  return {
    isValid: fullySigned,
    contractSha256: recomputedHash,
    customerSignatureValid,
    platformSignatureValid,
    reason: fullySigned ? undefined : 'Contract is partially signed or pending signature.',
  };
}
