# BYOK Guide Screenshots

Three optional fallback PNG hints rendered by `<ByokHelpTip>` next to each
API-key input on the setup wizard. Recommended size: **960×320px** (3:1 crop).

Required files:
- `openrouter.png`  — https://openrouter.ai/keys page, highlight "Create Key" button
- `elevenlabs.png`  — ElevenLabs **Account → API Key** section
- `d-id.png`        — D-ID Studio **Account Settings → API** section

If a PNG is missing, the component hides the image gracefully via `onError`.
No broken-image icon is shown to users.

## Auto-capture (fallback)

```bash
npm run byok:screenshots
```

Headless Chromium snaps the public docs landing pages and saves them here.
Use this for an MVP launch when real-account screenshots aren't ready.

## Manual capture (recommended for production)

The auto-captured pages show docs, not the real key-creation UI. For the
production handoff, replace each PNG with a screenshot of your **own
dashboard** (signed-in) at 960×320 cropping the most relevant part of the
key creation screen. Tools: macOS `Cmd+Shift+4`, Cleanshot X, Snagit.
