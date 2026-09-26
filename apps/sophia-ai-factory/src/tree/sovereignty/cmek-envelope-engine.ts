/**
 * Customer-Managed Encryption Keys (CMEK) Envelope Encryption Engine
 *
 * Implements high-assurance cryptographic envelope encryption using Web Crypto
 * SubtleCrypto AES-256-GCM with Authenticated Additional Data (AAD) binding.
 *
 * Security Invariants:
 * 1. DEKs (Data Encryption Keys) are 256-bit ephemeral keys wrapped by customer KEKs.
 * 2. Authenticated Additional Data (AAD) strictly binds { orgId, zoneCode, keyVersion }
 *    preventing cross-tenant ciphertext splicing or jurisdiction smuggling.
 * 3. Any single-bit tamper in ciphertext or AAD throws an AES-GCM authentication failure.
 * 4. Zero-knowledge crypto-shredding: Overwrites wrapped DEK with random entropy,
 *    rendering all historical ciphertext permanently undecryptable worldwide.
 *
 * Layer: tree (Domain logic & cryptographic algorithms)
 * Allowed imports: @/seed/*, standard Web Crypto APIs
 *
 * @module tree/sovereignty/cmek-envelope-engine
 */

import type {
  SovereignZoneCode,
  EnvelopeAad,
  EnvelopeCiphertextPayload,
  TenantSovereignKey,
  KeyState,
  KeyType,
} from '@/seed/types/sovereign-vault';

const AES_ALGORITHM = 'AES-GCM';
const KEY_LENGTH_BITS = 256;
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const ENVELOPE_PREFIX = 'cmek-v1';

// ── Error Classes ─────────────────────────────────────────────────────────────

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

// ── Binary & Base64 Helpers (Edge & Browser Compatible) ───────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().toLowerCase();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Deterministically serializes AAD object with sorted keys
 * to ensure bit-level reproducibility across edge isolates.
 */
export function canonicalAadJson(aad: EnvelopeAad): string {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(aad).sort();
  for (const k of keys) {
    if (aad[k] !== undefined) {
      sorted[k] = aad[k];
    }
  }
  return JSON.stringify(sorted);
}

// ── Web Crypto Key Management ─────────────────────────────────────────────────

/**
 * Generates 256 bits (32 bytes) of cryptographically secure random key material.
 */
export function generateRawKey(): Uint8Array {
  const keyBytes = new Uint8Array(KEY_LENGTH_BYTES);
  crypto.getRandomValues(keyBytes);
  return keyBytes;
}

/**
 * Imports raw 256-bit key bytes into a Web Crypto CryptoKey for AES-GCM.
 */
export async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.byteLength !== KEY_LENGTH_BYTES) {
    throw new CmekCryptoError(
      `Invalid key length: expected ${KEY_LENGTH_BYTES} bytes, got ${rawKey.byteLength}`,
      'INVALID_KEY_LENGTH',
    );
  }

  return crypto.subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    { name: AES_ALGORITHM, length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Computes a SHA-256 fingerprint hex of key bytes for auditing and identification.
 */
export async function computeKeyFingerprint(keyBytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Instantly zeroizes a key buffer in memory to eliminate residue in RAM.
 */
export function zeroizeKey(buffer: Uint8Array): void {
  buffer.fill(0);
}

// ── DEK Wrapping & Unwrapping (Envelope Key Encryption) ─────────────────────────

/**
 * Wraps a Data Encryption Key (DEK) with a Key Encryption Key (KEK) using AES-256-GCM.
 */
export async function wrapDek(
  rawDek: Uint8Array,
  rawKek: Uint8Array,
): Promise<{ wrappedDekBase64: string; dekIvBase64: string }> {
  const kekCryptoKey = await importAesGcmKey(rawKek);
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);

  const wrappedBuffer = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv: iv as unknown as BufferSource },
    kekCryptoKey,
    rawDek as unknown as BufferSource,
  );

  return {
    wrappedDekBase64: bytesToBase64(new Uint8Array(wrappedBuffer)),
    dekIvBase64: bytesToBase64(iv),
  };
}

/**
 * Unwraps a Data Encryption Key (DEK) using a Key Encryption Key (KEK).
 */
export async function unwrapDek(
  wrappedDekBase64: string,
  dekIvBase64: string,
  rawKek: Uint8Array,
): Promise<Uint8Array> {
  const kekCryptoKey = await importAesGcmKey(rawKek);
  const iv = base64ToBytes(dekIvBase64);
  const ciphertext = base64ToBytes(wrappedDekBase64);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv: iv as unknown as BufferSource },
      kekCryptoKey,
      ciphertext as unknown as BufferSource,
    );
    return new Uint8Array(decryptedBuffer);
  } catch {
    throw new CmekCryptoError(
      'Failed to unwrap DEK: Invalid KEK, corrupted wrapped DEK, or key has been shredded',
      'DEK_UNWRAP_FAILED',
    );
  }
}

// ── Envelope Encryption & Decryption ──────────────────────────────────────────

/**
 * Encrypts arbitrary data (string or bytes) using a DEK and binds Authenticated Additional Data (AAD).
 * Produces the standardized canonical envelope string:
 *   cmek-v1:<keyId>:<keyVersion>:<iv12_b64>:<ciphertext_b64>
 */
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

/**
 * Decrypts a standardized CMEK envelope ciphertext with Authenticated Additional Data (AAD).
 * Throws `CmekTamperError` if ciphertext or AAD has been modified.
 */
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

// ── Zero-Knowledge Crypto-Shredding ───────────────────────────────────────────

