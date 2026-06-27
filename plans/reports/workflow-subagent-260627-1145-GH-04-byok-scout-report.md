# BYOK Scout Report — Sophia AI Factory

**Date:** 2026-06-27  
**Scope:** Bring Your Own Keys (BYOK) implementation — storage, encryption, runtime resolution, setup wizard  
**Work context:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`

---

## 1. How Customer API Keys Are Stored and Retrieved

Two parallel D1 tables serve different key categories:

### Table A: `user_api_keys` (LLM / media-gen BYOK)
- **Columns:** `user_id`, `provider`, `encrypted_key` (BLOB), `key_version`, `key_validated_at`, `updated_at`
- **UNIQUE(user_id, provider)** — one key per user per provider
- **Write path:** `setUserApiKey()` → calls `encryptApiKey()` → stores packed Uint8Array as BLOB
- **Read path:** `getUserApiKey()` → reads row → calls `decryptApiKey()` → returns plaintext string
- **Providers:** `openrouter | anthropic | elevenlabs | d-id | heygen | muapi | apollo | hunter`

### Table B: `user_provider_credentials` (fulfillment providers)
- **Columns:** `user_id`, `provider`, `encrypted_value` (TEXT), `key_version`, `display_hint`, `status`, `last_used_at`
- **UNIQUE(user_id, provider)**
- **Write path:** `setUserCredential()` → calls `encryptValue()` → stores as `v<version>:<iv_b64>:<ct_b64>` text
- **Read path:** `getUserCredential()` → reads row → calls `decryptValue()` → returns plaintext
- **Providers:** `heygen | heygen_webhook_secret | resend | nowpayments | local_llm | kling | assemblyai | openai | openrouter`
- **display_hint:** last 4 chars of plaintext for UI (e.g. `"...XYZ9"`)

### Table C: `platform_credentials` (OAuth tokens for publishing)
- Managed by `credential-manager.ts` in both `tree/publishing/` and `forest/publishing/`
- Uses `seed/security/encryption-aes-gcm.ts` (different master key: `API_ENCRYPTION_KEY`)
- Stores `access_token_encrypted`, `refresh_token_encrypted` for social platforms

---

## 2. BYOK Store / Credential Management Code

### Core BYOK Store (tree layer)
| File | Role |
|------|------|
| `src/tree/byok/user-api-key-store.ts` | CRUD for `user_api_keys` table. `setUserApiKey`, `getUserApiKey`, `clearUserApiKey`, `listUserApiKeyProviders` |
| `src/tree/credentials/user-credentials-repo.ts` | CRUD for `user_provider_credentials` table. `setUserCredential`, `getUserCredential`, `deleteUserCredential`, `listUserProviders` |
| `src/tree/byok/key-format-validators.ts` | Per-provider format validation (regex patterns for OpenRouter, Anthropic, ElevenLabs, D-ID auto-base64, etc.). `sanitizeCredential()` strips control chars/zero-width spaces |
| `src/tree/byok/with-timeout.ts` | Timeout wrapper for key verification calls |

### Credential Manager (publishing/platform OAuth)
| File | Role |
|------|------|
| `src/tree/publishing/credential-manager.ts` | `getDecryptedCredentials`, `storeCredentials`, `getClientCredentials` for platform OAuth tokens |
| `src/forest/publishing/credential-manager.ts` | Identical interface, forest-layer copy (calls same seed encryption + repo) |

### API Routes
| File | Role |
|------|------|
| `src/app/api/setup-wizard/save-credentials/route.ts` | POST handler — validates Zod schema, calls `setUserCredential` per provider, auto-registers HeyGen webhook, marks onboarding complete, enqueues welcome email |
| `src/app/api/setup-wizard/list-credentials/route.ts` | GET handler — returns `CredentialSummary[]` (metadata only, no plaintext) |

---

## 3. Runtime Key Resolution (Customer Key vs Platform Fallback)

**File:** `src/tree/byok/resolve-user-api-key.ts`

```typescript
export function isByokEnabled(): boolean {
  return process.env.BYOK_ENABLED === '1'
}

