/**
 * TOTP Service — RFC 6238 TOTP implementation using Web Crypto API.
 * Compatible with Cloudflare Workers runtime (no Node.js built-ins).
 *
 * Uses `otpauth` package for standards-compliant TOTP + URI generation.
 * Backup codes: 8 codes in XXXX-XXXX format, SHA-256 hashed before storage.
 *
 * Wave 13 G-I3: Added verifyTotpWithLazyEncrypt() for AES-256-GCM backfill.
 * Existing plaintext secrets (is_encrypted=0 in mfa_secrets) are encrypted
 * in-place on the first successful TOTP verification.
 *
 * @module seed/auth/mfa/totp-service
 */

export {
  generateBackupCodes,
  hashBackupCode,
  hashBackupCodesToJson,
  verifyBackupCode,
  consumeBackupCode,
} from './backup-codes-helpers';
export {
  generateTotpSecret,
  generateOtpauthUri,
  verifyTotp,
} from './totp-core';
export {
  verifyTotpWithLazyEncrypt,
  type MfaSecretsEncRow,
  type LazyEncryptDb,
} from './lazy-encrypt-helper';
