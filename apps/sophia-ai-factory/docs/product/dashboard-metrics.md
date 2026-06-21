# Campaign Dashboard Metrics — Product Reference

**Version**: 1.0 | **Date**: 2026-06-20  
**Component**: Campaign Dashboard (`/dashboard/campaigns`)  
**Related Tasks**: #75, #85

---

## Overview

The Campaign Dashboard provides a comprehensive view of all video campaigns in Sophia AI Factory. It includes real-time metrics, status tracking, and interactive campaign cards.

## Metrics Definitions

### Total Campaigns

**Definition**: Count of all campaigns created, regardless of status.

**Data Source**: `campaigns` table aggregate.

**Display**: Integer (e.g., `1,240`)

**Use Case**: Track overall production volume.

---

### Active Campaigns

**Definition**: Campaigns currently processing (script or video generation) or queued.

**Statuses Included**: `queued`, `processing_script`, `processing_video`

**Data Source**: `campaigns` WHERE status IN ('queued', 'processing_script', 'processing_video')

**Display**: Integer (e.g., `24`)

**Use Case**: Monitor current system load and resource utilization.

---

### Completed Campaigns

**Definition**: Campaigns that finished successfully with video output.

**Status Included**: `completed`

**Data Source**: `campaigns` WHERE status = 'completed'

**Display**: Integer (e.g., `1,156`)

**Use Case**: Measure historical production capacity.

---

### Failed Campaigns

**Definition**: Campaigns that terminated with an error and did not produce a video.

**Status Included**: `failed`

**Data Source**: `campaigns` WHERE status = 'failed'

**Display**: Integer (e.g., `8`)

**Use Case**: Track error rate and system reliability.

---

### Success Rate

**Definition**: Percentage of completed campaigns out of total finished campaigns (completed + failed).

**Formula**: 
```
success_rate = (completed / (completed + failed)) × 100
```

**Data Source**: Derived from `completed` and `failed` counts.

**Display**: Percentage with 1 decimal (e.g., `93.5%`)

**Use Case**: Quality indicator of content generation pipeline.

---

## Dashboard Components

### Campaign Metrics Card

Displays the 5 core metrics in a 4-column responsive grid. Each metric card includes:
- Icon (Megaphone, Play, CheckCircle, TrendingUp)
- Label (translated via `dashboard.campaigns.metrics`)
- Formatted value

**Location**: Top of `/dashboard/campaigns` page.

---

### Campaign Filter Tabs

Allows filtering campaigns by status:

| Filter | Statuses Included |
|--------|-------------------|
| All | All campaigns |
| Draft | `draft` |
| Queued | `queued` |
| Processing | `processing_script`, `processing_video` |
| Completed | `completed` |
| Failed | `failed` |

**Implementation**: `CampaignFilterTabs` from `@/forest/dashboard/campaign/campaign-filter-tabs`

**i18n Keys**: `dashboard.campaigns.filters.{filter_key}`

---

### Campaign Grid

Responsive grid layout (1→2→3→4 columns) displaying campaign cards.

**Implementation**: `CampaignGrid` from `@/forest/dashboard/campaign/campaign-grid`

**Empty State**: Shown when no campaigns match current filter.

---

### Campaign Card

Each card displays:
- **Status icon**: Visual indicator (spinner for processing, checkmark for completed, etc.)
- **Title**: `campaign.title` or `campaign.topic`
- **Date**: Created date (formatted via `next-intl`)
- **Status badge**: Localized status label
- **Audience preview**: First 2 lines if present
- **Progress bar**: For processing/queued campaigns
- **Error message**: If campaign failed
- **Video link**: If `video_url` exists
- **Details button**: Opens campaign detail modal

**i18n Keys**:
- `dashboard.campaigns.card.view_campaign` (aria-label)
- `dashboard.campaigns.card.progress`
- `dashboard.campaigns.card.watch_video`
- `dashboard.campaigns.card.view_details`

**Status Labels**: `campaign.status.{status}` (e.g., `campaign.status.completed`)

---

### Campaign Detail Modal

Opened when clicking a campaign card or "Details" button.

**Shows**:
- Full campaign metadata
- Generated script (if available)
- Generated video (if available)
- Error details (if failed)
- Progress indicator (if processing)

**Not Implemented**: Task #85 scope was limited to grid/card/metrics. Modal to be built in follow-up.

---

## Data Flow

1. **Server Component** (`/dashboard/campaigns/page.tsx`):
   - Fetches campaigns via `getCampaigns(userId)`
   - Passes as `initialCampaigns` prop to client wrapper

