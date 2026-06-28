# Final Go-Live MVP — 260502-1900

## Status: IN PROGRESS

## Phases

| # | Feature | Status |
|---|---------|--------|
| A | Refund admin workflow (migrations 0048) | pending |
| B | HeyGen webhook URL in setup wizard | pending |
| C | Admin manual actions console (mig 0049, 0050) | pending |
| D | DB-stored SKU prices (mig 0051) + pricing resolver | pending |
| E | Per-user email branding | pending |
| F | Onboarding help page /dashboard/help/getting-started | pending |
| G | Go-live checklist /dashboard/admin/go-live-checklist | pending |

## Migration order
0048 → refund_requests  
0049 → user.status (active/paused/banned)  
0050 → admin_audit_log  
0051 → pricing_overrides  

## Key patterns
- DB: `createServerClient()` (sync) from `@/lib/db/client`
- Auth: `getCurrentUser()` / `requireAdmin(request)`
- Admin 403: requireAdmin returns NextResponse on failure
- Bilingual: all UI Vi+En
- Zero :any, zero console.log
- Files ≤200 LOC
