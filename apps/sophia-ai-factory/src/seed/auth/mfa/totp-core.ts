/**
 * Core TOTP implementation using RFC 6238 and Web Crypto API.
 *
 * @module seed/auth/mfa/totp-core
 */

import * as OTPAuth from 'otpauth';

export const ISSUER = 'Sophia AI Factory';
export const DIGITS = 6;
export const PERIOD = 30;
export const ALGORITHM = 'SHA1';

/** Generate a new TOTP secret (base32-encoded 20 bytes). */
export function generateTotpSecret(): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    digits: DIGITS,
    period: PERIOD,
    algorithm: ALGORITHM,
  });
  return totp.secret.base32;
}

/** Build an otpauth:// URI for QR code encoding. */
export function generateOtpauthUri(email: string, secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

/**
 * Verify a 6-digit TOTP code.
 * window=1 allows ±1 period (±30 s) for clock skew.
 */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      algorithm: ALGORITHM,
      digits: DIGITS,
      period: PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token: code, window });
    return delta !== null;
  } catch {
    return false;
  }
}
