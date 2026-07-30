# Operator-Secret + BYOK Audit — 2026-07-29
Scope: enforce no-tech doctrine across src/{seed,tree,forest,land}

## BYOK Pattern Reference
- OpenRouter (script): `resolveUserApiKey(userId, 'openrouter', process.env.OPENROUTER_API_KEY)`
- ElevenLabs (TTS): `resolveUserApiKey(userId, 'elevenlabs', process.env.ELEVENLABS_API_KEY)`
- D-ID: `resolveUserApiKey(userId, 'd-id')`
- HeyGen: partial BYOK via `getHeyGenApiKey(userId)` with `process.env.HEYGEN_API_KEY` fallback

## Operator Secrets Confirmed
- WAN_API_KEY (video pipeline) — src/forest/inngest/functions/video-generate.ts:104
- FISH_SPEECH_API_KEY (TTS) — src/forest/inngest/functions/video-generate.ts:109
- CLOUDCONVERT_API_KEY (mux) — src/forest/inngest/functions/video-generate.ts:111
- NOWPAYMENTS_API_KEY / NOWPAYMENTS_IPN_SECRET (primary payment provider)
- PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY (Vietnam backup)

## Security/Infra Secrets (Acceptable — Platform-Owned)
- JWT_SECRET=REDACTED / BETTER_AUTH_SECRET (auth)
- OAUTH_TOKEN_ENC_KEY (token encryption)
- API_ENCRYPTION_KEY / CREDENTIALS_MASTER_KEY / BYOK_MASTER_KEY (BYOK storage)
- UPSTASH_REDIS_REST_URL/TOKEN, HONEYCOMB_API_KEY, LANGFUSE keys
- CRON_SECRET / INTERNAL_CRON_SECRET / DEPLOY_GUARD_API_TOKEN

## Doctrine Verdict
Video generation core (WAN + FishSpeech + CloudConvert) breaks no-tech doctrine.
Payment provider secrets are platform-owned by design — acceptable.
