# Phase 12: OpenClaw Skill Integration

## Overview
Create the skill definition for OpenClaw/Claude to interact with the Video Factory programmatically.

## Requirements
- **Skill Definition**: `openclaw/video-factory.yaml`.
- **Commands**: `/script`, `/video`, `/stats`.

## Implementation Steps

1.  **Create `openclaw/` directory**.
2.  **Create `video-factory.yaml`**.
    - Define `name`, `description`.
    - Define `commands`:
        - `generate-script`: Triggers script workflow.
        - `create-video`: Triggers video workflow.
        - `get-stats`: Queries Airtable for ROI.
    - Define `schema` for arguments.

## Verification
- Validate YAML syntax.
- Ensure commands map to the API endpoints/webhooks defined in previous phases.
