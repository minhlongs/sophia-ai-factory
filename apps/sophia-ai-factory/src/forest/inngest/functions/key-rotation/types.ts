/**
 * @file types.ts
 * @description Key rotation job event payloads and batch re-encryption DTOs
 */

export interface UserApiKeyRow {
  user_id: string;
  provider: string;
  encrypted_key: ArrayBuffer | Uint8Array;
  key_version: number | null;
}

export interface ProviderCredentialRow {
  id: string;
  user_id: string;
  provider: string;
  encrypted_value: string;
  key_version: number | null;
}

export interface PlatformCredentialRow {
  id: string;
  user_id: string;
  platform: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  key_version: number | null;
}

export interface RotationPayloadData {
  keyVersion: number;
  oldVersion: number;
  reason?: string;
}

export interface ReencryptSummary {
  keyVersion: number;
  oldVersion: number;
  userApiKeys: number;
  providerCredentials: number;
  platformCredentials: number;
  total: number;
}