/**
 * Executes irreversible zero-knowledge crypto-shredding on a wrapped DEK.
 * Replaces the stored encrypted DEK with random noise entropy, guaranteeing
 * that all ciphertext encrypted with this DEK becomes mathematically irrecoverable.
 */
export function cryptoShredDek(): {
  shreddedDekBase64: string;
  shreddedAt: number;
} {
  const randomEntropy = new Uint8Array(64);
  crypto.getRandomValues(randomEntropy);

  return {
    shreddedDekBase64: bytesToBase64(randomEntropy),
    shreddedAt: Date.now(),
  };
}

// ── Key Rotation & Factory Helpers ────────────────────────────────────────────

export interface CreateKeyInput {
  orgId: string;
  zoneId: string;
  zoneCode: SovereignZoneCode;
  keyAlias: string;
  keyType?: KeyType;
  rawKek?: Uint8Array;
  rotationIntervalDays?: number;
}

/**
 * Initializes a new TenantSovereignKey record with freshly generated DEK wrapped by KEK.
 */
export async function initializeTenantSovereignKey(
  input: CreateKeyInput,
): Promise<{
  keyRecord: TenantSovereignKey;
  rawDek: Uint8Array;
  rawKek: Uint8Array;
}> {
  const rawDek = generateRawKey();
  const rawKek = input.rawKek ?? generateRawKey();

  const { wrappedDekBase64, dekIvBase64 } = await wrapDek(rawDek, rawKek);
  const fingerprint = await computeKeyFingerprint(rawKek);

  const now = Date.now();
  const rotationDays = input.rotationIntervalDays ?? 90;
  const keyId = `tsk_${input.orgId.replace(/[^a-zA-Z0-9]/g, '_')}_${input.keyAlias}_v1`;

  const keyRecord: TenantSovereignKey = {
    id: keyId,
    orgId: input.orgId,
    zoneId: input.zoneId,
    keyAlias: input.keyAlias,
    keyType: input.keyType ?? 'platform_managed_isolated',
    algorithm: 'AES-256-GCM',
    keyVersion: 1,
    wrappedDekCiphertext: wrappedDekBase64,
    dekIvBase64,
    kekReferenceOrFingerprint: fingerprint,
    keyState: 'active',
    rotationIntervalDays: rotationDays,
    lastRotatedAt: now,
    nextRotationDueAt: now + rotationDays * 86400000,
    revokedAt: null,
    revocationReason: null,
    createdAt: now,
    updatedAt: now,
  };

  return { keyRecord, rawDek, rawKek };
}

/**
 * Rotates a tenant's sovereign key by generating a new DEK, incrementing the key version,
 * and wrapping the new DEK under the existing or newly provided KEK.
 */
export async function rotateTenantSovereignKey(
  currentKey: TenantSovereignKey,
  rawKek: Uint8Array,
  newRawKek?: Uint8Array,
): Promise<{
  rotatedKeyRecord: TenantSovereignKey;
  newRawDek: Uint8Array;
}> {
  if (currentKey.keyState === 'destroyed') {
    throw new CmekKeyDestroyedError(currentKey.id);
  }

  const effectiveKek = newRawKek ?? rawKek;
  const newRawDek = generateRawKey();
  const { wrappedDekBase64, dekIvBase64 } = await wrapDek(newRawDek, effectiveKek);
  const fingerprint = await computeKeyFingerprint(effectiveKek);

  const now = Date.now();
  const nextVersion = currentKey.keyVersion + 1;
  const keyId = `tsk_${currentKey.orgId.replace(/[^a-zA-Z0-9]/g, '_')}_${currentKey.keyAlias}_v${nextVersion}`;

  const rotatedKeyRecord: TenantSovereignKey = {
    id: keyId,
    orgId: currentKey.orgId,
    zoneId: currentKey.zoneId,
    keyAlias: currentKey.keyAlias,
    keyType: currentKey.keyType,
    algorithm: 'AES-256-GCM',
    keyVersion: nextVersion,
    wrappedDekCiphertext: wrappedDekBase64,
    dekIvBase64,
    kekReferenceOrFingerprint: fingerprint,
    keyState: 'active',
    rotationIntervalDays: currentKey.rotationIntervalDays,
    lastRotatedAt: now,
    nextRotationDueAt: now + currentKey.rotationIntervalDays * 86400000,
    revokedAt: null,
    revocationReason: null,
    createdAt: now,
    updatedAt: now,
  };

  return { rotatedKeyRecord, newRawDek };
}

/**
 * Normalizes a raw database row into the strongly typed TenantSovereignKey interface.
 */
export function mapRowToTenantSovereignKey(row: Record<string, unknown>): TenantSovereignKey {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    zoneId: String(row.zone_id),
    keyAlias: String(row.key_alias),
    keyType: row.key_type as KeyType,
    algorithm: String(row.algorithm || 'AES-256-GCM'),
    keyVersion: Number(row.key_version || 1),
    wrappedDekCiphertext: String(row.wrapped_dek_ciphertext),
    dekIvBase64: String(row.dek_iv_base64),
    kekReferenceOrFingerprint: String(row.kek_reference_or_fingerprint),
    keyState: row.key_state as KeyState,
    rotationIntervalDays: Number(row.rotation_interval_days || 90),
    lastRotatedAt: row.last_rotated_at ? Number(row.last_rotated_at) : null,
    nextRotationDueAt: row.next_rotation_due_at ? Number(row.next_rotation_due_at) : null,
    revokedAt: row.revoked_at ? Number(row.revoked_at) : null,
    revocationReason: row.revocation_reason ? String(row.revocation_reason) : null,
    createdAt: Number(row.created_at || Date.now()),
    updatedAt: Number(row.updated_at || Date.now()),
  };
}
