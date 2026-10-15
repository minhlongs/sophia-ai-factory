/**
 * CMEK Envelope Encryption Types & Error Classes
 *
 * Layer: tree/sovereignty/cmek
 */

import type { SovereignZoneCode, KeyType } from '@/seed/types/sovereign-vault';

export const AES_ALGORITHM = 'AES-GCM';
export const KEY_LENGTH_BITS = 256;
export const KEY_LENGTH_BYTES = 32;
export const IV_LENGTH_BYTES = 12;
export const ENVELOPE_PREFIX = 'cmek-v1';

export class CmekCryptoError extends Error {
  constructor(message: string, public readonly code: string) {
    super(`[CmekCryptoError] ${code}: ${message}`);
    this.name = 'CmekCryptoError';
  }
}

export class CmekTamperError extends CmekCryptoError {
  constructor(detail = 'Ciphertext authentication tag verification failed or AAD tampered') {
    super(detail, 'CIPHERTEXT_TAMPER_DETECTED');
    this.name = 'CmekTamperError';
  }
}

export class CmekKeyDestroyedError extends CmekCryptoError {
  constructor(keyId: string) {
    super(`Key ${keyId} has been crypto-shredded and cannot be used for decryption`, 'KEY_DESTROYED');
    this.name = 'CmekKeyDestroyedError';
  }
}

export interface CreateKeyInput {
  orgId: string;
  zoneId: string;
  zoneCode: SovereignZoneCode;
  keyAlias: string;
  keyType?: KeyType;
  rawKek?: Uint8Array;
  rotationIntervalDays?: number;
}
