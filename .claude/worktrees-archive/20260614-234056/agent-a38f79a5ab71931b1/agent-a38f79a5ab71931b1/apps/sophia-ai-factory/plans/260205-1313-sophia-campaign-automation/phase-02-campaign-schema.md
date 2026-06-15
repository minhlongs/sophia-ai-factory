# Phase 2: Database Schema & Campaign Entities

## Overview
**Priority:** High
**Status:** Pending
**Description:** Design and implement the database schema for Campaigns and update the TypeScript definitions. This ensures we have a robust state machine for tracking the multi-step generation process.

## Context Links
- [Main Plan](./plan.md)
- [Research Report](./reports/researcher-01-campaign-automation-patterns.md)

## Requirements
- Create `campaigns` table in Supabase
- Define `campaign_status` enum
- Generate Typescript types from Supabase
- Create Zod validation schemas for API inputs

## Architecture
- **Database:** Supabase (PostgreSQL)
- **Schema:**
    - `campaigns` table linked to `auth.users`
    - `campaign_status` enum for state management
- **Types:** Updated `database.types.ts` and `src/types/index.ts`

## Related Code Files
- [NEW] `supabase/migrations/[timestamp]_create_campaigns_table.sql`
- [UPDATE] `src/lib/supabase/types.ts`
- [UPDATE] `src/types/index.ts`
- [NEW] `src/lib/campaigns/validation.ts`

## Implementation Steps

1.  **Create SQL Migration**
    - Define `campaign_status` enum: `draft`, `queued`, `processing_script`, `processing_video`, `completed`, `failed`
    - Define `campaigns` table with:
        - `id`, `user_id`, `title`, `topic`, `audience`
        - `status`, `progress`
        - `script_content` (jsonb), `video_url`, `thumbnail_url`
        - `created_at`, `updated_at`
    - Add RLS policies (Users can only view/create their own campaigns)

2.  **Apply Migration**
    - Run Supabase migration locally or via dashboard SQL editor (if CLI not configured for local dev)

3.  **Update Types**
    - Manually update `src/lib/supabase/types.ts` to reflect the new table (or run type gen if available)
    - Update `src/types/index.ts` to export `Campaign` interface

4.  **Create Validation Schemas**
    - Create `src/lib/campaigns/validation.ts`
    - Define `createCampaignSchema` using Zod

## Success Criteria
- [ ] Table `campaigns` exists in Supabase
- [ ] RLS policies enforce user isolation
- [ ] TypeScript types match the DB schema
- [ ] Zod schema validates input correctly

## Risk Assessment
- **Risk:** JSONB structure for `script_content` might evolve.
- **Mitigation:** Keep the JSONB flexible but define TypeScript interfaces for expected structure to ensure type safety in code.

## Security Considerations
- Enable Row Level Security (RLS) immediately.
- Only authenticated users should create campaigns.
