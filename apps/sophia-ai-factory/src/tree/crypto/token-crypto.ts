/**
 * Token encryption/decryption utilities.
 *
 * Canonical implementation moved to @/seed/crypto/token-crypto.
 * This file re-exports for backward compatibility.
 *
 * @module tree/crypto/token-crypto
 * @deprecated Import from @/seed/crypto/token-crypto
 */

export {
  encryptToken,
  decryptToken,
  reEncryptToken,
} from '@/seed/crypto/token-crypto';
