/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: Action Types
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/types
 */

import type {
  SovereignZoneCode,
  KeyType,
} from '@/seed/types/sovereign-vault';

export interface SovereignVaultActionError {
  code: string;
  message: string;
}

export interface RegisterCmekActionInput {
  orgId: string;
  zoneCode: SovereignZoneCode;
  keyAlias: string;
  keyType?: KeyType;
  rawKekBase64?: string;
  rotationIntervalDays?: number;
}

export interface AuthContext {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}
