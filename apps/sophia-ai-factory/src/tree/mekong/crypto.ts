/**
 * @module tree/mekong/crypto
 *
 * Web Crypto API AES-256-GCM Encryption & Mutual Authentication Primitives
 * Edge-native cryptographic engine for Mekong AI Hybrid Edge Node Synchronization.
 * Zero Node Buffer dependency, constant-time comparison, tamper-resistant.
 *
 * Layer Rule: tree layer — can import seed/, cannot import forest/ or land/.
 */

import type { EncryptedPayloadEnvelope } from './types';

export const AES_GCM_ALGORITHM = 'AES-GCM';
export const KEY_LENGTH_BITS = 256;
export const IV_LENGTH_BYTES = 12;
export const AUTH_TAG_LENGTH_BYTES = 16;
export const PROTOCOL_VERSION = 'v1' as const;

export class MekongCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MekongCryptoError';
    Object.setPrototypeOf(this, MekongCryptoError.prototype);
  }
}

export class MekongTamperError extends MekongCryptoError {
  constructor(message = 'Payload integrity verification failed: ciphertext or IV tampered') {
    super(message);
    this.name = 'MekongTamperError';
    Object.setPrototypeOf(this, MekongTamperError.prototype);
  }
}

export class MekongKeyError extends MekongCryptoError {
  constructor(message = 'Invalid secret or key material') {
    super(message);
    this.name = 'MekongKeyError';
    Object.setPrototypeOf(this, MekongKeyError.prototype);
  }
}

export class MekongPayloadError extends MekongCryptoError {
  constructor(message = 'Malformed encrypted payload envelope') {
    super(message);
    this.name = 'MekongPayloadError';
    Object.setPrototypeOf(this, MekongPayloadError.prototype);
  }
}

/**
 * Universal base64 encoder without Node Buffer dependency.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Universal base64 decoder without Node Buffer dependency.
 */
export function base64ToBytes(b64: string): Uint8Array {
  try {
    const binary = atob(b64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    throw new MekongPayloadError(`Invalid base64 string: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Constant-time string equality check using bitwise XOR to prevent timing side-channel attacks.
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Computes SHA-256 hexadecimal digest of a token string.
 */
export async function hashAuthToken(token: string): Promise<string> {
  if (!token || typeof token !== 'string') {
    throw new MekongKeyError('Token must be a non-empty string');
  }
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies an auth token against an expected SHA-256 hash in constant-time.
 */
export async function verifyAuthTokenHash(token: string, expectedHash: string): Promise<boolean> {
  if (!token || !expectedHash || typeof token !== 'string' || typeof expectedHash !== 'string') {
    return false;
  }
  try {
    let cleanHash = expectedHash.trim().toLowerCase();
    if (cleanHash.startsWith('sha256=')) {
      cleanHash = cleanHash.slice(7);
    }
    const computedHash = await hashAuthToken(token);
    return timingSafeEqual(computedHash, cleanHash);
  } catch {
    return false;
  }
}

/**
 * Derives a 256-bit CryptoKey from a shared secret or bearer token using SHA-256 key stretching.
 */
export async function deriveEncryptionKey(secret: string): Promise<CryptoKey> {
  if (!secret || typeof secret !== 'string') {
    throw new MekongKeyError('Secret must be a non-empty string');
  }
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: AES_GCM_ALGORITHM, length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts an arbitrary payload object using AES-256-GCM with a fresh random 12-byte IV.
 */
export async function encryptPayload<T = unknown>(
  data: T,
  secretOrKey: string | CryptoKey,
): Promise<EncryptedPayloadEnvelope> {
  if (data === undefined) {
    throw new MekongPayloadError('Payload data cannot be undefined');
  }
  const key = typeof secretOrKey === 'string' ? await deriveEncryptionKey(secretOrKey) : secretOrKey;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encodedPlaintext = new TextEncoder().encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: AES_GCM_ALGORITHM, iv: iv as BufferSource },
    key,
    encodedPlaintext as BufferSource,
  );

  return {
    version: PROTOCOL_VERSION,
    algorithm: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    timestamp: Date.now(),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload envelope.
 * Throws MekongTamperError on any single-bit alteration or authentication tag mismatch.
 */
export async function decryptPayload<T = unknown>(
  envelope: EncryptedPayloadEnvelope,
  secretOrKey: string | CryptoKey,
): Promise<T> {
  if (!envelope || typeof envelope !== 'object') {
    throw new MekongPayloadError('Invalid envelope: payload must be an object');
  }
  if (envelope.algorithm !== 'AES-256-GCM' || !envelope.iv || !envelope.ciphertext) {
    throw new MekongPayloadError('Unsupported encryption algorithm or missing IV/ciphertext');
  }

  const iv = base64ToBytes(envelope.iv);
  if (iv.length !== IV_LENGTH_BYTES) {
    throw new MekongPayloadError(`Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, got ${iv.length}`);
  }

  const ciphertextWithTag = base64ToBytes(envelope.ciphertext);
  if (ciphertextWithTag.length < AUTH_TAG_LENGTH_BYTES) {
    throw new MekongPayloadError('Ciphertext is too short to contain a valid authentication tag');
  }

  const key = typeof secretOrKey === 'string' ? await deriveEncryptionKey(secretOrKey) : secretOrKey;

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: AES_GCM_ALGORITHM, iv: iv as BufferSource },
      key,
      ciphertextWithTag as BufferSource,
    );
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedText) as T;
  } catch (err) {
    if (err instanceof MekongCryptoError) {
      throw err;
    }
    if (err instanceof SyntaxError) {
      throw new MekongPayloadError(`Failed to parse decrypted JSON: ${err.message}`);
    }
    throw new MekongTamperError();
  }
}
