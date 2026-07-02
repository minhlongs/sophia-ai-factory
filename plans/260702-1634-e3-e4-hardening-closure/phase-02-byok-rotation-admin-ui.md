---
phase: 2
title: "BYOK Rotation Admin UI"
status: completed
effort: "~2-3 hr"
priority: P1
---

# Phase 2: BYOK Rotation Admin UI

## Overview

Build a full admin page at `/dashboard/admin/byok-rotation` with rotation trigger button, version history table, and status log. The backend API (`POST /api/admin/keys/rotate`) already exists — this phase builds the frontend.

## Requirements

- Functional: trigger rotation via existing API with confirm dialog + toast
- Functional: display key version history table from `key_versions` D1 table
- Functional: show recent rotation events from audit log
- Non-functional: admin tier gate (matching existing admin page pattern)
- Non-functional: responsive, bilingual (VN + EN)

## Architecture

```
Admin page (page.tsx)
  ├── RotationButton (client component)
  │   ├── POST /api/admin/keys/rotate → { keyVersion, oldVersion }
  │   ├── Confirm dialog before firing
  │   └── Toast on success/error
  ├── VersionTable (client component)
  │   └── Loads key_versions via server component data fetch
  └── StatusLog (client component)
      └── Recent rotation audit events
```

## Related Code Files

- Create: `src/app/[locale]/dashboard/admin/byok-rotation/page.tsx`
- Create: `src/app/[locale]/dashboard/admin/byok-rotation/components/rotation-button.tsx`
- Create: `src/app/[locale]/dashboard/admin/byok-rotation/components/version-table.tsx`
- Create: `src/app/[locale]/dashboard/admin/byok-rotation/components/status-log.tsx`
- Read (no modify): `src/app/api/admin/keys/rotate/route.ts` (existing API contract)

## TDD Process

1. **Write tests first** for the admin page components before implementation:
   - Rotation button: renders, shows confirm dialog on click, calls API, shows toast
   - Version table: renders rows from mock data, handles empty state, loading skeleton
   - Status log: renders entries, handles empty/loading states
2. **Then implement** components and page
3. **Verify** tests pass against real implementation

## Implementation Steps

1. **Create server data loader** (in page.tsx):
   - [x] Query `key_versions` table (ordered by `created_at DESC`)
   - [x] Query audit events with `action LIKE 'KEY_ROTATION.%'` (limited to 20)
2. **Create `rotation-button.tsx`:**
   - [x] "Rotate Encryption Keys" button with red accent (destructive action)
   - [x] Confirm dialog: "This will rotate all encryption keys and re-encrypt all stored credentials. Existing decryption will continue to work for 7 days (dual-decrypt window)." — bilingual VN/EN
   - [x] Calls `fetch('/api/admin/keys/rotate', { method: 'POST' })`
   - [x] Toast on success (green): "Rotation triggered — re-encrypt job queued"
   - [x] Toast on error (red): error message from API
3. **Create `version-table.tsx`:**
   - [x] Table columns: Version #, Created, Status
   - [x] Empty state: "No key versions found"
   - [x] Highlight current active version
4. **Create `status-log.tsx`:**
   - [x] Table: Timestamp, Action, Details
   - [x] Empty state: "No rotation events yet"
5. **Wire into admin sidebar navigation:**
   - [x] Add "Key Rotation" link to admin sidebar with RotateCw icon

## Success Criteria

- [x] Tests pass for all new components (loading, empty, error, success states)
- [x] `/dashboard/admin/byok-rotation` accessible to admin users only
- [x] "Rotate Encryption Keys" button works end-to-end
- [x] Version history table renders correctly with real data
- [x] Status log shows recent rotation events
- [x] Toast notifications appear on success/error
- [x] Bilingual labels (Vietnamese + English)
- [x] `npm run build` passes with 0 errors

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rotation triggered accidentally | High | Confirm dialog + destructive button styling |
| Non-admin accesses page | Medium | Tier gate middleware (existing pattern from other admin pages) |
| Version table too many rows | Low | Limit to latest 20 versions |
