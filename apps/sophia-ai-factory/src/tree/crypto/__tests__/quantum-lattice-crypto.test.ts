import { describe, it, expect } from 'vitest';
import {
  deriveQuantumKeyPair,
  encapsulateLatticeSecret,
  signWithMlDsa,
  verifyMlDsaSignature,
} from '../quantum-lattice-crypto';

describe('Quantum Lattice Cryptography Unit Tests', () => {
  const agentDid = 'did:sophia:quantum:agent-100k';

  it('derives deterministic ML-KEM-1024 quantum key pair', () => {
    const keyPair1 = deriveQuantumKeyPair(agentDid, 'ML_KEM_1024');
    const keyPair2 = deriveQuantumKeyPair(agentDid, 'ML_KEM_1024');

    expect(keyPair1.publicKeyHex).toBe(keyPair2.publicKeyHex);
    expect(keyPair1.privateKeySeedHex).toBe(keyPair2.privateKeySeedHex);
    expect(keyPair1.publicKeyHex.startsWith('pk_ml_ml_kem_1024_')).toBe(true);
    expect(keyPair1.securityCategory).toBe(5);
  });

  it('encapsulates shared secret using ML-KEM-1024', () => {
    const keyPair = deriveQuantumKeyPair(agentDid, 'ML_KEM_1024');
    const nonce = '0x1234567890abcdef';

    const enc1 = encapsulateLatticeSecret(keyPair.publicKeyHex, nonce);
    const enc2 = encapsulateLatticeSecret(keyPair.publicKeyHex, nonce);

    expect(enc1.sharedSecretHashHex).toBe(enc2.sharedSecretHashHex);
    expect(enc1.sharedSecretHashHex.startsWith('ml_secret_')).toBe(true);
    expect(enc1.ciphertextHex.startsWith('ct_ml_kem_1024_')).toBe(true);
  });

  it('signs and verifies message with ML-DSA-87', () => {
    const keyPair = deriveQuantumKeyPair(agentDid, 'ML_DSA_87');
    const message = 'SETTLE_TRANSACTION_BATCH_999';

    const signature = signWithMlDsa(message, keyPair.privateKeySeedHex);
    expect(signature.startsWith('sig_mldsa87_')).toBe(true);

    const isValid = verifyMlDsaSignature(message, signature, keyPair.publicKeyHex);
    expect(isValid).toBe(true);

    const isTampered = verifyMlDsaSignature('TAMPERED_MESSAGE', signature, keyPair.publicKeyHex);
    expect(isTampered).toBe(false);
  });

  it('rejects invalid key formats', () => {
    expect(() => deriveQuantumKeyPair('invalid-did', 'ML_KEM_1024')).toThrow();
    expect(() => encapsulateLatticeSecret('invalid_key', '0x123')).toThrow();
    expect(() => signWithMlDsa('msg', 'invalid_sk')).toThrow();
  });
});
