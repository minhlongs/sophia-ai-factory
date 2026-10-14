/**
 * Cryptographic constants for Mekong Edge synchronization.
 * @module tree/mekong/crypto/constants
 */

export const AES_GCM_ALGORITHM = 'AES-GCM';
export const KEY_LENGTH_BITS = 256;
export const IV_LENGTH_BYTES = 12;
export const AUTH_TAG_LENGTH_BYTES = 16;
export const PROTOCOL_VERSION = 'v1' as const;
