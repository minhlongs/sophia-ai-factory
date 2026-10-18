/**
 * CMEK Envelope Encryption & Key Operations Engine
 *
 * Layer: tree/sovereignty/cmek
 */

import type {
  EnvelopeAad,
  EnvelopeCiphertextPayload,
} from '@/seed/types/sovereign-vault';
import {
  AES_ALGORITHM,
  IV_LENGTH_BYTES,
  ENVELOPE_PREFIX,
  CmekCryptoError,
  CmekTamperError,
} from './envelope-types';
import {
  bytesToBase64,
  base64ToBytes,
  canonicalAadJson,
  importAesGcmKey,
} from './web-crypto-primitives';

export { wrapDek, unwrapDek, cryptoShredDek } from './dek-wrapping';

export async function encryptWithEnvelope(
  plaintext: string | Uint8Array,
  rawDek: Uint8Array,
  aad: EnvelopeAad,
  keyId: string,
  keyVersion: number,
): Promise<{
  envelopeString: string;
  payload: EnvelopeCiphertextPayload;
}> {
  const dekCryptoKey = await importAesGcmKey(rawDek);
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);

  const plainBytes =
    typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;

  const canonicalAad = canonicalAadJson(aad);
  const aadBytes = new TextEncoder().encode(canonicalAad);

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM,
      iv: iv as unknown as BufferSource,
      additionalData: aadBytes as unknown as BufferSource,
    },
    dekCryptoKey,
    plainBytes as unknown as BufferSource,
  );

  const ivBase64 = bytesToBase64(iv);
  const ciphertextBase64 = bytesToBase64(new Uint8Array(cipherBuffer));
  const envelopeString = `${ENVELOPE_PREFIX}:${keyId}:${keyVersion}:${ivBase64}:${ciphertextBase64}`;

  return {
    envelopeString,
    payload: {
      header: ENVELOPE_PREFIX,
      keyId,
      keyVersion,
      ivBase64,
      ciphertextBase64,
      aadCanonicalJson: canonicalAad,
    },
  };
}

export async function decryptWithEnvelope(
  envelopeString: string,
  rawDek: Uint8Array,
  expectedAad: EnvelopeAad,
): Promise<string> {
  const parts = envelopeString.split(':');
  if (parts.length !== 5 || parts[0] !== ENVELOPE_PREFIX) {
    throw new CmekCryptoError(
      `Invalid envelope format: expected ${ENVELOPE_PREFIX}:<keyId>:<keyVersion>:<iv>:<ciphertext>`,
      'INVALID_ENVELOPE_FORMAT',
    );
  }

  const [, , versionStr, ivBase64, ciphertextBase64] = parts;
  const version = parseInt(versionStr, 10);

  if (version !== expectedAad.keyVersion) {
    throw new CmekTamperError(
      `Key version mismatch: envelope specifies v${version}, expected v${expectedAad.keyVersion}`,
    );
  }

  const dekCryptoKey = await importAesGcmKey(rawDek);
  const iv = base64ToBytes(ivBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);
  const canonicalAad = canonicalAadJson(expectedAad);
  const aadBytes = new TextEncoder().encode(canonicalAad);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: AES_ALGORITHM,
        iv: iv as unknown as BufferSource,
        additionalData: aadBytes as unknown as BufferSource,
      },
      dekCryptoKey,
      ciphertext as unknown as BufferSource,
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    if (err instanceof CmekCryptoError) throw err;
    throw new CmekTamperError();
  }
}
