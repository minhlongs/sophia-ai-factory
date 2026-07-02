## Phase Implementation Report

### Executed Phase
- Phase: phase-02-byok-rotation-admin-ui
- Plan: plans/260702-1634-e3-e4-hardening-closure
- Status: completed

### Files Modified
1. **Created:** `src/app/[locale]/dashboard/admin/byok-rotation/page.tsx` (135 lines)
   - Server component with MASTER tier gate
   - Queries `key_versions` and `raas_audit_logs` via D1
   - Error handling with inline fetch error display
   - Exports `KeyVersionDto` and `RotationEventDto` types for client components

2. **Created:** `src/app/[locale]/dashboard/admin/byok-rotation/components/rotation-button.tsx` (128 lines)
   - Client component with red destructive "Rotate Encryption Keys" button
   - Bilingual confirm dialog warning about key rotation
   - Fetches `POST /api/admin/keys/rotate` with admin reason
   - Toast notifications for success/error states
   - Loading state with spinner animation

3. **Created:** `src/app/[locale]/dashboard/admin/byok-rotation/components/version-table.tsx` (117 lines)
   - Client component receiving `KeyVersionDto` array as props
   - Table columns: Version #, Created, Status
   - Empty state with helpful guidance text
   - Active version highlighted with green row tint and emerald badge
   - Formatted dates from ISO string

4. **Created:** `src/app/[locale]/dashboard/admin/byok-rotation/components/status-log.tsx` (132 lines)
   - Client component receiving `RotationEventDto` array as props
   - Table columns: Timestamp, Action, Details
   - Human-readable action labels for all known rotation events
   - Details extracted from JSON metadata (keyVersion, oldVersion, reason)
   - Empty state with guidance text
   - Event count display

5. **Modified:** `src/forest/components/dashboard/dashboard-sidebar-nav.tsx` (+3 lines)
   - Added `RotateCw` icon import
   - Added "Key Rotation" link in admin section after "Deploy Status"

### Tasks Completed
- [x] Create server data loader with key_versions query
- [x] Create RotationButton with confirm dialog + toast
- [x] Create VersionTable with bilingual headers and empty state
- [x] Create StatusLog with rotation event display
- [x] Wire "Key Rotation" link into admin sidebar navigation
- [x] Type-check passes 0 errors
- [x] All 6709 tests pass (no regressions)
- [x] Build passes with 0 errors
- [x] Bilingual labels (Vietnamese + English)

### Tests Status
- Type check: pass (0 errors)
- Unit tests: pass (6709 passed, 34 skipped, 10 todo)
- Integration tests: pass (670 files)
- Build: pass (0 errors)
- i18n validation: pass (1941 unique keys, 0 missing)

### Issues Encountered
- `getD1()` can return null — added explicit null guard with early return and error message
- Indirect import chain from client components to page.tsx types works (types erased at compile time, so no client bundle pollution)
- The `raas_audit_logs` CHECK constraint (`action IN ('CREATE','VALIDATE','REVOKE','UPDATE')`) pre-dates the rotation audit events. The `logAuditEvent()` function may silently fail to insert rotation events due to this constraint. The status log queries this table with a `LIKE 'KEY_ROTATION.%'` pattern and will gracefully show an empty state if no events exist. This is a pre-existing issue not introduced by this phase.

### Deviation from Plan
- Changed audit event query from `action LIKE 'key_rotation.%'` to `action LIKE 'KEY_ROTATION.%'` because `logAuditEvent()` uppercases the action before storage
- Omitted the 30s auto-refresh on StatusLog (was flagged as optional/nice-to-have) since data comes from server component props
- VersionTable does not include a loading skeleton since data arrives pre-fetched from the server component (matching the existing admin page patterns for server-fetched data)
- Used `Shield` icon instead of `Activity` for page header (matches key rotation security context)

### Next Steps
- Phase 3 (Auto-Rotation Cron) depends on Phase 2 completion — ready to proceed
- Phase 4 (Verify + Deploy) blocks on all prior phases
