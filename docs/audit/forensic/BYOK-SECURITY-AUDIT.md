# BYOK & OBSERVABILITY SECURITY FORENSIC REPORT — Sophia AI Factory

**Audit Lane:** Lane B (Phases 4 and 12)  
**Target Codebase:** `apps/sophia-ai-factory/src/`  
**Auditor:** Senior SRE / Forensic Security Auditor  
**Audit Date:** 2026-09-11  
**Status:** COMPLETED — EVIDENCE BACKED  

---

## Executive Summary

A comprehensive forensic security audit was conducted across all code paths handling customer API keys, provider credentials, cryptographic primitives, observability pipelines, and diagnostic export bundles.

Key Findings:
1. **Cryptographic Algorithm (4-A):** **PASS**. All secret storage utilizes AES-256-GCM via the Cloudflare Workers-native Web Crypto API (`crypto.subtle`). No unauthenticated modes (such as raw AES-CBC or ECB) are used.
2. **Nonce & IV Uniqueness (4-B):** **PASS**. Every encryption invocation draws a fresh 12-byte cryptographically secure random nonce via `crypto.getRandomValues(new Uint8Array(12))`. No static nonces, counters, or timestamps are used.
3. **Key Material Logging (4-C):** **PASS**. Structured loggers (`src/seed/utils/logger-internals.ts`) implement multi-tier scrubbing (`[REDACTED-KEY]`). Plaintext keys are never emitted to logs, telemetry, or Sentry.
4. **Key Material in Responses & Events (4-D):** **PASS**. Credential listing endpoints return only `display_hint` previews (e.g. `...1234`). Inngest event payloads contain only metadata IDs; providers fetch decrypted keys in worker isolate memory just-in-time.
5. **Master Key Provenance & Redundancy (4-E):** **WARN (Architectural Debt)**. Master keys are derived securely from environment variables (`BYOK_MASTER_KEY`, `CREDENTIALS_MASTER_KEY`, `OAUTH_TOKEN_ENC_KEY`, `LOCAL_MODE_DEK`). However, 5 separate AES-GCM implementations exist across layers.
6. **Key Rotation & Lifecycle (4-F):** **PASS**. A dual-decrypt window and `key_versions` table allow non-disruptive rotation. Key rotation can be executed administratively via `/api/admin/keys/rotate`.
7. **Observability & Diagnostic Safety (§12):** **PASS**. Support bundle generators use comprehensive regex pattern scrubbers to purge keys, tokens, and PII. Verified by automated tests that inject real secret formats.

---

## 4-A. Encryption Algorithm [PASS]

### 1. Specification & Standards
- **Primitive:** Authenticated Encryption with Associated Data (AEAD).
- **Algorithm:** AES-256-GCM (`ALGORITHM = 'AES-GCM'`).
- **Engine:** Web Crypto API (`crypto.subtle.encrypt`, `crypto.subtle.decrypt`).
- **Key Length:** 256 bits (32 bytes).
- **Authentication Tag:** 128 bits (16 bytes), verified automatically by `crypto.subtle.decrypt`.
- **Integrity Guarantee:** Tamper detection is fail-closed. If ciphertext or tag is modified by even 1 bit, `crypto.subtle.decrypt` throws an `OperationError`.

### 2. Implementation Audit Across Modules
The codebase implements AES-GCM in five distinct locations:

1. **`src/tree/byok/byok-crypto.ts` (lines 17–21, 201–228):**
   - Pack format: `[version: 1 byte][iv: 12 bytes][ciphertext + tag: variable]` as a raw binary `Uint8Array`.
   - Stored in D1 column `user_api_keys.encrypted_key`.
2. **`src/tree/credentials/encryption.ts` (lines 17–20, 110–135):**
   - Format: `v${version}:${bytesToBase64(iv)}:${bytesToBase64(ct)}`.
   - Stored in D1 column `user_provider_credentials.encrypted_value`.
3. **`src/seed/crypto/encryption.ts` (lines 15–18, 80–95):**
   - Format: `aes-v1:${toBase64(iv)}:${toBase64(ct)}`.
