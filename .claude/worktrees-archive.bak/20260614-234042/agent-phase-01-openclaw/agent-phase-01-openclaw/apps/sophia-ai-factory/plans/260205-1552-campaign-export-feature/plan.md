---
title: "Campaign Export Feature"
description: "Implement JSON and CSV export capabilities for campaigns with filtering options."
status: completed
priority: P2
effort: 3h
branch: master
tags: [feature, export, csv, json, campaigns]
created: 2026-02-05
---

# Campaign Export Feature Plan

## 1. Overview
Implement a feature to allow users to export their campaign data in CSV and JSON formats from the dashboard. This includes filtering options for status and date ranges.

## 2. Requirements
- **Export Formats**: JSON and CSV.
- **UI**: Export buttons (Dropdown or separate buttons) in `CampaignList`.
- **Filtering**:
  - Status: `queued`, `processing_script`, `processing_video`, `completed`, `failed`.
  - Date Range: Start Date and End Date.
- **Data Security**: Exclude sensitive internal fields (e.g., `user_id` if not admin, raw internal flags).
- **File Naming**: `campaigns_export_{timestamp}.{ext}`.

## 3. Architecture

### Server Action: `exportCampaigns`
- **Location**: `src/app/actions/campaigns.ts` (or a new file `src/app/actions/export.ts` if it grows).
- **Input**: `status` (optional), `startDate` (optional), `endDate` (optional), `format` ("json" | "csv").
- **Logic**:
  1. Authenticate user.
  2. Query `campaigns` table with filters.
  3. Map data to clean DTOs.
  4. Convert to CSV string or JSON string.
  5. Return base64 string or raw string for client download.

### Client Component: `CampaignExportControl`
- **Location**: `src/app/dashboard/components/campaign-export-control.tsx`
- **Props**: None (can handle its own state or accept filters from parent).
- **UI**:
  - Button "Export" opening a Dialog or Popover.
  - Date Range Picker (using standard HTML date inputs or existing UI components).
  - Status Dropdown/Select.
  - Buttons for "Download JSON" and "Download CSV".

### Integration
- Add `CampaignExportControl` to `src/app/dashboard/components/campaign-list.tsx` header area.

## 4. Implementation Steps

### Phase 1: Server Side (Data & Logic)
1.  Create `src/lib/export-utils.ts` for CSV conversion helper (if not exists).
2.  Create `exportCampaigns` server action in `src/app/actions/export.ts`.
    -   Validate session.
    -   Build Supabase query with filters.
    -   Format data.

### Phase 2: Client Side (UI)
1.  Create `CampaignExportControl` component.
    -   Add Filter inputs.
    -   Add Export buttons.
2.  Integrate into `CampaignList`.

### Phase 3: Integration & Testing
1.  Wire up server action to client component.
2.  Test CSV and JSON downloads.
3.  Verify filters work correctly.
4.  Verify data privacy (no sensitive fields).

## 5. Data Format (Clean DTO)

```typescript
interface CampaignExportDTO {
  id: string;
  title: string;
  topic: string;
  audience: string;
  status: string;
  progress: number;
  created_at: string;
  video_url?: string;
  // Exclude: user_id, internal flags
}
```

## 6. Unresolved Questions
- Do we need to export script content? -> *Assumption: No, too large for summary export, maybe optional later. For now, keep it simple (metadata only).*