2. **Client Wrapper** (`CampaignsClientWrapper`):
   - Manages filter state (`CampaignFilter` = 'all' | 'draft' | 'queued' | 'processing' | 'completed' | 'failed')
   - Filters campaigns client-side
   - Renders `CampaignFilterTabs`, `CampaignGrid`, `CampaignDetailModal`

3. **Forest Components** (layer: forest):
   - Reusable, test-covered UI primitives
   - Import path: `@/forest/dashboard/campaign/*`
   - Independent of page layout

---

## Responsive Behavior

| Breakpoint | Grid Columns | Metrics |
|------------|--------------|---------|
| < 640px | 1 col | 1 row (stacked) |
| 640px+ | 2 cols | 2 cols |
| 1024px+ | 3 cols | 4 cols |
| 1280px+ | 4 cols | 4 cols |

---

## Internationalization

All user-facing strings are translated via `next-intl`:

```tsx
const t = useTranslations('dashboard.campaigns');
const tStatus = useTranslations('campaign.status');
```

**Namespaces**:
- `dashboard.campaigns.title`
- `dashboard.campaigns.subtitle`
- `dashboard.campaigns.card.*`
- `dashboard.campaigns.filters.*`
- `dashboard.campaigns.metrics.*`
- `campaign.status.*` (for status labels: `draft`, `queued`, `processing_script`, `processing_video`, `completed`, `failed`)

**Verified**: Both `messages/en.json` and `messages/vi.json` contain all required keys as of 2026-06-20.

---

## Accessibility

- Campaign cards: `role="button"`, `tabIndex={0}`, `aria-label`
- Grid: `aria-label` on wrapper
- Filter tabs: `aria-label` group
- Status badges: Color + text (no color-only meaning)
- Keyboard navigation: Enter/Space to select card

---

## Testing

**Unit Tests**: 28 passing tests across 6 test files:

```
✓ src/forest/dashboard/campaign/__tests__/campaign-card.test.tsx
✓ src/forest/dashboard/campaign/__tests__/campaign-grid.test.tsx
✓ src/forest/dashboard/campaign/__tests__/campaign-metrics-card.test.tsx
✓ src/forest/dashboard/campaign/__tests__/campaign-filter-tabs.test.tsx
✓ src/forest/dashboard/campaign/__tests__/campaign-progress-bar.test.tsx
✓ src/forest/dashboard/campaign/__tests__/campaign-status-badge.test.tsx
```

**Coverage**: Props rendering, state changes, i18n fallbacks, accessibility attributes.

---

## Build Status

✅ **Production build succeeds** with 0 TypeScript errors.

```bash
npm run build
# ✓ Compiled successfully in 28.1s
# ✓ Generating static pages (198/198)
# ✓ Upload complete (83 source maps)
```

---

## Implementation Notes

- Forest components use Material Design 3 semantic tokens (`surface-container-lowest`, `outline-variant`, `primary`)
- Progress bar uses `@/seed/components/ui/progress` in app-local duplicate, but forest uses custom `CampaignProgressBar`
- Campaign statuses defined in `seed/types.ts`: `draft`, `queued`, `processing_script`, `processing_video`, `completed`, `failed`
- Real data integration: `initialCampaigns` prop passed from server component (no mock data in production)

---

## Gaps & Future Work

- Campaign detail modal not yet implemented (card → modal link currently no-op or placeholder)
- Metrics API server action not yet implemented (currently relies on client-side aggregation from campaigns list)
- Export to CSV functionality for campaigns list
- Bulk actions (select multiple campaigns, delete, archive)
- Sorting by columns (date, status, title)

---

## Files Changed in This Implementation

### New Components (Forest Layer)

- `src/forest/dashboard/campaign/campaign-card.tsx`
- `src/forest/dashboard/campaign/campaign-grid.tsx`
- `src/forest/dashboard/campaign/campaign-metrics-card.tsx`
- `src/forest/dashboard/campaign/campaign-filter-tabs.tsx`
- `src/forest/dashboard/campaign/campaign-progress-bar.tsx`
- `src/forest/dashboard/campaign/campaign-status-badge.tsx`
- `src/forest/dashboard/campaign/types.ts`
- `src/forest/dashboard/campaign/index.ts`

### Integration

- `src/app/[locale]/dashboard/components/campaigns-client-wrapper.tsx` (uses forest components)

### Tests

- `src/forest/dashboard/campaign/__tests__/*.test.tsx` (6 files, 28 tests)

---

**Last Updated**: 2026-06-20  
**Status**: ✅ Implementation Complete (Tasks #75, #85)
