/**
 * AES-256-GCM encryption and decryption primitives using Web Crypto API.
 * @module tree/mekong/crypto/cipher
 */

import type { EncryptedPayloadEnvelope } from '../types';
import {
  AES_GCM_ALGORITHM,
  KEY_LENGTH_BITS,
  IV_LENGTH_BYTES,
  AUTH_TAG_LENGTH_BYTES,
  PROTOCOL_VERSION,
} from './constants';
import {
  MekongCryptoError,
  MekongTamperError,
  MekongKeyError,
  MekongPayloadError,
} from './errors';
import { bytesToBase64, base64ToBytes } from './encoding';

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