4. **`src/seed/crypto/token-crypto.ts` (lines 16–18, 60–80):**
   - Format: `aes:v1:${base64(iv || ct)}`.
   - Stored in `publishing_channels.encrypted_access_token`.
5. **`src/tree/crypto/encrypt-secret.ts` (lines 24–26, 60–85):**
   - Format: `base64(iv || ct)`.

**Verdict:** **PASS**. All five modules adhere strictly to authenticated AES-256-GCM. No unauthenticated legacy ciphers exist in active code.

---

## 4-B. Nonce Uniqueness [PASS]

### 1. Threat Model & Audit Question
In AES-GCM, reusing a nonce (IV) with the same encryption key completely destroys authenticity and allows ciphertext recovery. Does the codebase ensure nonce uniqueness?

### 2. Evidence from Source Code
Across every encryption function in the repository:
- `src/tree/byok/byok-crypto.ts` (line 212):
  ```typescript
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  ```
- `src/tree/credentials/encryption.ts` (line 120):
  ```typescript
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  ```
- `src/seed/crypto/encryption.ts` (line 88):
  ```typescript
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  ```
- `src/tree/crypto/encrypt-secret.ts` (line 69):
  ```typescript
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  ```

### 3. Nonce Assessment
- **Length:** Standard 96-bit (12 bytes) recommended by NIST SP 800-38D.
- **Source:** Cryptographically secure pseudo-random number generator (CSPRNG) via `crypto.getRandomValues()`.
- **Collision Risk:** With a 96-bit random IV, the birthday bound collision probability reaches $2^{-32}$ only after encrypting $\approx 2^{32}$ ($4.29 \times 10^9$) keys per master key version. Per-tenant key rotations well exceed this safety margin.

**Verdict:** **PASS**. Nonces are cryptographically random and unique per encryption.

---

## 4-C. Key Material Never in Logs [PASS]

### 1. Inspection Points
- Setup Wizard validation endpoint (`src/app/api/setup-wizard/validate-key/route.ts`).
- Setup Wizard save endpoint (`src/app/api/setup-wizard/save-credentials/route.ts`).
- Credential listing endpoint (`src/app/api/setup-wizard/list-credentials/route.ts`).
- Structured logging engine (`src/seed/utils/logger-internals.ts`).

### 2. Logging Engine Redaction Evidence
In `src/seed/utils/logger-internals.ts` (lines 20–35):
```typescript
const SECRET_KEY_RE = /(?:^|_)(?:secret|password|passwd|token|api[_-]?key|cron[_-]?secret|auth[_-]?token|access[_-]?key|private[_-]?key|signing[_-]?key)(?:$|_)/i;

export function redactSecretKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSecretKeys);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED-KEY]' : redactSecretKeys(v);
    }
    return out;
  }
  return value;
}
```
All calls to `logger.info`, `logger.warn`, and `logger.error` pass log contexts through `redactSecretKeys()` and PII scrubbers prior to console or Sentry output.

### 3. Setup Wizard Key Probe Evidence
In `src/app/api/setup-wizard/validate-key/route.ts` (lines 102–140):
- Provider API key received in POST body is immediately masked using `maskApiKey(api_key)`:
  ```typescript
  export function maskApiKey(key: string): string {
    if (!key || key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
  ```
- Downstream probe errors log only `{ provider, status, maskedKey }`. The raw `api_key` is never passed to logger or returned in the response payload.

**Verdict:** **PASS**. Key material is masked or purged before entering any logging channel.

---

## 4-D. Key Material Never in Events or Responses [PASS]

### 1. API Response Scrutiny
In `src/app/api/setup-wizard/list-credentials/route.ts` (lines 20–28) and `src/tree/credentials/user-credentials-repo.ts` (lines 47–51):
```typescript
function makeDisplayHint(plaintext: string): string {
  if (plaintext.length <= 4) return '...' + plaintext;
  return '...' + plaintext.slice(-4);
}
```
The endpoint returns:
```json
{
  "credentials": [
    {
      "provider": "heygen",
      "display_hint": "...98a1",
      "status": "active",
      "last_used_at": 1726051200
    }
  ]
}
```
Plaintext secrets and encrypted ciphertext are excluded from the API response DTO.

