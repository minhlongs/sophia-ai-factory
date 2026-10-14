/**
 * C2PA Content Provenance Types
 * Layer: seed
 */

import type { C2paTamperStatus } from './constants';

export interface C2paAssertion {
  label: string;
  data: Record<string, unknown>;
}

export interface C2paIngredient {
  title: string;
  format: string;
  documentId: string;
  relationship: 'parentOf' | 'componentOf' | 'inputTo';
  hash: string; // SHA-256
}

export interface C2paClaim {
  claimGenerator: string;
  title: string;
  format: string;
  instanceId: string; // URN
  assertions: C2paAssertion[];
  ingredients: C2paIngredient[];
  signatureAlgorithm: 'HMAC-SHA256' | 'Ed25519' | 'ES256';
}

export interface C2paProvenanceManifestRecord {
  id: string;
  manifestId: string;
  assetId: string;
  assetSha256: string;
  claimGenerator: string;
  title: string;
  format: string;
  claimCanonicalJson: string;
  manifestHash: string;
  signerIdentity: string;
  signatureAlgorithm: string;
  digitalSignature: string;
  assertionsJson: string;
  ingredientsJson: string;
  tamperStatus: C2paTamperStatus;
  verifiedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateC2paManifestInput {
  assetId: string;
  assetBytesOrSha256: string | Uint8Array | ArrayBuffer;
  title: string;
  format?: string;
  creatorId: string;
  licensingContractId?: string;
  daoId?: string;
  aiModelsUsed?: Array<{ name: string; version: string; role: string; promptHash?: string }>;
  dubbingDetails?: { sourceLang: string; targetLang: string; voiceModel: string };
  ingredients?: C2paIngredient[];
  customAssertions?: C2paAssertion[];
  signingSecret?: string;
}

export interface C2paVerificationResult {
  isValid: boolean;
  tamperDetected: boolean;
  tamperReason?:
    | 'ASSET_SHA256_MISMATCH'
    | 'SIGNATURE_INVALID'
    | 'MANIFEST_HASH_TAMPERED'
    | 'RECORD_NOT_FOUND';
  manifestId: string;
  assetId: string;
  storedAssetSha256: string;
  computedAssetSha256?: string;
  signatureValid: boolean;
  hashChainValid: boolean;
  verifiedAt: number;
}
