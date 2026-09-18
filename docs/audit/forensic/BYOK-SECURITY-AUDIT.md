# BYOK (BRING YOUR OWN KEY) SECURITY & CRYPTOGRAPHIC FORENSIC AUDIT

**Target:** Sophia AI Factory BYOK & Credential Subsystem  
**Audit Standard:** Code is the authority. Tests are evidence.  
**Audit Date:** 2026-09-18  

---

## 1. Executive Summary

| Component | Verdict | Specification |
|---|:---:|---|
| **Cipher Algorithm** | **GREEN** | AES-256-GCM (`Web Crypto API`) |
| **IV / Nonce Entropy** | **GREEN** | 12-byte CSPRNG (`crypto.getRandomValues(new Uint8Array(12))`) |
| **AAD Binding** | **GREEN** | `additionalData = TextEncoder.encode(userId)` prevents tenant swap |
| **Key Source** | **GREEN** | `CREDENTIALS_MASTER_KEY` (32 bytes = 64 hex chars) |
| **Key Rotation** | **GREEN** | Dual-key decrypt window with `CREDENTIALS_MASTER_KEY_PREV` |
| **Secret Sanitization** | **GREEN** | Zero plaintext keys in client responses, logs, or diagnostics |
| **Stray Artifact Cleanup** | **GREEN** | Stale `.new` files in `src/` eliminated |

---

## 2. Cryptographic Architecture Forensic Review

### 2.1 Encryption Implementation (`src/tree/credentials/encryption.ts`)
- **Key Derivation:** Master key is passed as 64 hex characters via Worker secrets. Converted to raw 32 bytes and imported via:
  ```typescript
  crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  ```
- **Nonce / IV Generation:** Fresh 12-byte IV generated for every encryption operation using `crypto.getRandomValues()`. Nonce reuse probability across $2^{32}$ operations is mathematically negligible under GCM requirements.
- **Ciphertext Format:** Stored as `v<version>:<base64(iv)>:<base64(ciphertext+tag)>`.
- **Integrity Tag:** 128-bit authentication tag appended to ciphertext and automatically validated by `crypto.subtle.decrypt`. Any single-bit tampering or corruption throws a decryption error.

### 2.2 AAD (Additional Authenticated Data) Tenant Binding
- In `encryptValue(plaintext, userId)`:
  The `userId` is passed as `additionalData`.
  The authentication tag is computed over both the ciphertext and the `userId`.
  If an adversary attempts to copy an encrypted key from Tenant B's database row into Tenant A's row, Tenant A cannot decrypt it because the authenticated `userId` will not match, causing Web Crypto to reject it immediately.

---

## 3. Secret Leakage Surface Audit

| Surface | Audit Method | Findings & Safeguards |
|---|---|---|
| **Logging (`logger-utility.ts`)** | Code inspection & regex check | Secrets are stripped before serialization. Object keys like `key`, `apiKey`, `secret`, `password` are masked. |
| **Error Exceptions** | `toError()` & `getErrorMessage()` | Network exceptions from AI providers (OpenRouter, Anthropic) do not reflect request authorization headers into error messages. |
| **Diagnostic Bundles** | `safe-bundle-generator.ts` | Tested via `adversarial-forensic.test.ts`. Regex sweeps strip all `sk-*`, `fal_*`, `r8_*`, `Bearer ...` tokens to `[REDACTED]`. |
| **Client UI Responses** | `/api/user/byok` (GET) | Returns `{ providers: string[] }` (e.g. `['openrouter', 'anthropic']`). Never returns encrypted or decrypted key strings. |
| **Setup Wizard State** | `use-setup-wizard.ts` | After saving credentials, client state immediately wipes raw keys from memory: `setConfig({ OPENROUTER_API_KEY: '', ... })`. |
| **Inngest Payloads** | `agent-mission-executor.ts` | Event `agent.mission.started` passes `{ runId, agentId, missionId, workspaceId }`. Plaintext keys are NEVER included in Inngest event payloads; they are resolved and decrypted just-in-time in Worker memory. |

---

## 4. Stale File Audit & Remediation

Four orphaned `.new` duplicate files dating from August 2 were discovered in `src/`:
1. `src/land/query-client.ts.new`
2. `src/tree/byok/key-format-validators.ts.new`
3. `src/tree/apollo/apollo-client.ts.new`
4. `src/seed/utils/index.ts.new`

All 4 files have been removed from the repository. No other `.bak`, `.tmp`, or uncommitted migration scripts remain.
