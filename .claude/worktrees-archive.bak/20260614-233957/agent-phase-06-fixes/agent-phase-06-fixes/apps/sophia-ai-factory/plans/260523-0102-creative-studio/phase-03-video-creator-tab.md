---
phase: 3
title: "Video Creator Tab"
status: pending
priority: high
---

# Phase 03 — Video Creator Tab

## Context

- Existing action: `src/app/actions/video-generate-action.ts` — validates, reserves quota, emits Inngest event
- Existing component: `src/app/[locale]/dashboard/videos/new/components/ai-prompt-form.tsx`
- Existing: `src/lib/heygen/heygen-client.ts` — avatar listing
- Existing: `src/lib/ai/elevenlabs-api-client.ts` — voice selection by tier
- Existing: `src/seed/templates/presets.ts` — template definitions

## Files to Create

1. `src/app/[locale]/dashboard/creative-studio/components/video-creator-tab.tsx` — Main tab component
2. `src/app/[locale]/dashboard/creative-studio/components/video-script-input.tsx` — Script textarea with char count
3. `src/app/[locale]/dashboard/creative-studio/components/video-avatar-picker.tsx` — HeyGen avatar grid selector
4. `src/app/[locale]/dashboard/creative-studio/components/video-voice-picker.tsx` — ElevenLabs voice dropdown
5. `src/app/[locale]/dashboard/creative-studio/components/video-template-selector.tsx` — path-a/path-b selector

## Files to Modify

None (tab lazy-loaded from Phase 2 shell).

## Data Flow

```
User fills form:
  script (textarea) + avatar (picker) + voice (dropdown) + template (selector)
    -> "Generate Video" button
      -> videoGenerateAction(input) [existing server action]
        -> Inngest event emitted
          -> User sees "Processing..." with mission ID
            -> Redirect to /dashboard/videos/[missionId] for progress
```

## Implementation Steps

### 1. `video-creator-tab.tsx` (Client Component)

```
'use client'
Props: { tier: Tier }
- Composition of: ScriptInput + AvatarPicker + VoicePicker + TemplateSelector
- Form state managed with useState
- Submit calls videoGenerateAction() [imported from existing action]
- On success: show toast + link to video progress page
- On error: show inline error
- Tier badge showing quota remaining (reads from SidebarQuotaWidget pattern)
- Disabled state when AI prompt pipeline not configured (checks preflight)
```

### 2. `video-script-input.tsx`

```
'use client'
Props: { value, onChange, maxLength: 500 }
- Textarea with character counter
- Placeholder: "Describe your video content..."
- Min 10 chars, max 500 chars (matches Zod schema in video-generate-action.ts:24)
```

### 3. `video-avatar-picker.tsx`

```
'use client'
Props: { tier, selectedId, onSelect }
- Fetch avatars: GET /api/internal/heygen/avatars (or use existing heygen-client)
- Grid of avatar thumbnails (3-4 per row)
- Selected state with ring highlight
- "Default" avatar pre-selected
- Tier gating: BASIC gets 2 avatars, PREMIUM 5, ENTERPRISE+ all
```

### 4. `video-voice-picker.tsx`

```
'use client'
Props: { tier, selectedId, onSelect }
- Dropdown with voice names
- Voice preview button (play sample audio)
- Uses getDefaultVoiceId(tier) from elevenlabs-api-client.ts
- BASIC: 1 voice, PREMIUM: 3, ENTERPRISE+: all
```

### 5. `video-template-selector.tsx`

```
'use client'
Props: { selected, onSelect }
- Two cards: "Cinematic (Path A)" and "Overlay (Path B)"
- Description text for each
- Selected card has accent border
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| HeyGen API not configured (BYOK) | Medium | Show "Configure HeyGen key in BYOK settings" message instead of avatar grid |
| Video quota exhausted | Low | Check quota before form submit, disable button if 0 remaining |

## Todo

- [ ] Create `video-creator-tab.tsx` composing all sub-components
- [ ] Create `video-script-input.tsx`
- [ ] Create `video-avatar-picker.tsx` with tier gating
- [ ] Create `video-voice-picker.tsx` with tier gating
- [ ] Create `video-template-selector.tsx`
- [ ] Wire submit to existing `videoGenerateAction`
- [ ] Verify each file < 200 lines

## Success Criteria

- [ ] Video tab renders form with script + avatar + voice + template
- [ ] Submit dispatches to existing video pipeline
- [ ] Tier-gated avatar/voice selection
- [ ] Error states for missing BYOK keys
- [ ] Disabled button when quota exhausted
