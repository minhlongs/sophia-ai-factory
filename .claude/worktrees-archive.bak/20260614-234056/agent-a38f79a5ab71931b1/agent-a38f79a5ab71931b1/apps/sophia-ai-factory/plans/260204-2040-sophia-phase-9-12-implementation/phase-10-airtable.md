# Phase 10: Airtable Integration

## Overview
Implement the persistence layer using Airtable. This allows storing scripts, video metadata, and affiliate program data.

## Requirements
- **Package**: `airtable`.
- **Tables**: `Scripts`, `Videos`, `Affiliates`.
- **Env Vars**: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`.

## Files to Create
- `src/lib/airtable.ts`: Core client wrapper.

## Implementation Steps

1.  **Install Dependencies**
    - `npm install airtable`
    - `npm install -D @types/airtable` (if available, or generic).

2.  **Define Interfaces (in `src/lib/airtable.ts` or `types`)**
    - `ScriptRecord`: { topic, content, status, tier }.
    - `VideoRecord`: { scriptId, videoUrl, platform, stats }.
    - `AffiliateRecord`: { programName, commission, link, tier }.

3.  **Implement `src/lib/airtable.ts`**
    - Initialize Airtable base.
    - `createScript(data: ScriptData)`
    - `getScript(id: string)`
    - `updateVideoStatus(id: string, status: string)`
    - `getAffiliates(tier: Tier)`: Filtered by tier.

## Verification
- Create a test script in Airtable via the new library.
- Retrieve it to verify.