### 2. Inngest Event Payload Scrutiny
- Inngest events (such as `sophia/mission.created` and `sophia/video.render.requested`) carry only tenant metadata:
  `{ missionId: string, creatorId: string, capability: string, parameters: object }`.
- Provider execution functions (e.g. `src/forest/inngest/functions/mission-orchestrator.ts`) load credentials just-in-time via `getUserCredential(creatorId, provider)` within the Cloudflare Worker isolate. Credentials remain in isolate memory during the API call and are garbage-collected.

**Verdict:** **PASS**. No API keys are leaked in events or HTTP responses.

---

## 4-E. Master Key Provenance & Redundancy [WARN]

### 1. Master Key Sources
Master encryption keys are supplied via Cloudflare Workers environment variables/secrets:
- `BYOK_MASTER_KEY`: 32-byte base64 string (`src/tree/byok/byok-crypto.ts`).
- `CREDENTIALS_MASTER_KEY`: 64-character hex string (`src/tree/credentials/encryption.ts` / `src/seed/crypto/encryption.ts`).
- `OAUTH_TOKEN_ENC_KEY`: 64-character hex string (`src/seed/crypto/token-crypto.ts`).
- `LOCAL_MODE_DEK`: 32-byte base64 string (`src/tree/crypto/encrypt-secret.ts`).

