# Sophia R5 — Phase 4G-BYOK: per-user API keys (MVP)

**Status:** in progress
**Mode:** `/cook all step by step --auto` (R5 item 5/5)
**Origin:** Phase 4G memory note "per-user OpenRouter + Anthropic keys"

## Scope (MVP — cryptography + storage + resolver)

Ships the **foundations** for BYOK. No caller rewiring in this pass.
Rationale: Sophia's LLM callers today are cron/Inngest-driven without
user context; wiring requires threading `userId` through those jobs,
which is a separate refactor. This phase delivers the crypto primitives
and table so subsequent work (`4G-WIRE`) can plug them in.

## New migration

`apps/sophia-ai-factory/migrations/0011-user-api-keys.sql`
- `user_api_keys(user_id, provider, encrypted_key BLOB, created_at, updated_at)`
- PRIMARY KEY `(user_id, provider)` — one key per user/provider
- INDEX on `user_id` for fast lookup
- Providers: `openrouter`, `anthropic`, `elevenlabs`, `d-id` (extensible string)

## New modules

### `src/lib/byok/byok-crypto.ts`
- AES-GCM 256 via Web Crypto (Cloudflare Workers compatible)
- Master key: `BYOK_MASTER_KEY` env (base64 32 bytes)
- Format: `[iv(12)][ciphertext+tag]` packed as Uint8Array
- `encryptApiKey(plain)`, `decryptApiKey(bytes)` — throw on tamper

### `src/lib/byok/user-api-key-store.ts`
- `setUserApiKey(userId, provider, plainKey)` — encrypts + upsert
- `getUserApiKey(userId, provider)` — fetch + decrypt; null on miss / decrypt fail
- `clearUserApiKey(userId, provider)` — DELETE

### `src/lib/byok/resolve-user-api-key.ts`
- `resolveUserApiKey(userId, provider, envFallback?)`
- Returns user key if present; otherwise `envFallback` (allows opt-in BYOK
  without breaking existing env-driven callers)

## Env gate

- `BYOK_ENABLED` — master on/off flag
- `BYOK_MASTER_KEY` — base64-encoded AES-256 key; `resolveUserApiKey`
  returns `envFallback` when master-key missing (degraded mode)

## Tests (+~12)

- byok-crypto: encrypt→decrypt round-trip / tamper detection / missing
  master key throws
- user-api-key-store: set→get round-trip / overwrite (upsert) / clear /
  missing row returns null / decrypt failure returns null
- resolve-user-api-key: user has key → returns user key / user missing →
  returns envFallback / env and user both missing → null / gate off →
  always envFallback

## Non-goals

- No admin/self-service UI — `/dashboard/api-keys` wiring deferred
- No caller migration (workflow-stepper, crons stay env-driven until
  `4G-WIRE` threads userId)
- No key rotation workflow (future)
- No audit-log on set/clear (future)

## Verification

- Tests: 1249 → 1261+ (+12)
- Build: 0 errors
- LOC per file ≤200