export async function resolveUserApiKey(
  userId: string | null | undefined,
  provider: ByokProvider,
  envFallback?: string,
): Promise<string | null> {
  const fallback = envFallback ?? null
  if (!isByokEnabled()) return fallback        // BYOK off → env only
  if (!userId) return fallback                  // no user → env only
  const userKey = await getUserApiKey(userId, provider)
  return userKey ?? fallback                    // user key first, env fallback
}
```

**Resolution contract:**
- `BYOK_ENABLED=0` or unset → always returns `envFallback` (platform key from env)
- `BYOK_ENABLED=1`, user has key → returns decrypted user key
- `BYOK_ENABLED=1`, user missing key → returns `envFallback`
- `BYOK_ENABLED=1`, no userId (cron jobs) → returns `envFallback`

**Consumer example** (`src/land/openclaw/llm-router.ts`):
```typescript
const apiKey = opts.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? ''
```
Callers pass `resolveUserApiKey(userId, 'anthropic', process.env.ANTHROPIC_API_KEY)` to get the resolved key.

---

## 4. Encryption / Decryption of Stored Keys

### Primary: `src/tree/byok/byok-crypto.ts` (AES-GCM-256)
- **Algorithm:** AES-GCM-256 via Web Crypto API (`crypto.subtle`)
- **Master key:** `BYOK_MASTER_KEY` env var — base64-encoded 32 bytes
- **Packed format:** `[version (1 byte)][iv (12 bytes)][ciphertext + auth tag]` as Uint8Array → stored as base64 text in D1
- **AAD (Additional Authenticated Data):** `userId` encoded as UTF-8 — binds ciphertext to user, prevents cross-user key substitution
- **Key versioning:** `key_versions` D1 table tracks master key versions with `is_active`, `rotated_at`, `rotated_by`
- **Dual-decrypt window:** 7 days — previous key version stays valid during rotation so existing credentials remain readable
- **Key rotation flow:** New version inserted → re-encrypt job (Inngest) re-encrypts all rows → old version retired

### Secondary: `src/tree/credentials/encryption.ts` (AES-GCM-256)
- **Algorithm:** AES-GCM-256 via Web Crypto API
- **Master key:** `CREDENTIALS_MASTER_KEY` env (64 hex chars = 32 bytes), falls back to `BYOK_MASTER_KEY`
- **Text format:** `v<version>:<iv_b64>:<ciphertext_b64>` — stored in TEXT column
- **Dual-decrypt window:** 24 hours
- **AAD support:** Same userId-binding pattern

### Seed primitive: `src/seed/security/encryption-aes-gcm.ts` (AES-GCM-256)
- **Algorithm:** AES-GCM-256
- **Master key:** `API_ENCRYPTION_KEY` env (hex)
- **Format:** `<iv_hex>:<ciphertext_hex>` — used for platform OAuth tokens in `platform_credentials`
- **Utility:** `maskApiKey()` for display (`sk-...482s`)

### Key Rotation: `src/forest/inngest/functions/key-rotation-reencrypt.ts`
- Inngest function triggered by `key.rotation.requested` event
- Batch re-encrypts 250 rows at a time across three tables: `user_api_keys`, `user_provider_credentials`, `platform_credentials`
- Retires old key version after successful re-encrypt
- SOC 2 CC7.2 audit logging

### Key Versioning Migration: `migrations/0184_key_versions.sql`
- Creates `key_versions` table with `key_type` ('master' | 'credential' | 'platform'), `version`, `encrypted_key`, `is_active`, `rotated_at`
- Adds `key_version` column to all three credential tables

---

## 5. Setup Wizard Steps for API Key Input

**Wizard component tree:**
```
src/tree/components/setup-wizard/
├── wizard-stepper.tsx          # Progress bar with step indicators
├── api-key-input.tsx           # Reusable password-masked input with Verify button
├── byok-doctrine-banner.tsx    # BYOK security notice
└── steps/
    ├── welcome-step.tsx        # Step 1: Intro + what you need
    ├── api-keys-step.tsx       # Step 2: LLM/media API keys
    ├── provider-credentials-step.tsx  # Step 3: Fulfillment provider keys
    ├── review-step.tsx         # Step 4: Review all keys before save
    └── finish-step.tsx         # Step 5: Completion
```

**Wizard API routes:**
```
src/app/api/setup-wizard/
├── save-credentials/route.ts   # POST — encrypts + stores all keys
├── list-credentials/route.ts   # GET — returns metadata only
└── heygen/auto-register/route.ts  # Auto-registers HeyGen webhook
```

### Step-by-step flow:

**Step 1 — Welcome** (`welcome-step.tsx`)
- Shows 3 feature cards: "Your Keys, Your Control", "Bank-Level Security", "Launch in Minutes"
- Lists what customer needs: HeyGen API key, Resend key (optional), NOWPayments (optional)
- "Get Started" button → next

**Step 2 — API Keys** (`api-keys-step.tsx`)
- **Required:** OpenRouter, ElevenLabs, D-ID
- **Optional:** Anthropic, MUAPI
- Each key uses `ApiKeyInput` component (password-masked, show/hide toggle, Verify button with latency display)
- `ByokHelpTip` component provides provider-specific help text
- Client-side format validation via `key-format-validators.ts` before submit

**Step 3 — Provider Credentials** (`provider-credentials-step.tsx`)
- **Required:** HeyGen API key (with webhook setup instructions inline)
- **Optional:** Resend (falls back to platform key), NOWPayments (advanced)
- HeyGen section includes webhook URL (`https://sophia.agencyos.network/api/webhooks/heygen`) with copy button and step-by-step instructions
- Shows `SavedHint` if credential already exists (last 4 chars)

