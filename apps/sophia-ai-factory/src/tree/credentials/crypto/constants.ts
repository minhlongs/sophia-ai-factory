/**
 * Credentials Encryption Constants & Byte Helpers
 *
 * Layer: tree/credentials
 */

export const ALGORITHM = 'AES-GCM';
export const IV_BYTES = 12;
export const KEY_LEN_BITS = 256;
export const KEY_LEN_BYTES = 32;
export const DUAL_DECRYPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface KeyVersionRow {
  version: number;
  encrypted_key: string;
  rotated_at: string | null;
  is_active: number;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== KEY_LEN_BYTES * 2) {
    throw new Error(
      `CREDENTIALS_MASTER_KEY must be ${KEY_LEN_BYTES * 2} hex chars, got ${hex.length}`,
    );
  }
  const out = new Uint8Array(KEY_LEN_BYTES);
  for (let i = 0; i < KEY_LEN_BYTES; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
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

export function parseEncryptedValue(encrypted: string): { version: number; iv: Uint8Array; ct: Uint8Array } {
  const parts = encrypted.split(':');
  let version = 1;
  let ivPart: string;
  let ctPart: string;

  if (parts.length === 3 && parts[0].startsWith('v')) {
    version = Number(parts[0].slice(1));
    ivPart = parts[1];
    ctPart = parts[2];
  } else if (parts.length === 2) {
    ivPart = parts[0];
    ctPart = parts[1];
  } else {
    throw new Error('decryptValue: malformed -- expected <iv>:<ct> or v<version>:<iv>:<ct>');
  }

  const iv = base64ToBytes(ivPart);
  const ct = base64ToBytes(ctPart);
  if (iv.length !== IV_BYTES) throw new Error(`decryptValue: iv must be ${IV_BYTES} bytes`);

  return { version, iv, ct };
}
