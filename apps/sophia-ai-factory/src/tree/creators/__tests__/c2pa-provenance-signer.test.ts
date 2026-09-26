import { describe, it, expect, vi } from 'vitest';
import {
  canonicalJson,
  sha256Hex,
  hmacSha256Hex,
  timingSafeEqualHex,
  createC2paClaim,
  verifyC2paManifestInMemory,
  signC2paManifest,
  verifyC2paManifest,
  getManifestByAssetId,
} from '../c2pa-provenance-signer';
import type { C2paProvenanceManifestRecord } from '@/seed/types/creator-dao-c2pa';
import type { D1Database } from '@/seed/db/client';

describe('C2PA Provenance Signer - Deterministic Canonical JSON', () => {
  it('sorts object keys alphabetically regardless of insertion order', () => {
    const objA = { z: 1, a: 2, m: { y: 3, x: 4 } };
    const objB = { a: 2, m: { x: 4, y: 3 }, z: 1 };

    expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    expect(canonicalJson(objA)).toBe('{"a":2,"m":{"x":4,"y":3},"z":1}');
  });

  it('handles primitive values, arrays, and null correctly', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(123)).toBe('123');
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson([3, 2, 1])).toBe('[3,2,1]');
    expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it('omits undefined object properties', () => {
    const obj = { a: 1, b: undefined, c: 3 };
    expect(canonicalJson(obj)).toBe('{"a":1,"c":3}');
  });
});

