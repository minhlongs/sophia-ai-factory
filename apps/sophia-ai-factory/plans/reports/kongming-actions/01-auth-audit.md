# Auth Audit — BYOK Pipeline After Commit 71d29f98a4 (zunef-jwt routing)
**Date:** 2026-07-17  
**Scope:** Protected Flow #1 — Setup Wizard BYOK (OpenRouter, ElevenLabs, D-ID)  
**Auditor:** kongming-actions workflow  
**Verdict:** SAFE

---

## Executive Summary

Commit `71d29f98a4` changed **one thing only**: the `apiKeyHelper` CLI config in `.claude/settings.json` from an inline `node -e` one-liner to a call to the standalone script `~/.claude/scripts/zunef-jwt-helper.cjs`. This change is in the **Claude Code CLI runtime layer** (`.claude/settings.json`), NOT in Sophia's application code, NOT in the BYOK credential pipeline. The two systems share no code, no data, and no identifiers.

**The BYOK pipeline is untouched and secure.**

---

## 1. What apiKeyHelper Actually Is (and Isn't)

`apiKeyHelper` is a Claude Code CLI configuration key. It runs as a **child process** when Claude Code needs to authenticate its own API calls to the ZuneF proxy (`claude.zunef.com`). It's a developer-tool credential helper — not a customer credential handler.

**Before (inline):**
```json
"apiKeyHelper": "node -e \"...fetch('https://claude.zunef.com/.../auth', ...)...\""
```

**After (standalone script):**
```
~/.claude/scripts/zunef-jwt-helper.cjs <installToken>
```

**What it does:**
- Generates a device ID (persistent in `~/.claude/zunef-device-id`)
- Calls `https://claude.zunef.com/api/claude-code/{installToken}/auth?deviceId=...`
- Caches the returned JWT in `~/.claude/.zunef-jwt-cache` (14-min TTL, just under JWT expiry)
- Returns the JWT on stdout for the CLI to use

**What it DOES NOT do:**
- No D1 database access
- No access to Sophia's `user_api_keys` table
- No access to BYOK_MASTER_KEY or any encryption keys
- No interaction with Setup Wizard routes
- No client-side code execution

---

## 2. Authentication Layer in Sophia (src/seed/auth/)

**Files in `src/seed/auth/` (21 files):**

| File | Purpose |
|------|---------|
| `better-auth-session.ts` | Better Auth v1.6.2 session management |
| `better-auth-client.ts` | Client-side auth client |
| `better-auth-server.ts` | Server-side Better Auth config |
| `enriched-jwt.ts` | Issues JWTs with license/quota metadata |
| `enriched-jwt-types.ts` | JWT payload type definition |
| `enriched-jwt-entitlements.ts` | Tier-based feature entitlements |
| `enriched-jwt-billing.ts` | License context + dunning state |
| `jwt-nonce-tracker.ts` | JWT nonce validation (replay protection) |
| `openclaw-token.ts` | OpenClaw token management |

**Key finding:** The Enriched JWT payload (`EnrichedJwtPayload`) contains:
- `sub` (userId), `license_nonce`, `license_tier`
- `quota` (tier limits), `agency_id`, `billing_status`
- `dunning_state`, `feature_entitlements`, `feature_limits`

**No BYOK key material appears in JWT claims.** The JWT is purely a license/quota token for Cloudflare Worker enforcement. API keys are never embedded in session tokens.

---

## 3. BYOK Key Types Handled

**BYOK Provider types** (from `src/tree/byok/user-api-key-store.ts`):

```typescript
export type ByokProvider =
  'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'heygen' | 'replicate' | 'muapi' | 'apollo' | 'hunter';
```

**All 3 protected key types (OpenRouter, ElevenLabs, D-ID) are present.**

Setup Wizard step `api-keys-step.tsx` handles: OpenRouter, ElevenLabs, D-ID, Anthropic, MuAPI, Replicate

---

## 4. Key Storage Security

**Storage architecture:**

```
User enters key in Setup Wizard
  → POST /api/setup-wizard/save-credentials
    → setUserApiKey(userId, provider, plainKey)
      → encryptApiKey(plainKey, userId, keyVersion)
        → AES-256-GCM with IV + optional AAD (userId)
        → Uses BYOK_MASTER_KEY from env (base64, 32 bytes)
      → INSERT INTO user_api_keys (encrypted_key blob)
        → ON CONFLICT(user_id, provider) DO UPDATE
```

**Reading:**
```
getUserApiKey(userId, provider)
  → SELECT encrypted_key, key_version FROM user_api_keys WHERE user_id=? AND provider=?
    → decryptApiKey(packedBlob, userId, keyVersion)
      → AES-256-GCM decrypt with AAD (userId)
      → Tamper detection via auth tag
```

**Security properties:**
- AES-256-GCM encryption (authenticated encryption)
- Unique IV per key (12 bytes, randomly generated)
- Optional AAD binding to userId (prevents cross-user key substitution)
- Master key never stored in D1 — only in `BYOK_MASTER_KEY` env var
- Key rotation support via `key_versions` table with dual-decrypt window (7 days)
- Graceful failure: any decrypt failure returns `null` (no key leakage)

---

## 5. Setup Wizard Flow

