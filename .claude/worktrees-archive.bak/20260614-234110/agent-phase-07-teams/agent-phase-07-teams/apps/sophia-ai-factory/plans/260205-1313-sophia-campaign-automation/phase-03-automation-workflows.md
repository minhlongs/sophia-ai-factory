# Phase 3: Automation Workflows

## Overview
**Priority:** Critical
**Status:** Pending
**Description:** Implement the core business logic for automated campaign generation using Inngest functions. This connects the AI generation steps into a reliable, retriable workflow.

## Context Links
- [Main Plan](./plan.md)
- [Research Report](./reports/researcher-01-campaign-automation-patterns.md)

## Requirements
- Create `generate-campaign` Inngest function
- Implement `generateScript` step
- Implement `generateVoice/Video` step (Placeholder/Mock if APIs not ready)
- Update campaign status in DB at each step

## Architecture
- **Trigger:** Event `campaign.created`
- **Steps:**
    1.  Update Status -> `processing_script`
    2.  `generateScript` (AI Call)
    3.  Save Script & Update Status -> `processing_video`
    4.  `generateVideo` (AI Call)
    5.  Save Video & Update Status -> `completed`
    6.  Notify User

## Related Code Files
- [NEW] `src/lib/inngest/functions/generate-campaign.ts`
- [NEW] `src/lib/ai/script-generator.ts` (Refactor existing logic if needed)
- [NEW] `src/lib/ai/video-generator.ts`

## Implementation Steps

1.  **Define Event Schema**
    - Define `campaign.created` event type in Inngest client

2.  **Create Inngest Function Skeleton**
    - Create `src/lib/inngest/functions/generate-campaign.ts`
    - Setup steps structure

3.  **Implement Script Step**
    - Move script generation logic from `actions/automation.ts` to a reusable service
    - Call service inside Inngest step
    - Update DB with result

4.  **Implement Video Step (Mock/Real)**
    - If video API available, integrate it.
    - If not, use a mock delay to simulate processing.
    - Update DB with result

5.  **Error Handling**
    - Add `onFailure` handler to update DB status to `failed` and log error

## Success Criteria
- [ ] Function runs through all steps successfully
- [ ] Database reflects correct status changes
- [ ] Retries work on transient failures
- [ ] Final state is `completed` with data populated

## Risk Assessment
- **Risk:** AI API timeouts.
- **Mitigation:** Configure Inngest step timeouts and retries appropriately. Use `step.run` to checkpoint progress.

## Security Considerations
- Ensure API keys for AI services are secure.
- Validate campaign ownership before processing (though event should be trusted).
