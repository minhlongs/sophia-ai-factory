# SOPHIA AI FACTORY — BYOK SECURITY FORENSICS AUDIT
**Document Version:** 1.0.0  
**Scope:** `src/tree/byok/`, `src/tree/credentials/`, `src/seed/crypto/`, `src/tree/ai-providers/`, `src/tree/clients/`  
**Auditor:** Supreme Codebase Forensic Auditor (Adversarial Zero-Trust)  

---

## 1. Executive Summary

The Bring-Your-Own-Key (BYOK) subsystem empowers non-technical CEOs to self-provision AI API keys (OpenRouter, ElevenLabs, D-ID, HeyGen, fal.ai, Replicate) without operator involvement.

### Security Verdict: **GREEN (Cryptographically Hardened)**

---

## 2. Cryptographic Architecture

### 2.1 Encryption Standard
- **Cipher:** Web Crypto AES-256-GCM (`AES-GCM` algorithm).
- **Blob Structure:** `[version (1 byte)][iv (12 bytes)][ciphertext + auth tag]`
- **Nonce (IV):** 12 cryptographically random bytes generated per encryption via `crypto.getRandomValues(new Uint8Array(12))`. Nonce reuse is mathematically negligible ($2^{-96}$).
- **Authentication Tag:** 16-byte authentication tag produced by GCM mode. Any tampering with the ciphertext or IV causes decryption to fail immediately.
- **AAD Binding:** When `userId` is supplied, it is passed as `additionalData`. Decryption fails if ciphertext is copied to another user account.

### 2.2 Key Hierarchy & Rotation
- **Master Key Source:** 256-bit base64-encoded string stored in Cloudflare Worker secret `BYOK_MASTER_KEY`.
- **Key Versions Table:** `key_versions` in D1 stores rotated key metadata.
- **Dual-Decrypt Window:** The system supports multi-version decryption while writing all new keys with the active key version.

### 2.3 Secret Leakage Prevention
Audited logging utilities (`src/seed/utils/logger-utility.ts`, `src/seed/utils/logger-internals.ts`) execute deep recursive PII and secret redaction:
- Scans and redacts keys matching patterns: `api_key`, `apiKey`, `secret`, `token`, `authorization`, `bearer`, `password`, `key`, `fal_key`, `openrouter_api_key`, `elevenlabs_api_key`, `heygen_api_key`.
- Inngest event payloads pass sanitized references (`missionId`, `tenantId`) and resolve keys inside isolated worker execution scopes.
- Diagnostic export bundles (`src/tree/audit/diagnostic-bundle.ts`) run `scrubPIIDeep` stripping all credentials before export.

---

## 3. Threat Model & Adversarial Verification

| Vector | Defense Mechanism | Forensic Code Reference | Verdict |
|---|---|---|---|
| **SQL Injection to Exfiltrate Plaintext** | Keys stored as encrypted binary blobs; D1 queries use parameterized binds (`?`) | `src/tree/byok/user-api-key-store.ts:45` | Immune |
| **Ciphertext Tampering / Bit-Flipping** | AES-GCM 128-bit authentication tag validation | `src/tree/byok/byok-crypto.ts:245` | Detected & Rejected |
| **Cross-User Ciphertext Replay** | Authenticated Additional Data (AAD) binds `userId` to ciphertext | `src/tree/byok/byok-crypto.ts:192` | Decryption Fails |
| **Accidental Key Logging in Sentry/Console** | Recursive sanitization in `logger-internals.ts` strips secret patterns | `src/seed/utils/logger-internals.ts:68` | Zero Secret Leakage |
| **Memory Dump of Stale Keys** | Decrypted keys live only in transient function scopes during HTTP dispatch | `src/tree/byok/byok-manager.ts` | Ephemeral |

---

## 4. Key Management Lifecycle

1. **Ingest:** Customer enters key in Setup Wizard $\rightarrow$ `setUserApiKey(userId, provider, plainKey)`.
2. **Validation:** Key format validated against provider schema before encryption.
3. **Storage:** Encrypted with active master key version and written to D1 `user_api_keys`.
4. **Invocation:** Decrypted transiently by `resolveProviderCredentials()` immediately before HTTP dispatch.
5. **Deletion:** Deletion via `deleteUserApiKey()` removes row from D1; key material is irrecoverable.
