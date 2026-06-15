# Phase 11: n8n Workflow Definitions

## Overview
Define the automation workflows that power the video factory. These will be exported as JSON files for import into n8n.

## Workflows
1.  **Script Generator (`workflows/script-generator.json`)**
    - Trigger: Webhook (from App).
    - Action: OpenRouter (LLM) to generate script.
    - Action: Airtable (Create Record).
2.  **Voice Generator (`workflows/voice-generator.json`)**
    - Trigger: Airtable (New Script Record).
    - Action: ElevenLabs API (Text-to-Speech).
    - Action: Airtable (Update Record with Audio URL).
3.  **Video Generator (`workflows/video-generator.json`)**
    - Trigger: Airtable (Audio Ready).
    - Action: D-ID/Pictory API.
    - Action: Airtable (Update Record with Video URL).
4.  **Publish Workflow (`workflows/publish-workflow.json`)**
    - Trigger: User Approval (Webhook).
    - Action: YouTube/TikTok API.

## Implementation Steps

1.  **Create `workflows/` directory**.
2.  **Create JSON files**.
    - Since we cannot run n8n GUI, we will create valid JSON structures representing the node graph.
    - Use standard n8n node types: `n8n-nodes-base.webhook`, `n8n-nodes-base.httpRequest`, `n8n-nodes-base.airtable`.

## Verification
- JSON syntax check.
- Verify node connections (logic flow).
