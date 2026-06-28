---
phase: 7
title: "i18n Keys + Tests"
status: pending
priority: medium
---

# Phase 07 — i18n Keys + Tests

## Context

- i18n: `messages/en.json` (2639 lines) + `messages/vi.json`
- Parity test: `src/__tests__/messages-parity.test.ts` — enforces key sync
- Existing test patterns: `src/app/actions/__tests__/video-generate-action.test.ts`

## Files to Modify

1. `messages/en.json` — Add `creativeStudio` namespace
2. `messages/vi.json` — Add matching Vietnamese translations
3. `messages/en.json` — Add `sidebar.creative_studio` key under `dashboard` namespace

## Files to Create

1. `src/app/actions/__tests__/image-generate-action.test.ts` — Unit tests for image action
2. `src/app/actions/__tests__/tts-generate-action.test.ts` — Unit tests for TTS action
3. `src/app/api/v1/creative-studio/__tests__/images-route.test.ts` — API route tests

## i18n Keys to Add

### `en.json` additions

```json
{
  "dashboard": {
    "sidebar": {
      "creative_studio": "Creative Studio"
    }
  },
  "creativeStudio": {
    "title": "Creative Studio",
    "subtitle": "Create videos, images, and audio with AI",
    "tabs": {
      "video": "Video Creator",
      "image": "Image Generator",
      "audio": "Audio Studio",
      "templates": "Template Library",
      "brand": "Brand Assets"
    },
    "video": {
      "scriptLabel": "Video Script",
      "scriptPlaceholder": "Describe your video content...",
      "avatarLabel": "Select Avatar",
      "voiceLabel": "Select Voice",
      "templateLabel": "Video Template",
      "templateCinematic": "Cinematic (Path A)",
      "templateOverlay": "Overlay (Path B)",
      "generateButton": "Generate Video",
      "generating": "Generating...",
      "quotaExhausted": "Video quota reached. Upgrade your plan.",
      "configureKeys": "Configure HeyGen and ElevenLabs keys in BYOK settings to create videos.",
      "pipelineNotReady": "Video pipeline is not configured. Please set up required API keys."
    },
    "image": {
      "promptLabel": "Image Prompt",
      "promptPlaceholder": "Describe the image you want to create...",
      "negativePromptLabel": "Negative Prompt (optional)",
      "modelLabel": "AI Model",
      "aspectRatioLabel": "Aspect Ratio",
      "generateButton": "Generate Image",
      "generating": "Generating image...",
      "gallery": "Generated Images",
      "emptyGallery": "No images yet. Generate your first image!",
      "download": "Download",
      "useInCampaign": "Use in Campaign",
      "modelLocked": "Upgrade to unlock {model}",
      "configureKeys": "Configure MuAPI key in BYOK settings to generate images."
    },
    "audio": {
      "textLabel": "Text for Voiceover",
      "textPlaceholder": "Enter text for voiceover...",
      "voiceLabel": "Voice",
      "voicePreview": "Preview",
      "generateButton": "Generate Audio",
      "generating": "Generating audio...",
      "download": "Download",
      "useInVideo": "Use in Video",
      "configureKeys": "Configure ElevenLabs key in BYOK settings to generate audio."
    },
    "templates": {
      "title": "Template Library",
      "campaignTemplates": "Campaign Templates",
      "videoTemplates": "Video Templates",
      "useTemplate": "Use Template",
      "locked": "Upgrade to unlock",
      "filterAll": "All",
      "filterCampaign": "Campaign",
      "filterVideo": "Video"
    },
    "brand": {
      "title": "Brand Assets",
      "logo": "Logo",
      "colors": "Colors",
      "fonts": "Fonts",
      "editBrandKit": "Edit Brand Kit",
      "uploadAsset": "Upload Asset",
      "emptyState": "Set up your brand kit to use your logo, colors, and fonts in all creative assets.",
      "setupLink": "Set Up Brand Kit",
      "copied": "Copied!"
    },
    "errors": {
      "authRequired": "Please sign in to use Creative Studio.",
      "generationFailed": "Generation failed. Please try again.",
      "networkError": "Network error. Check your connection."
    }
  }
}
```

### `vi.json` additions (matching keys)

Same structure with Vietnamese translations. Key examples:
- `title`: "Studio Sáng Tạo"
- `subtitle`: "Tạo video, hình ảnh và âm thanh bằng AI"
- `tabs.video`: "Tạo Video"
- `tabs.image`: "Tạo Hình Ảnh"
- `tabs.audio`: "Studio Âm Thanh"
- `tabs.templates`: "Thư Viện Mẫu"
- `tabs.brand`: "Tài Sản Thương Hiệu"

## Test Coverage

### 1. `image-generate-action.test.ts`

```
- Test auth guard (no user -> error)
- Test Zod validation (missing prompt, invalid model, bad aspect ratio)
- Test tier gating (BASIC user + midjourney-v7 -> rejected)
- Test success path (mock MuAPI -> returns jobId)
- Test BYOK key missing -> clear error
```

### 2. `tts-generate-action.test.ts`

```
- Test auth guard
- Test Zod validation (empty text, text too long)
- Test voice tier gating
- Test success path (mock ElevenLabs -> returns audio URL)
- Test BYOK key missing -> clear error
```

### 3. `images-route.test.ts`

```
- Test GET: returns user's images (not other users')
- Test GET: empty array for new user
- Test status poll: returns current status
- Test IDOR: user A cannot access user B's image
```

## Todo

- [ ] Add `creativeStudio` namespace to `en.json`
- [ ] Add matching keys to `vi.json`
- [ ] Add `sidebar.creative_studio` to both files
- [ ] Run messages-parity test to verify sync
- [ ] Create `image-generate-action.test.ts`
- [ ] Create `tts-generate-action.test.ts`
- [ ] Create `images-route.test.ts`
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run build` — 0 errors

## Success Criteria

- [ ] en.json + vi.json have identical key trees for `creativeStudio` namespace
- [ ] `messages-parity.test.ts` passes
- [ ] Server action tests cover auth, validation, tier gating, success, error
- [ ] API route tests cover IDOR protection
- [ ] `npm run build` passes
- [ ] `npm test` passes (all existing + new tests)