**Step 4 — Review** (`review-step.tsx`)
- Shows masked keys in two columns: "AI/LLM Keys" and "Voice/Avatar Keys"
- "Provider Keys" section spans full width
- Warning if required keys missing
- Security note: "Keys are encrypted and stored securely"
- Confirm button → POST to save-credentials

**Step 5 — Finish** (`finish-step.tsx`)
- Completion screen

### Save flow (`save-credentials/route.ts`):
1. Auth check (`getCurrentUser`)
2. Zod validation with `sanitizeCredential()` preprocessing
3. For each provided key: `setUserCredential(userId, provider, key)` → encrypts + upserts to D1
4. If HeyGen key saved: auto-registers webhook via `registerHeyGenWebhook()`, auto-stores signing secret
5. Marks `onboarding_completed_at` in `user_profiles`
6. Enqueues `setup-complete` lifecycle email (deduped via `lifecycle_email_log`)

---

## Key Architectural Observations

1. **Two encryption systems in parallel:** `byok-crypto.ts` (BYOK_MASTER_KEY, base64, packed binary) and `encryption.ts` (CREDENTIALS_MASTER_KEY, hex, text format). They share the same `key_versions` table but have different env vars and formats. The credential layer falls back to `BYOK_MASTER_KEY` for backward compat.

2. **AAD binding:** Both encryption layers bind ciphertext to `userId` via AES-GCM Additional Authenticated Data. This means a user cannot decrypt another user's key even if they somehow access the raw blob.

3. **Graceful degradation:** `getUserApiKey()` swallows all errors to `null`, letting callers fall back to env vars. This is intentional — the platform never breaks if BYOK is misconfigured.

4. **BYOK gating:** `BYOK_ENABLED=1` env flag controls whether the user key store is queried at all. When off, the system is entirely env-driven.

5. **Key rotation:** Full rotation pipeline exists (Inngest job + dual-decrypt window + audit logging), but production rotation is still pending (task #125 in CLAUDE.md).

6. **No secrets in client code:** The wizard client (`wizard-client.tsx`) was not found at the expected path — the actual client component lives at `src/app/[locale]/dashboard/onboarding/wizard-client.tsx` (with locale segment). Keys never leave the server; the wizard posts to `/api/setup-wizard/save-credentials`.

---

## Relevant File Paths

**Encryption:**
- `src/tree/byok/byok-crypto.ts` — Primary BYOK encryption (AES-GCM-256, packed binary)
- `src/tree/credentials/encryption.ts` — Provider credential encryption (AES-GCM-256, text format)
- `src/seed/security/encryption-aes-gcm.ts` — Seed-level encryption primitive (platform OAuth)

**Storage:**
- `src/tree/byok/user-api-key-store.ts` — user_api_keys CRUD
- `src/tree/credentials/user-credentials-repo.ts` — user_provider_credentials CRUD
- `src/tree/publishing/credential-manager.ts` — Platform OAuth credential manager
- `src/forest/publishing/credential-manager.ts` — Forest-layer credential manager

**Runtime Resolution:**
- `src/tree/byok/resolve-user-api-key.ts` — Customer key vs env fallback resolver
- `src/land/openclaw/llm-router.ts` — Consumer example (Anthropic API key resolution)

**Setup Wizard:**
- `src/tree/components/setup-wizard/api-key-input.tsx` — Reusable key input component
- `src/tree/components/setup-wizard/wizard-stepper.tsx` — Progress stepper
- `src/tree/components/setup-wizard/steps/welcome-step.tsx` — Step 1
- `src/tree/components/setup-wizard/steps/api-keys-step.tsx` — Step 2 (LLM keys)
- `src/tree/components/setup-wizard/steps/provider-credentials-step.tsx` — Step 3 (fulfillment keys)
- `src/tree/components/setup-wizard/steps/review-step.tsx` — Step 4
- `src/app/api/setup-wizard/save-credentials/route.ts` — Save endpoint
- `src/app/api/setup-wizard/list-credentials/route.ts` — List endpoint

**Key Rotation:**
- `src/forest/inngest/functions/key-rotation-reencrypt.ts` — Inngest re-encrypt job
- `src/tree/byok/byok-crypto.ts` — Dual-decrypt window, version loading

**Migrations:**
- `migrations/0184_key_versions.sql` — key_versions table + key_version columns
- `migrations/0046-user-provider-credentials.sql` — user_provider_credentials table
- `migrations/0144_platform_credentials.sql` — platform_credentials table

**Validation:**
- `src/tree/byok/key-format-validators.ts` — Per-provider format validators + sanitize
