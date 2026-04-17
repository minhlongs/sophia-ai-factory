# Phase C — D1 Encryption Helper (AES-GCM via crypto.subtle)

**Status:** deferred (next iteration) | **Priority:** P1 | **Effort:** 1d | **Depends:** Phase A

> **DEFERRED — DO NOT IMPLEMENT THIS ITERATION.**

## Goal
Edge-safe symmetric encryption for storing customer-provided tunnel bearer tokens in D1 (Phase B writes ciphertext; Phase B reads + decrypts on adapter call).

## Architecture Sketch
```
DEK (Data Encryption Key): random 32-byte key, stored as CF Worker Secret `LOCAL_MODE_DEK` (base64).
Algorithm: AES-256-GCM via globalThis.crypto.subtle (Workers spec).
Format stored in D1 (TEXT column): base64(iv12 || ciphertext || tag16)

API:
  encryptSecret(plaintext: string): Promise<string>   // returns base64 blob
  decryptSecret(blob: string): Promise<string>        // throws on tamper/wrong key
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/lib/crypto/encrypt-secret.ts` (≤90 LOC)
- `apps/sophia-ai-factory/src/lib/crypto/encrypt-secret.test.ts` (≥4 tests: roundtrip, tamper detection, wrong key, base64 format)

### Modify
- `apps/sophia-ai-factory/wrangler.toml` (or env config) — document required `LOCAL_MODE_DEK` secret

## Effort Estimate
- Implementation: 0.5d
- Tests + DEK rotation doc: 0.5d

## Open Questions
- DEK rotation strategy: dual-key window (old+new) or one-shot re-encrypt migration? (Lean: dual-key for 90 days.)
- Should we use customer-derived KEK (per-user salt) on top of DEK? (Lean: NO for MVP — DEK + per-row IV is enough.)
