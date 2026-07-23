# L-Plan: ID-02 Vietnamese Voice Optimization
> Created: 2026-07-22 | Worker: planner | Contract: M1 | Priority: P1

## Objective
Reduce Vietnam-segment churn by making AI-generated video voice + subtitles feel authentically local. No new vendor contracts; ship through existing BYOK ElevenLabs channel and subtitle renderer.

## Assumed Decisions (overridable)
- Reuse existing BYOK ElevenLabs key + `tree/voice` + `forest/ai` paths.
- Add a `vietnamese_natural` preset entry; do not create new provider routing.
- Subtitle diacritic adjustments are CSS/rules-only; no font shipping.
- No platform voice budget required; user-provided key covers cost.

## Phase 1: Voice Preset + Selector Exposure (2h)
- Add preset slug + metadata in `seed/voices/presets.ts` (or alias in existing preset registry).
- Expose via `/api/voice-presets` and dropdowns: `video-voice-picker.tsx`, `audio-voice-selector.tsx`.
- Preset is advisory only; user can still override with custom voiceId.

## Phase 2: Script Heuristics for VN Phonetics (2h)
- Add lightweight server-side validator for Vietnamese text input before TTS: common problematic combinations + diacritic density hint.
- Surface as inline UX hint ("Consider shorter sentences for better lip sync") not a hard block.

## Phase 3: Subtitle Diacritic Render Rules (2h)
- Update subtitle/caption styling logic to increase line-height and weight when diacritic density bracket exceeds threshold.
- Scope: Facebook in-app browser + Zalo OA mobile surface only (2 surfaces).
- Pixel-tested not required; visual regression check via existing snapshot path if available.

## Phase 4: Observability (1h)
- Add telemetry event `voice_preset_selected` with `preset` + `locale`.
- Add event `subtitle_render_adjusted` when diacritic bracket triggers style change.

## Verification Gates
- npm test passes with existing suite.
- Manual: select `vietnamese_natural` preset -> verify voiceId passed to TTS route.
- Manual: paste VN text with stacked diacritics -> verify rendered subtitle line-height increases.
- Bilingual copy: VN + EN labels in voice picker.

## Risks
- ElevenLabs Vietnamese voice availability varies by account; fallback to generic voice if preset missing.
- Diacritic density threshold may need tuning per device; MVP uses conservative defaults.