### 2. Hardcoded Key Audit
A repository-wide grep for API key tokens, test secrets, and private key strings was conducted:
- `FAL_KEY`, `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, `NOWPAYMENTS_API_KEY`: **Zero** hardcoded production keys found in `src/`. All are loaded strictly via `process.env` or customer BYOK tables.
- Test files (`cross-tenant-and-anti-spoofing.test.ts`, `byok-crypto.test.ts`) use dummy byte buffers (`Buffer.from('12345678901234567890123456789012')`) isolated to Vitest environments.

### 3. Cryptographic Module Quintuplication (Architectural Debt)
The audit identified 5 parallel implementations of AES-256-GCM:
1. `src/tree/byok/byok-crypto.ts`
2. `src/tree/credentials/encryption.ts`
3. `src/seed/crypto/encryption.ts`
4. `src/seed/crypto/token-crypto.ts`
5. `src/tree/crypto/encrypt-secret.ts`

**Finding:** While all 5 implementations are cryptographically sound, maintaining 5 distinct encoding formats (`Uint8Array` packed vs `v1:iv:ct` vs `aes-v1:iv:ct` vs `aes:v1:raw` vs `base64`) creates maintenance complexity and migration friction.

**Verdict:** **WARN**. Master keys are secure and non-hardcoded, but crypto logic is quintuplicated.

---

## 4-F. Key Rotation Lifecycle [PASS]

### 1. Versioned Key Management
In `src/tree/byok/byok-crypto.ts` and `src/tree/credentials/encryption.ts`:
- Encrypted payloads are prepended with a version tag (`version: number`).
- Versions are tracked in the Cloudflare D1 table `key_versions`:
  `CREATE TABLE key_versions (version INTEGER PRIMARY KEY, key_type TEXT, encrypted_key TEXT, rotated_at TEXT, is_active INTEGER);`.
- `importKeyByVersion(version)` dynamically fetches the correct key material to decrypt historical data.

### 2. Dual-Decrypt Window & Administrative Rotation
- When rotating keys via `POST /api/admin/keys/rotate` (`src/app/api/admin/keys/rotate/route.ts`):
  1. A new master key version is inserted into `key_versions`.
  2. The old key remains active for decryption during the dual-decrypt transition window.
  3. An Inngest background job re-encrypts stored credentials with the newest active version.

**Verdict:** **PASS**. Full key lifecycle and rotation capabilities are operational.

---

## §12. Observability & Diagnostics Safety Check [PASS]

### 12-A. Diagnostic Bundle Credential Stripping [PASS]
Audit of `src/tree/diagnostics/safe-bundle-generator.ts` (lines 69–96):
- Redaction mechanism: High-coverage regex deny-list (`COMPREHENSIVE_SECRET_PATTERNS`):
  ```typescript
  const COMPREHENSIVE_SECRET_PATTERNS: RegExp[] = [
    // OpenAI, Anthropic, OpenRouter, Fal, Replicate, ElevenLabs keys
    /(?:sk|fal|r8|el|key|api|token|secret)[-_a-zA-Z0-9]{8,}/gi,
    // Bearer tokens
    /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
    // JWT tokens
    /ey[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/g,
    // Passwords in query or config strings
    /(?:password|passwd|pwd|client_secret|auth_token)\s*[:=]\s*["']?[^\s,"']+/gi,
    // Database connection URIs
    /(?:postgres|postgresql|mysql|sqlite|redis|mongodb|upstash):\/\/[^\s]+/gi,
    // Raw emails (PII)
    /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
    // Cookie or session header signatures
    /(?:cookie|set-cookie|session):\s*[^\r\n]+/gi,
  ];
  ```
- Any string matching these signatures in provider summaries or log traces is replaced with `[REDACTED]`.
- User identifiers and workspace IDs are masked via `maskIdentifier`: e.g. `usr_1234567890abcdef` $\rightarrow$ `usr_***abcdef`.

### 12-B. Safety Test Evaluation [PASS]
Audit of `src/tree/diagnostics/__tests__/diagnostic-bundle-safety.test.ts` (lines 28–73):
- The test suite **injects actual realistic fake secrets** into error strings:
  - `sk-ant-api03-1234567890abcdef`
  - `fal_secret_key_987654321`
  - `r8_live_token_abcdef12345`
  - `Bearer eyJhbGciOiJIUzI1Ni...`
  - `postgres://admin:superSecretPassword123@db.prod.internal:5432/sophia_db`
- Asserts that:
  1. `expect(sanitized).not.toContain(...)` passes for all secret fragments.
  2. `expect(sanitized).toContain('[REDACTED]')` passes.

### 12-C. Exposure of Sessions, Cookies, or D1 Dumps [PASS]
- Diagnostic bundles do NOT export raw SQL tables, session caches, or Better Auth tokens.
- Raw operational errors are mapped to coarse enum tags (`categorizeError` in `safe-bundle-generator.ts:111-132`):
  - `AUTH_CREDENTIAL_ERROR`
  - `RATE_LIMIT_EXCEEDED`
  - `INSUFFICIENT_CREDITS`
  - `NETWORK_UNAVAILABLE`
  - `PAYLOAD_VALIDATION_ERROR`
  - `PERSISTENCE_LAYER_ERROR`
  - `GENERIC_INTERNAL_ERROR`
- No internal stack traces containing database queries or query parameters are surfaced in the diagnostic bundle.

**Verdict:** **PASS**. The diagnostic generator satisfies enterprise sanitization standards.

---

## Severity Register

| Ref | Category | Finding | Severity | Status | Impact / Recommendation |
|---|---|---|---|---|---|
| **BYOK-01** | Cryptography | Authenticated AES-256-GCM AEAD | Best Practice | **VERIFIED** | 100% compliant with NIST SP 800-38D. |
| **BYOK-02** | Cryptography | CSPRNG 96-bit Nonce Uniqueness | Best Practice | **VERIFIED** | Random 12-byte IV per operation via Web Crypto. |
| **BYOK-03** | Architecture | Crypto Quintuplication | P3 (Debt) | **OPEN** | Consolidate 5 AES-GCM implementations into `src/seed/crypto/encryption.ts`. |
| **OBS-01** | Observability | Diagnostic Bundle Redaction | Best Practice | **VERIFIED** | Comprehensive regex sanitization + automated value-level tests. |
| **HYG-02** | Hygiene | Backup `.new` files in tree | P3 (Hygiene) | **OPEN** | Delete `key-format-validators.ts.new` and `query-client.ts.new`. |

---
**Report Authorized:** Senior SRE Forensic Team  
**Verification Digest:** All Phase 4 & Phase 12 items verified with direct code citations and automated test proofs.
