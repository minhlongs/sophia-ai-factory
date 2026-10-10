/**
 * BYOK Crypto Types and Constants
 *
 * Layer: tree/byok/crypto
 */

export const ALGORITHM = 'AES-GCM';
export const IV_BYTES = 12;
export const VERSION_BYTES = 1;
export const KEY_LEN_BITS = 256;
export const KEY_LEN_BYTES = KEY_LEN_BITS / 8;

export interface KeyVersionRow {
  version: number;
  encrypted_key: string;
  rotated_at: string | null;
  is_active: number;
}

export class ByokMissingMasterKeyError extends Error {
  constructor() {
    super('BYOK_MASTER_KEY_MISSING: set BYOK_MASTER_KEY env (base64 32 bytes)');
    this.name = 'ByokMissingMasterKeyError';
  }
}

export class ByokInvalidMasterKeyError extends Error {
  constructor(detail: string) {
    super(`BYOK_MASTER_KEY_INVALID: ${detail}`);
    this.name = 'ByokInvalidMasterKeyError';
  }
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function packedToText(packed: Uint8Array): string {
  return bytesToBase64(packed);
}

export function textToPacked(text: string): Uint8Array {
  return base64ToBytes(text);
}
