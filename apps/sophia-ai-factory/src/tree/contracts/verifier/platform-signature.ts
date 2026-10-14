import { computeHmacHex, timingSafeEqual } from '@/seed/security/signature';

/**
 * Platform counter-signature authority key.
 * Falls back to deterministic seed for edge test environments if env not set.
 */
function getPlatformSigningKey(overrideKey?: string): string {
  if (overrideKey) return overrideKey;
  return (
    process.env.CONTRACT_SIGNING_SECRET ||
    process.env.SESSION_SECRET ||
    'sophia-enterprise-platform-counter-signature-key-2026'
  );
}

/**
 * Generate an automated platform counter-signature by Sophia AI Factory signing authority.
 * Binds the contract terms hash and customer signature hash together.
 */
export async function generatePlatformSignature(
  contractSha256: string,
  customerSignatureHash: string,
  platformSecret?: string,
): Promise<string> {
  const secret = getPlatformSigningKey(platformSecret);
  const message = `PLATFORM_COUNTERSIGN:${contractSha256}:${customerSignatureHash}`;
  return computeHmacHex(message, secret, 'SHA-256');
}

/**
 * Verify platform counter-signature hash.
 */
export async function verifyPlatformSignature(
  contractSha256: string,
  customerSignatureHash: string,
  platformSignatureHash: string,
  platformSecret?: string,
): Promise<boolean> {
  try {
    const expected = await generatePlatformSignature(
      contractSha256,
      customerSignatureHash,
      platformSecret,
    );
    return timingSafeEqual(expected.toLowerCase(), platformSignatureHash.toLowerCase());
  } catch {
    return false;
  }
}
