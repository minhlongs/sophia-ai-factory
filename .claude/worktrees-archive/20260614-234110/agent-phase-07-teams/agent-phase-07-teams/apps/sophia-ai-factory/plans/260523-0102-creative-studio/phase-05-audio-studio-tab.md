---
phase: 5
title: "Audio Studio Tab"
status: pending
priority: medium
---

# Phase 05 — Audio Studio Tab

## Context

- Existing: `src/lib/ai/elevenlabs-api-client.ts` — `getDefaultVoiceId(tier)`, `uploadAudioToStorage()`
- Existing: `src/lib/ai/text-to-speech-generator-elevenlabs.ts` — full TTS generation pipeline
- Existing: `src/app/api/internal/tts/route.ts` — internal TTS API route
- Existing: `src/lib/video/tts-client.ts` — TTS client wrapper
- Server action from Phase 1: `tts-generate-action.ts`

## Files to Create

1. `src/app/[locale]/dashboard/creative-studio/components/audio-studio-tab.tsx` — Main tab
2. `src/app/[locale]/dashboard/creative-studio/components/audio-text-input.tsx` — Text input with char count
3. `src/app/[locale]/dashboard/creative-studio/components/audio-voice-selector.tsx` — Voice picker with preview
4. `src/app/[locale]/dashboard/creative-studio/components/audio-player-card.tsx` — Playback + download card

## Data Flow

```
User enters text + selects voice
  -> ttsGenerateAction() [Phase 1 server action]
    -> ElevenLabs TTS API (via existing client)
      -> Audio buffer
        -> uploadAudioToStorage() -> R2 URL
          -> Return URL to client
            -> AudioPlayerCard renders <audio> element
```

## Implementation Steps

### 1. `audio-studio-tab.tsx`

```
'use client'
Props: { tier: Tier }
- Top: AudioTextInput + AudioVoiceSelector
- Generate button
- Below: list of generated audio clips (AudioPlayerCard)
- Loading state during generation (~5-15s for ElevenLabs)
```

### 2. `audio-text-input.tsx`

```
'use client'
Props: { value, onChange, maxLength: 5000 }
- Large textarea (6 rows min)
- Character counter showing current/max
- Placeholder: "Enter text for voiceover..."
- SSML hint text (if ENTERPRISE+): "Supports SSML tags for advanced control"
```

### 3. `audio-voice-selector.tsx`

```
'use client'
Props: { tier, selectedVoiceId, onSelect }
- Dropdown or card grid of available voices
- Voice tiers:
  - BASIC: Adam (neutral, pNInz6obpgDQGcFmaJgB)
  - PREMIUM: Adam + Bella + Rachel (3 voices)
  - ENTERPRISE/MASTER: All ElevenLabs pre-made voices
- Each voice: name, description, "Preview" button (plays 2s sample via existing TTS endpoint)
- Selected voice has accent highlight
```

### 4. `audio-player-card.tsx`

```
'use client'
Props: { audioUrl, text (truncated), voiceName, createdAt }
- HTML5 <audio> player with controls
- Text preview (first 100 chars)
- Voice label
- Download button (direct R2 link)
- "Use in Video" button (copies URL for video pipeline integration)
- Timestamp
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ElevenLabs key not configured | Medium | Check BYOK store; show "Configure ElevenLabs key" |
| Long text exceeds ElevenLabs limit | Low | Enforce 5000 char max (ElevenLabs limit ~5000 chars) |
| Audio generation timeout | Low | Set 30s timeout; show retry button on failure |

## Todo

- [ ] Create `audio-studio-tab.tsx`
- [ ] Create `audio-text-input.tsx` with char counter
- [ ] Create `audio-voice-selector.tsx` with tier gating + preview
- [ ] Create `audio-player-card.tsx` with HTML5 player
- [ ] Wire to `ttsGenerateAction` from Phase 1
- [ ] Verify each file < 200 lines

## Success Criteria

- [ ] Text input accepts up to 5000 characters
- [ ] Voice selector shows tier-appropriate options
- [ ] Generate produces audio and returns playable URL
- [ ] Audio player renders with controls + download
- [ ] Missing BYOK key shows configuration prompt
