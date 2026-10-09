/**
 * Domain Name & DKIM Validation Utilities
 *
 * @module tree/partners/resend/domain-validator
 */

const DOMAIN_NAME_REGEX =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

/**
 * Validates domain name syntax for email sending.
 * Rejects IP addresses, localhost, protocols, paths, and invalid characters.
 */
export function isValidDomainName(domain: string | null | undefined): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  const clean = domain.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 253) {
    return false;
  }
  if (clean === 'localhost' || clean.endsWith('.local') || clean.endsWith('.localhost')) {
    return false;
  }
  // Reject IP addresses
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return false;
  }
  return DOMAIN_NAME_REGEX.test(clean);
}

/**
 * Deterministically generates a mock DKIM public key for offline / test provisioning.
 */
export function generateDkimPublicKey(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash << 5) - hash + domain.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7${hex}8N3v9w2q1rZ0xK9mP4w==`;
}
