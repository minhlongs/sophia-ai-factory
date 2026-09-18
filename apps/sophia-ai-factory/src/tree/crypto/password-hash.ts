/**
 * Password hashing utilities using Web Crypto API (PBKDF2).
 * Compatible with Cloudflare Workers runtime.
 * Format: pbkdf2:{saltHex}:{hashHex}
 *
 * Layer: tree/crypto (re-exports canonical seed/security primitive)
 */

export { hashPassword, verifyPassword } from '@/seed/security/password-hash';
