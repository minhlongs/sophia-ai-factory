# Phase 5 — Workflow Execution (Hours 12-20) [DE-SCOPED]
- Owner: Automated (Inngest) + Customer monitors via Telegram bot
- Dependencies: Phase 4 complete (campaign queued)
- **Decision 2026-07-30:** Video generation pipeline (WAN/FishSpeech/CloudConvert) is operator-secret-gated and violates no-tech doctrine. De-scoped from this handoff.
- **Customer-facing:** Campaign creation via Telegram bot works; deliverable is a completed script/plan (not rendered video).
- **Follow-up:** Video pipeline BYOK ticket to be created for next sprint.

## Requirements (de-scoped)
- Inngest processes script/plan workflow steps (no video render)
- Customer can track progress via Telegram bot

## Steps
1. Inngest receives campaign.created event
2. script step: generates video script/plan (TTS and video rendering skipped)
3. finalize step: updates D1 status = completed, stores deliverable text
4. deliverable: text delivered via Telegram bot

## Telegram Bot Monitoring
- /campaign — lists customer campaigns
- /status [id] — shows progress for specific campaign
- /results — shows completed deliverables (script/plan text)

## Validation
- Inngest dashboard: script step shows success
- D1: campaigns.status = completed for the test campaign
- D1: campaigns.deliverable_text NOT NULL
- Telegram: /results returns deliverable text
- No 404 or auth errors in Telegram bot responses

## Risk: INNGEST_STEP_FAILURE
- Symptom: campaign stuck in queued or processing status
- Fix: Check Inngest worker logs, API key validity

## Risk: SCRIPT_GENERATION_TIMEOUT
- Symptom: script step takes > 5 min, customer thinks it failed
- Fix: Set customer expectation: "Script generation takes 2-5 min"

## Deferred (not in this handoff)
- Video rendering (WAN/FishSpeech/CloudConvert) — requires operator secrets or BYOK migration
- TTS audio generation — same operator secret dependency
- R2 video upload — deferred with video pipeline
