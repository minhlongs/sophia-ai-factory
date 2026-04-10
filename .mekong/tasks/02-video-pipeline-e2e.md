# Mission 02: Video Generation Pipeline E2E

**Priority:** P0 — CRITICAL
**Stage:** Zero → PSF
**Layer:** Engineering
**Target:** Working video generation from prompt to download
**MCU Budget:** 30

## Objective

Prove the full video generation pipeline works end-to-end:
User prompt → MuAPI/HeyGen → Video URL → Dashboard preview → Download

## Steps

1. Test MuAPI integration: submit job → poll status → get result URL
2. Test HeyGen integration: avatar video generation with user's key
3. Create campaign → assign video template → generate → preview
4. Store result URL in D1 for dashboard display
5. Add download button on campaign results page

## Success Criteria

- [ ] MuAPI: text-to-video (Kling 3.0) generates successfully
- [ ] HeyGen: avatar video with custom script
- [ ] Campaign dashboard shows generated video
- [ ] User can download/share video URL
- [ ] Error handling: clear message when API key missing/invalid

## Agent Assignment

- **CTO:** Integration testing + error handling
- **Product:** UX flow for video preview/download
