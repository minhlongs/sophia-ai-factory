# BYOK Wizard Polish — Implementation Report
Date: 2026-05-12 | Commit: 6d6ba64b

## Files Changed

| File | LOC | Change |
|---|---|---|
| `src/components/onboarding/byok-help-tip.tsx` | 98 | NEW — reusable collapsible guide component |
| `src/tree/components/setup-wizard/steps/api-keys-step.tsx` | 118 (+18) | Modified — import + wrap 3 inputs with ByokHelpTip |
| `messages/vi.json` | +15 | Added `onboarding.byok.help.*` namespace (VI) |
| `messages/en.json` | +15 | Added `onboarding.byok.help.*` namespace (EN) |
| `public/byok-guide/README.md` | 11 | NEW — screenshot placeholder docs |

## i18n Keys Added (both locales)

Under `onboarding.byok.help.*`:
- `toggleShow` / `toggleHide`
- `openrouter.{title,step1,step2,step3,signupUrl}`
- `elevenlabs.{title,step1,step2,step3,signupUrl}`
- `dId.{title,step1,step2,step3,signupUrl}`

Total: 14 keys × 2 locales = 28 strings.

## Build / Test Status

- TypeScript (`npx tsc --noEmit`): PASS — 0 errors
- Build (`npm run build`): PASS — `✓ Compiled successfully in 17.3s`
  - 2 Turbopack warnings are pre-existing (D1 binding at build time, not our code)
- i18n validator (`npm run i18n:validate`): PASS — 0 missing keys
- BYOK tests (`npm test -- byok`): PASS — 75/75
- api-keys-step tests (`npm test -- api-keys`): PASS — 7/7

## Screenshots Needed

These PNGs must be added to `public/byok-guide/` by designer / founder:
1. `public/byok-guide/openrouter.png` — openrouter.ai/keys page, "Create Key" CTA visible
2. `public/byok-guide/elevenlabs.png` — elevenlabs.io My Account → API Key section
3. `public/byok-guide/d-id.png` — studio.d-id.com Account Settings → API section

Component hides image gracefully (via `onError` state) if PNG absent — no broken-image icon.

## UX Behaviour

- Collapsed by default (no extra noise for users who already have keys)
- Click "Hướng dẫn lấy key" / "How to get this key" → expands inline
- Shows: title + 3 numbered steps + clickable signup URL + (optional) screenshot
- Click "Ẩn hướng dẫn" / "Hide guide" → collapses

## Decisions Made

- Used plain `<img>` instead of `next/image` to allow `onError` graceful fallback for missing PNGs
- Added `// eslint-disable-next-line @next/next/no-img-element` comment for linter compliance
- Accordion is client-only (`useState`) — no SSR state needed
- Did NOT touch Anthropic/MuAPI inputs (not in scope: CEO owns OpenRouter/ElevenLabs/D-ID)

## Open Questions

1. Should we also add ByokHelpTip to the **Anthropic** key input? (Free100 plan may need it for fallback LLM)
2. Screenshots: who will capture + optimize PNGs? Recommend 960×320px crop.
3. D-ID key format is `Basic <base64>` — should step 3 copy show how to encode the `email:key` pair? Currently simplified to "copy as-is".