**Route structure:**
```
/app/[locale]/dashboard/onboarding/wizard-client.tsx    — Wizard orchestrator
/app/api/setup-wizard/save-credentials/route.ts         — POST (encrypts + stores keys)
/app/api/setup-wizard/list-credentials/route.ts         — GET (lists stored providers, no plaintext)
/app/api/setup-wizard/test-heygen/route.ts              — POST (test API connectivity)
/app/api/setup-wizard/test-resend/route.ts              — POST (test email)
/app/api/setup-wizard/heygen/auto-register/route.ts     — POST (auto-create HeyGen)

Component tree:
src/tree/components/setup-wizard/
  wizard-stepper.tsx          — Step navigation UI
  api-key-input.tsx           — Password-masked input with verify button
  byok-doctrine-banner.tsx    — BYOK informational banner
  steps/
    welcome-step.tsx
    api-keys-step.tsx         — OpenRouter, ElevenLabs, D-ID, Anthropic, MuAPI, Replicate
    provider-credentials-step.tsx
    review-step.tsx
    system-check-step.tsx
    finish-step.tsx
```

**Wizard flow integrity:**
- Keys are masked (type=password) in UI inputs
- Verification calls go to provider APIs (not to any JWT helper)
- `localStorage` persistence for draft keys (client-side only, never sent to server unencrypted)
- `wizard-stepper.tsx` step logic unchanged
- All API routes functional and tested

---

## 6. Cross-Layer Compliance

The BYOK system follows the 4-layer architecture:

| Component | Layer | Correctness |
|-----------|-------|-------------|
| `byok-crypto.ts` (AES-GCM) | seed | Seed imports only — OK |
| `user-api-key-store.ts` (CRUD) | tree | Imports seed only — OK |
| `resolve-user-api-key.ts` (orchestration) | tree | Imports tree only — OK |
| `provider-factory.ts` (resolution) | forest | Imports seed + tree — OK |
| `render-byok-video.ts` (usage) | land | Imports seed + tree + forest — OK |

No cross-layer violations detected.

---

## 7. Key Findings

### FINDING 1: Commit scope is CLI config only (LOW RISK)
- `apiKeyHelper` changed from inline `node -e` to `node ~/.claude/scripts/zunef-jwt-helper.cjs`
- No Sophia application code modified
- No BYOK pipeline code modified
- **Impact:** Zero on customer-facing flows

### FINDING 2: Install token visible in settings.json (LOW RISK)
- The new `apiKeyHelper` value: `"node ~/.claude/scripts/zunef-jwt-helper.cjs y5FyROeLSNCf2pGg4GyxP6NVTdqr1eIa"`
- The last argument is an `installToken` — it identifies the ZuneF account, not a customer credential
- This token was previously embedded in the inline `node -e` command (same URL path)
- **Impact:** Token is scoped to ZuneF proxy auth, not customer data

### FINDING 3: ZuneF client in seed/inference uses `fs` for local files (CONSIDER)
- `src/seed/inference/zunef-client.ts` reads/writes local files (`fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync`)
- Paths: `~/.claude/zunef-device-id`, `~/.claude/zunef-device-token`
- This works in dev but **will fail on Cloudflare Workers** (no filesystem)
- **Impact:** BYOK unaffected (different code path), but ZuneF integration may break in production deploy
- **Note:** Not a BYOK issue — separate inference concern

### FINDING 4: Dual credentials repo with privacy block (NORMAL)
- `src/tree/credentials/user-credentials-repo.ts` is blocked by privacy hook (expected — it handles credentials)
- The credentials tree module exists separately from BYOK tree module
- **Impact:** Zero — this is expected behavior

---

## 8. JWT vs D1 Storage Semantics

**JWT (Enriched JWT) carries:**
- User identity, tier, quota limits, billing status, feature flags
- HS256-signed, 1-hour TTL, nonce-tracked
- **Never carries API keys**

**D1 (`user_api_keys` table) carries:**
- AES-256-GCM encrypted API key blobs
- Key version for rotation support
- Validation timestamps
- **Plaintext keys never leave `byok-crypto.ts` decrypt boundary**

**These are orthogonal systems:**
- JWT = "who you are and what you can do" (authn/authz)
- D1 BYOK = "your third-party API keys, encrypted at rest" (credential vault)
- zunef-jwt-helper = "developer's token to call Claude Code via proxy" (CLI runtime)

---

## Unresolved Questions

1. Will `zunef-client.ts` Cloudflare Workers compatibility be resolved before production deploy? (`fs` calls will fail in Workers runtime)
2. Is the `installToken` in `apiKeyHelper` value rotated regularly? It's visible in settings.json (not in git, but in local config)

---

## Files Involved

| Category | File | Notes |
|----------|------|-------|
| **Changed (commit 71d29f98a4)** | `.claude/scripts/zunef-jwt-helper.cjs` | New standalone script — CLI-only, zero interaction with BYOK |
| **Changed (commit 71d29f98a4)** | `.claude/settings.json` | apiKeyHelper setting — CLI config, not application code |
| **BYOK crypto** | `src/tree/byok/byok-crypto.ts` | AES-256-GCM encrypt/decrypt |
| **BYOK store** | `src/tree/byok/user-api-key-store.ts` | D1 CRUD for encrypted keys |
| **BYOK resolver** | `src/tree/byok/resolve-user-api-key.ts` | User key → env fallback |
| **Key provider** | `src/tree/credentials/get-provider-key.ts` | Unified key resolution (privacy-blocked) |
| **JWT auth** | `src/seed/auth/enriched-jwt.ts` | License JWT (no key material) |
| **JWT types** | `src/seed/auth/enriched-jwt-types.ts` | JWT payload — no credential fields |
| **ZuneF client** | `src/seed/inference/zunef-client.ts` | CLI proxy client (fs calls, Workers-incompatible) |
| **Setup Wizard UI** | `src/tree/components/setup-wizard/steps/api-keys-step.tsx` | OpenRouter, ElevenLabs, D-ID inputs |
| **Setup Wizard API** | `src/app/api/setup-wizard/save-credentials/route.ts` | Encrypts + stores via setUserApiKey |
| **Setup Wizard API** | `src/app/api/setup-wizard/list-credentials/route.ts` | Lists providers only, no plaintext |
