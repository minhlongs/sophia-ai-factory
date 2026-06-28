# Research: API Integrations & Validation Strategy

## 1. OpenRouter API (LLM)
**Purpose:** Text generation and reasoning.
**Validation Endpoint:** `GET https://openrouter.ai/api/v1/auth/key`
- **Success:** `200 OK` - Returns key details, usage, and limits.
- **Headers:** `Authorization: Bearer <sk-or-...>`
- **Validation:** Check `data.limit` and `data.usage` to ensure quota remains.

**Error Codes:**
- `401 Unauthorized`: Invalid API Key.
- `402 Payment Required`: Insufficient credits.
- `429 Too Many Requests`: Rate limit exceeded.

## 2. ElevenLabs API (Voice)
**Purpose:** Text-to-speech generation.
**Validation Endpoint:** `GET https://api.elevenlabs.io/v1/user/subscription`
- **Success:** `200 OK` - Returns `character_count` and `character_limit`.
- **Headers:** `xi-api-key: <api-key>`
- **Validation:** Verify `character_count < character_limit`.

**Error Codes:**
- `401 Unauthorized`: Invalid API Key.
- `400 Bad Request`: Invalid voice ID or parameters.

## 3. D-ID API (Video)
**Purpose:** Avatar video generation.
**Validation Endpoint:** `GET https://api.d-id.com/credits`
- **Success:** `200 OK` - Returns remaining credits.
- **Headers:** `Authorization: Basic <base64(api-key)>` (Note: D-ID uses Basic Auth or Bearer depending on key type, usually Basic for `client_id:api_key`).
- **Validation:** Check `credits.remaining > 0`.

**Error Codes:**
- `401 Unauthorized`: Invalid credentials.
- `403 Forbidden`: Subscription expired or feature not allowed.
- `402 Payment Required`: Out of credits (often returns 403 or 400 with specific message).

## 4. Airtable API (Database)
**Purpose:** CMS for generated content.
**Validation Endpoint:** `GET https://api.airtable.com/v0/meta/whoami`
- **Success:** `200 OK` - Returns user ID and email.
- **Headers:** `Authorization: Bearer <pat-...>` (Personal Access Token).
- **Alternate:** `GET https://api.airtable.com/v0/meta/bases` to list accessible bases.

**Validation Pattern:**
- Regex: `^pat[a-zA-Z0-9]{14}\.[a-zA-Z0-9]{64}$` (Approximate PAT format).
- Functional: Call `whoami` endpoint.

## 5. Social Media OAuth
**Validation:** Token validity check is required before posting.

| Platform | Validation URL | Scope Required |
|----------|---------------|----------------|
| **YouTube** | `GET https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=<token>` | `youtube.upload` |
| **TikTok** | `GET https://open.tiktokapis.com/v2/user/info/` | `video.upload` |
| **Instagram** | `GET https://graph.instagram.com/me` | `instagram_content_publish` |

**Refresh Strategy:**
- All support Refresh Tokens. Store `refresh_token` securely.
- If Validation URL returns `401`, use `refresh_token` to get new `access_token`.

## Unresolved Questions
- Specific scope requirements for "Sophia" auto-reply features (YouTube comments)?
- Does OpenRouter key enforce specific model access restrictions?
