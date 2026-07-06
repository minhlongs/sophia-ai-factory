/**
 * Credentials encryption — re-exported from seed.
 *
 * The implementation lives in seed/security/credential-crypto.ts so that
 * seed-layer modules (platform-config-repo, etc.) can use encryptValue/
 * decryptValue without crossing the seed → tree boundary.
 * Tree consumers import from here to keep a stable import path.
 */

export { encryptValue, decryptValue } from '@/seed/security/credential-crypto'
