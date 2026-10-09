/**
 * Enterprise Contract Digital Signer
 *
 * Implements dual-sided cryptographic signing of enterprise contracts.
 *
 * Layer: land (Business domain workflow)
 *
 * @module land/contracts/workflow/contract-signer
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { EnterpriseContract, CustomerSignerInput } from '@/seed/types/enterprise-contracts';
import {
  generateCustomerSignature,
  generatePlatformSignature,
} from '@/tree/contracts/contract-signature-verifier';
import { getContractById } from './contract-converter';

/**
 * Execute dual-sided digital signing of the enterprise contract.
 */
export async function executeContractSigning(
  db: D1Database,
  contractId: string,
  signer: CustomerSignerInput,
): Promise<EnterpriseContract> {
  const contract = await getContractById(db, contractId);
  if (!contract) {
    throw new Error(`Enterprise contract not found: ${contractId}`);
  }

  if (contract.status !== 'pending_signature' && contract.status !== 'draft') {
    throw new Error(`Cannot sign contract with status '${contract.status}'`);
  }

  const now = Math.floor(Date.now() / 1000);
  const secret =
    signer.signingSecret ||
    process.env.CONTRACT_SIGNING_SECRET ||
    'sophia-contract-signer-salt-2026';

  // 1. Generate customer signature HMAC
  const customerSig = await generateCustomerSignature(
    contract.contractSha256,
    { email: signer.signerEmail, timestamp: now },
    secret,
  );

  // 2. Generate platform counter-signature
  const platformSig = await generatePlatformSignature(contract.contractSha256, customerSig);

  // 3. Update contract in D1
  await db
    .prepare(
      `UPDATE enterprise_contracts SET
        status = 'signed',
        customer_signer_name = ?1,
        customer_signer_email = ?2,
        customer_signer_title = ?3,
        customer_signer_ip = ?4,
        customer_signature_hash = ?5,
        customer_signed_at = ?6,
        platform_signature_hash = ?7,
        platform_signed_at = ?8,
        updated_at = ?9
      WHERE id = ?10`,
    )
    .bind(
      signer.signerName,
      signer.signerEmail,
      signer.signerTitle,
      signer.signerIp ?? null,
      customerSig,
      now,
      platformSig,
      now,
      now,
      contractId,
    )
    .run();

  const updated = await getContractById(db, contractId);
  if (!updated) throw new Error('Failed to retrieve signed contract');
  return updated;
}
