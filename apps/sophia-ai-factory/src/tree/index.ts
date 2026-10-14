/**
 * @module tree
 * Layer barrel re-exports — all subdirectory barrels.
 * Import direction: land → forest → tree → seed (ONE-WAY)
 */
export * from './admin';
export * from './audit';
export * from './budget';
export * from './byok';
export * from './clients';
export * from './compliance';
export * from './credentials';
export * from './crypto';
export * from './discovery';
export * from './gateway';
export * from './handover';
export * from './memory';
export * from './sop';
export * from './telegram';

export * from './autonomy';
export * from './rollback';

// Disambiguate crypto primitives exported by both byok and credentials
export {
  ALGORITHM,
  IV_BYTES,
  KEY_LEN_BITS,
  KEY_LEN_BYTES,
  base64ToBytes,
  bytesToBase64,
  importKeyByVersion,
  importKeyMaterial,
  importMasterKey,
  loadKeyVersion,
  type KeyVersionRow,
} from './byok';
