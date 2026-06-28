# Phase 5: Frontend Integration

## Overview
**Priority:** Medium
**Status:** Pending
**Description:** Update the user dashboard to allow manual campaign creation and view real-time status of running campaigns.

## Context Links
- [Main Plan](./plan.md)

## Requirements
- UI for "Create Campaign" (Manual trigger)
- List view of Campaigns with Status Badges
- Real-time updates (via polling or Supabase Realtime)

## Architecture
- **Page:** `src/app/dashboard/campaigns/page.tsx`
- **Component:** `CampaignList.tsx`, `CreateCampaignDialog.tsx`
- **State:** React Query + Supabase Realtime

## Related Code Files
- [NEW] `src/app/dashboard/campaigns/page.tsx`
- [NEW] `src/app/dashboard/components/campaign-list.tsx`
- [UPDATE] `src/app/dashboard/components/create-project-form.tsx` (or new component)

## Implementation Steps

1.  **Campaign Service (Frontend)**
    - Create `src/lib/services/campaign-service.ts`
    - Methods: `getCampaigns`, `createCampaign` (calls server action)

2.  **Server Action**
    - Create `src/app/actions/campaigns.ts`
    - `createCampaign`: Validates input, inserts to DB, triggers Inngest event

3.  **Campaign List UI**
    - Fetch campaigns using TanStack Query
    - Display status badges (`processing` = spinner, `completed` = green check)
    - Subscribe to Supabase Realtime changes on `campaigns` table to refetch/update list

4.  **Create Campaign UI**
    - Simple form: Topic, Audience
    - Submit -> Call Server Action -> Optimistic Update / Invalidate Query

## Success Criteria
- [ ] User can create campaign from dashboard
- [ ] List updates automatically when status changes
- [ ] Video URL displayed when complete

## Risk Assessment
- **Risk:** Realtime connection limits.
- **Mitigation:** Fallback to polling if Realtime fails or for simpler implementation initially.

## Security Considerations
- Ensure Server Actions validate authentication and rate limits.