describe('C2PA Provenance Signer - SHA-256 and HMAC-SHA256 Web Crypto', () => {
  it('computes accurate SHA-256 digest matching standard test vectors', async () => {
    // Standard test vector: SHA-256 of empty string
    const emptySha = await sha256Hex('');
    expect(emptySha).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // SHA-256 of "hello world"
    const helloSha = await sha256Hex('hello world');
    expect(helloSha).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('supports string, Uint8Array, and ArrayBuffer inputs', async () => {
    const str = 'sophia c2pa';
    const uint8 = new TextEncoder().encode(str);
    const arrayBuf = uint8.buffer;

    const hashStr = await sha256Hex(str);
    const hashUint8 = await sha256Hex(uint8);
    const hashArrayBuf = await sha256Hex(arrayBuf);

    expect(hashStr).toBe(hashUint8);
    expect(hashStr).toBe(hashArrayBuf);
    expect(hashStr).toHaveLength(64);
  });

  it('generates HMAC-SHA256 digital signature and checks timingSafeEqual', async () => {
    const secret = 'super_secret_test_key_2027';
    const message = 'manifest_claim_data_hash';

    const sigA = await hmacSha256Hex(message, secret);
    const sigB = await hmacSha256Hex(message, secret);
    const sigDiff = await hmacSha256Hex('tampered_message', secret);

    expect(sigA).toBe(sigB);
    expect(sigA).toHaveLength(64);
    expect(timingSafeEqualHex(sigA, sigB)).toBe(true);
    expect(timingSafeEqualHex(sigA, sigDiff)).toBe(false);
    expect(timingSafeEqualHex(sigA, sigA.slice(0, -1) + '0')).toBe(false);
  });
});

describe('C2PA Provenance Signer - Claim Construction', () => {
  it('constructs a valid C2PA claim containing standard assertions', () => {
    const assetSha = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
    const claim = createC2paClaim(
      {
        assetId: 'video_asset_001',
        assetBytesOrSha256: assetSha,
        title: 'Sophia AI Generated Reel',
        creatorId: 'creator_456',
        licensingContractId: 'contract_789',
        dubbingDetails: {
          sourceLang: 'vi',
          targetLang: 'en',
          voiceModel: 'Sophia-Voice-HD',
        },
      },
      assetSha,
    );

    expect(claim.title).toBe('Sophia AI Generated Reel');
    expect(claim.format).toBe('video/mp4');
    expect(claim.signatureAlgorithm).toBe('HMAC-SHA256');

    const labels = claim.assertions.map((a) => a.label);
    expect(labels).toContain('c2pa.actions');
    expect(labels).toContain('c2pa.ai_generation');
    expect(labels).toContain('c2pa.hash.data');
    expect(labels).toContain('c2pa.author');
    expect(labels).toContain('c2pa.dubbed');
  });
});

describe('C2PA Provenance Signer - 1-Byte Tamper Detection Verification', () => {
  async function generateGoldenManifest(): Promise<{
    manifest: C2paProvenanceManifestRecord;
    secret: string;
    assetSha: string;
  }> {
    const secret = 'c2pa_verification_test_secret_key_2027';
    const assetSha = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

    const claim = createC2paClaim(
      {
        assetId: 'asset_golden_001',
        assetBytesOrSha256: assetSha,
        title: 'Golden Video Master',
        creatorId: 'creator_alice',
        licensingContractId: 'contract_guild_80_20',
      },
      assetSha,
    );

    const claimCanonicalJson = canonicalJson(claim);
    const manifestHash = await sha256Hex(claimCanonicalJson);
    const digitalSignature = await hmacSha256Hex(manifestHash, secret);

    const manifest: C2paProvenanceManifestRecord = {
      id: 'manifest_rec_001',
      manifestId: claim.instanceId,
      assetId: 'asset_golden_001',
      assetSha256: assetSha,
      claimGenerator: 'Sophia-AI-Factory/1.0.0 (C2PA-Edge/2027)',
      title: 'Golden Video Master',
      format: 'video/mp4',
      claimCanonicalJson,
      manifestHash,
      signerIdentity: 'SOPHIA_C2PA_ROOT_AUTHORITY_2027',
      signatureAlgorithm: 'HMAC-SHA256',
      digitalSignature,
      assertionsJson: JSON.stringify(claim.assertions),
      ingredientsJson: '[]',
      tamperStatus: 'valid',
      verifiedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return { manifest, secret, assetSha };
  }

  it('passes verification with 100% integrity on untouched golden manifest', async () => {
    const { manifest, secret, assetSha } = await generateGoldenManifest();
    const result = await verifyC2paManifestInMemory(manifest, assetSha, secret);

    expect(result.isValid).toBe(true);
    expect(result.tamperDetected).toBe(false);
    expect(result.signatureValid).toBe(true);
    expect(result.hashChainValid).toBe(true);
    expect(result.tamperReason).toBeUndefined();
  });

  it('detects 1-byte tamper in asset SHA-256 (e.g. video bit flip or face-swap)', async () => {
    const { manifest, secret, assetSha } = await generateGoldenManifest();

    // Flip first character of asset SHA (b -> c)
    const tamperedAssetSha = (assetSha[0] === 'b' ? 'c' : 'b') + assetSha.slice(1);
    const result = await verifyC2paManifestInMemory(manifest, tamperedAssetSha, secret);

    expect(result.isValid).toBe(false);
    expect(result.tamperDetected).toBe(true);
    expect(result.tamperReason).toBe('ASSET_SHA256_MISMATCH');
  });

  it('detects 1-byte tamper in claim canonical JSON payload', async () => {
    const { manifest, secret, assetSha } = await generateGoldenManifest();

    // Mutate 1 character in the JSON string (replace an 'a' with 'z')
    const tamperedJson = manifest.claimCanonicalJson.replace('creator_alice', 'creator_alicz');
    const tamperedManifest = { ...manifest, claimCanonicalJson: tamperedJson };

    const result = await verifyC2paManifestInMemory(tamperedManifest, assetSha, secret);

    expect(result.isValid).toBe(false);
    expect(result.tamperDetected).toBe(true);
    expect(result.tamperReason).toBe('MANIFEST_HASH_TAMPERED');
  });

  it('detects 1-byte tamper in manifest hash', async () => {
    const { manifest, secret, assetSha } = await generateGoldenManifest();

    // Flip 1 character in manifestHash
    const tamperedHash = manifest.manifestHash.slice(0, 10) + 'f' + manifest.manifestHash.slice(11);
    const tamperedManifest = { ...manifest, manifestHash: tamperedHash };

    const result = await verifyC2paManifestInMemory(tamperedManifest, assetSha, secret);

    expect(result.isValid).toBe(false);
    expect(result.tamperDetected).toBe(true);
    expect(result.tamperReason).toBe('MANIFEST_HASH_TAMPERED');
  });

  it('detects 1-byte tamper in digital signature', async () => {
    const { manifest, secret, assetSha } = await generateGoldenManifest();

    // Flip last character of digital signature
    const lastChar = manifest.digitalSignature.slice(-1);
    const flippedChar = lastChar === '0' ? '1' : '0';
    const tamperedSig = manifest.digitalSignature.slice(0, -1) + flippedChar;
    const tamperedManifest = { ...manifest, digitalSignature: tamperedSig };

    const result = await verifyC2paManifestInMemory(tamperedManifest, assetSha, secret);

    expect(result.isValid).toBe(false);
    expect(result.tamperDetected).toBe(true);
    expect(result.tamperReason).toBe('SIGNATURE_INVALID');
  });

  it('fuzzes 50 random single-character signature mutations with 100% detection rate', async () => {
    const { manifest, secret, assetSha } = await generateGoldenManifest();

    for (let i = 0; i < 50; i++) {
      const idx = Math.floor(Math.random() * manifest.digitalSignature.length);
      const originalChar = manifest.digitalSignature[idx];
      const replacementChar = originalChar === 'a' ? 'b' : 'a';
      const mutatedSig =
        manifest.digitalSignature.slice(0, idx) +
        replacementChar +
        manifest.digitalSignature.slice(idx + 1);

      const tamperedManifest = { ...manifest, digitalSignature: mutatedSig };
      const result = await verifyC2paManifestInMemory(tamperedManifest, assetSha, secret);

      expect(result.isValid).toBe(false);
      expect(result.tamperDetected).toBe(true);
      expect(result.signatureValid).toBe(false);
    }
  });
});

describe('C2PA Provenance Signer - Database Mock Integration', () => {
  function createMockD1(): D1Database {
    const rows: Record<string, unknown>[] = [];

    return {
      prepare: vi.fn((query: string) => {
        let boundValues: unknown[] = [];
        return {
          bind: vi.fn((...args: unknown[]) => {
            boundValues = args;
            return {
              first: vi.fn(async () => {
                if (query.includes('FROM c2pa_provenance_manifests WHERE manifest_id = ?')) {
                  const mId = boundValues[0];
                  return rows.find((r) => r.manifest_id === mId) ?? null;
                }
                if (query.includes('FROM c2pa_provenance_manifests WHERE asset_id = ?')) {
                  const aId = boundValues[0];
                  return rows.find((r) => r.asset_id === aId) ?? null;
                }
                return rows[0] ?? null;
              }),
              all: vi.fn(async () => ({ results: rows })),
              run: vi.fn(async () => {
                if (query.startsWith('INSERT INTO c2pa_provenance_manifests')) {
                  rows.push({
                    id: boundValues[0],
                    manifest_id: boundValues[1],
                    asset_id: boundValues[2],
                    asset_sha256: boundValues[3],
                    claim_generator: boundValues[4],
                    title: boundValues[5],
                    format: boundValues[6],
                    claim_canonical_json: boundValues[7],
                    manifest_hash: boundValues[8],
                    signer_identity: boundValues[9],
                    signature_algorithm: boundValues[10],
                    digital_signature: boundValues[11],
                    assertions_json: boundValues[12],
                    ingredients_json: boundValues[13],
                    tamper_status: 'valid',
                    verified_at: boundValues[14],
                    created_at: boundValues[15],
                    updated_at: boundValues[16],
                  });
                } else if (query.startsWith('UPDATE c2pa_provenance_manifests SET tamper_status = ?')) {
                  const targetId = boundValues[3];
                  const existing = rows.find((r) => r.id === targetId);
                  if (existing) {
                    existing.tamper_status = boundValues[0];
                    existing.verified_at = boundValues[1];
                    existing.updated_at = boundValues[2];
                  }
                }
                return { success: true };
              }),
            };
          }),
        };
      }),
    } as unknown as D1Database;
  }

  it('signs and stores manifest in D1, then verifies successfully', async () => {
    const mockDb = createMockD1();
    const assetSha = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

    const manifest = await signC2paManifest(mockDb, {
      assetId: 'asset_integration_001',
      assetBytesOrSha256: assetSha,
      title: 'Integration Test Asset',
      creatorId: 'creator_456',
    });

    expect(manifest.manifestId).toContain('urn:c2pa:sophia:manifest:');
    expect(manifest.tamperStatus).toBe('valid');

    // Retrieve by asset ID
    const retrieved = await getManifestByAssetId(mockDb, 'asset_integration_001');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.assetSha256).toBe(assetSha);

    // Verify against DB
    const verifyResult = await verifyC2paManifest(mockDb, manifest.manifestId, assetSha);
    expect(verifyResult.isValid).toBe(true);
    expect(verifyResult.tamperDetected).toBe(false);
  });

  it('detects tampering and updates tamper_status to tampered in D1', async () => {
    const mockDb = createMockD1();
    const assetSha = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

    const manifest = await signC2paManifest(mockDb, {
      assetId: 'asset_tamper_db_002',
      assetBytesOrSha256: assetSha,
      title: 'Tamper DB Asset',
      creatorId: 'creator_789',
    });

    // Verify with corrupted asset bytes
    const tamperedBytes = new TextEncoder().encode('corrupted video bytes');
    const verifyResult = await verifyC2paManifest(mockDb, manifest.manifestId, tamperedBytes);

    expect(verifyResult.isValid).toBe(false);
    expect(verifyResult.tamperDetected).toBe(true);
    expect(verifyResult.tamperReason).toBe('ASSET_SHA256_MISMATCH');

    // Verify status was updated in D1
    const updated = await getManifestByAssetId(mockDb, 'asset_tamper_db_002');
    expect(updated?.tamperStatus).toBe('tampered');
  });
});
