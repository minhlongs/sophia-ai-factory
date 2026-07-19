# Existing Credentials & Mock Mode Research

## 1. Credential Audit & Codebase Status
Analysis of `.env` structure and actual source code reveals a mixed maturity level regarding mock/test modes.

| Service | Env Variable | Usage Location | Status | Current Mock Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/*` | **Critical** | None. Relies on real DB instance (Prod/Dev). |
| **Polar.sh** | `POLAR_ACCESS_TOKEN` | `src/lib/polar.ts` | **Critical** | **Built-in**. Code switches to `server: 'sandbox'` when `NODE_ENV === 'development'`. |
| **HeyGen** | `HEYGEN_API_KEY` | `src/lib/heygen/heygen-client.ts` | Feature | **Missing**. Returns `null` or throws error if key is missing. Needs wrapper. |
| **ElevenLabs** | `ELEVENLABS_API_KEY` | `src/lib/ai/text-to-speech...ts` | Feature | **Implemented**. Logic exists: `if (!apiKey) return mockAudioUrls`. |
| **OpenRouter** | `OPENROUTER_API_KEY` | `src/lib/ai/script-generator.ts` | Feature | **Implemented**. Logic exists: `if (!apiKey) return generateMockScript(...)`. |
| **Telegram** | `TELEGRAM_BOT_TOKEN` | `src/lib/telegram/*` | Feature | **Partial**. Manual check for token. No automated mock response mode found. |
| **ClickBank** | N/A (Public Feed) | `clickbank-adapter.ts` | Feature | **Implemented**. `getMockData()` used in dev mode. |
| **ShareASale** | `SHAREASALE_API_TOKEN` | `shareasale-adapter.ts` | Feature | **Implemented**. `getMockData()` used if creds missing. |

## 2. Test & Sandbox Capabilities

### 🐻 Polar.sh
*   **Sandbox Mode**: **YES**.
*   **Current State**: `src/lib/polar.ts` correctly handles this:
    ```typescript
    server: process.env.NODE_ENV === 'development' ? 'sandbox' : 'production'
    ```
*   **Action**: Ensure `POLAR_ACCESS_TOKEN` in `.env.local` matches the environment (Sandbox vs Prod).

### 🎥 HeyGen (Video)
*   **Sandbox Mode**: **NO**.
*   **Current State**: `heygen-client.ts` is a direct wrapper.
*   **Risk**: Running tests or dev server without a key will fail video generation tasks.
*   **Recommendation**: Implement a `MockHeyGenClient` or add a fallback in `getHeyGenClient` similar to ElevenLabs implementation.

### 🗣️ ElevenLabs & 📝 OpenRouter (Script/Voice)
*   **Sandbox Mode**: **Simulated**.
*   **Current State**: Excellent. Developers can run the app without these keys and get mock content (static audio URLs and pre-written scripts).
*   **Action**: No changes needed for local dev.

### 🤖 Telegram
*   **Sandbox Mode**: **Test Server (Complex)** or **Test Bot (Recommended)**.
*   **Current State**: `telegram-bot.ts` requires a token.
*   **Recommendation**: Use a separate `@BotFather` bot for development (e.g., `SophiaDevBot`).

## 3. Recommended Mock Strategy

### A. Fix HeyGen Gap
The HeyGen client is the only major feature missing a "dev-friendly" fallback.
**Plan**: Update `src/lib/heygen/heygen-client.ts` to return a mock video object if `HEYGEN_API_KEY` is missing.
```typescript
// Proposed Mock Return
{
  id: "mock_video_id",
  status: "completed",
  video_url: "https://mock-storage.com/placeholder.mp4"
}
```

### B. CI/CD Pipeline
*   **Unit Tests**: already mock external dependencies (`vi.mock`).
*   **E2E Tests**: Should run with `NODE_ENV=test` (or development) and **NO** API keys for AI services to force the mock paths, ensuring the flow logic holds up without spending money.
*   **Polar**: Use Sandbox credentials in CI.

## 4. Unresolved Questions
*   **Supabase**: Do we have a separate Supabase project for "Staging"? Currently, it seems we might be sharing one project. **Recommendation**: Use local Supabase CLI (`supabase start`) for true offline dev/test isolation.
