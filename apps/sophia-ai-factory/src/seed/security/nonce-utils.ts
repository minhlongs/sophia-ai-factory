/**
 * CSP nonce and generic random-nonce utilities.
 *
 * Extracted from raas-service-key-operations so middleware and other
 * core infrastructure do not depend on the RaaS module.
 */

/**
 * Generate a 32-character hex nonce.
 *
 * Used by middleware.ts for CSP nonce injection on every request.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
