import { computeHmacHex, timingSafeEqual } from '@/seed/security/signature';

/**
 * Generate a digital signature hash for the customer authorized signatory.
 *
 * @param contractSha256 The 64-char hex SHA-256 digest of canonical terms
 * @param signer Signer email and signing timestamp
 * @param secret Private signing secret / salt (e.g. session token or org signing secret)
 */
export async function generateCustomerSignature(
  contractSha256: string,
  signer: { email: string; timestamp: number },
  secret: string,
): Promise<string> {
  const message = `CUSTOMER_SIGNATURE:${contractSha256}:${signer.email.toLowerCase().trim()}:${signer.timestamp}`;
  return computeHmacHex(message, secret, 'SHA-256');
}

/**
 * Verify customer signature against contract hash and signing details.
 */
export async function verifyCustomerSignature(
  contractSha256: string,
  signer: { email: string; timestamp: number },
  signatureHash: string,
  secret: string,
): Promise<boolean> {
  try {
    const expected = await generateCustomerSignature(contractSha256, signer, secret);
    return timingSafeEqual(expected.toLowerCase(), signatureHash.toLowerCase());
  } catch {
    return false;
  }
}
