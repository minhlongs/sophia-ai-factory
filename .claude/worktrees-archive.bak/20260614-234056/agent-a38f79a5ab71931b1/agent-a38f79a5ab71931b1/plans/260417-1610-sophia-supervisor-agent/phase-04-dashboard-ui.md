# Phase 04 — Dashboard UI (Workflow Timeline)

## Context Links
- Existing missions UI: `apps/sophia-ai-factory/src/app/dashboard/missions/[id]/` (pattern to mirror)
- Auth wrapper: `@/lib/better-auth-session`
- Tier gate: `@/config/tiers`
- Tailwind CSS 4 + React 19 (Next.js 16 App Router)

## Overview
- Priority: P3 (launchable without UI — but UX critical for solo-platform client)
- Status: ✅ complete
- Two pages: list `/dashboard/workflows` + detail `/dashboard/workflows/[id]`. Timeline component shows 3 steps with status pills + live polling.

## Key Insights
- Polling (not WebSocket) — 3s interval via `useEffect` + `fetch` — KISS, works on CF edge
- Stop polling when status ∈ {completed, failed}
- Reuse `<StatusPill>` pattern from missions UI if present; else inline

## Requirements

### Functional
- List page: table of workflows (prompt truncated, status, created_at, link to detail)
- Detail page: prompt, overall status, 3-step timeline (order, type, status, started_at, completed_at, result snippet)
- New-workflow form: textarea + submit → redirect to detail page
- Auto-refresh every 3s until terminal status
- i18n: Vietnamese + English labels (Sophia handover rule)

### Non-Functional
- No `:any` types, proper TypeScript interfaces
- LCP < 2.5s on detail page
- No `console.log` in production build

## Architecture
```
/dashboard/workflows          (page.tsx — list + new form)
   ├─ server fetch: GET /api/raas/workflows
   └─ <WorkflowListTable>

/dashboard/workflows/[id]     (page.tsx — detail)
   ├─ server fetch initial: GET /api/raas/workflows/[id]
   └─ <WorkflowTimeline> (client component, polls every 3s)
         ├─ <StepRow × 3>
         └─ <FinalResultPanel> (shown when completed)
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/app/dashboard/workflows/page.tsx` (~120 LOC — list + new form SSR)
- `apps/sophia-ai-factory/src/app/dashboard/workflows/[id]/page.tsx` (~80 LOC — SSR shell, renders client timeline)
- `apps/sophia-ai-factory/src/components/workflows/workflow-timeline.tsx` (~160 LOC — client component, polls, renders steps)
- `apps/sophia-ai-factory/src/components/workflows/workflow-step-row.tsx` (~90 LOC — single step row w/ status pill)
- `apps/sophia-ai-factory/src/components/workflows/workflow-new-form.tsx` (~70 LOC — server action form)
- `apps/sophia-ai-factory/src/lib/workflows/workflow-labels.ts` (~40 LOC — i18n vi/en labels for step_type + status)

### Modify
- `apps/sophia-ai-factory/src/components/dashboard/sidebar.tsx` (if exists — add Workflows link; verify via Grep)

### Delete
- none

## Implementation Steps

1. **Labels file** (`workflow-labels.ts`):
   ```ts
   export const STEP_LABELS = {
     create_plan:         { en: 'Create Plan',      vi: 'Lập kế hoạch' },
     execute_development: { en: 'Execute Development', vi: 'Triển khai code' },
     run_tests:           { en: 'Run Tests',        vi: 'Chạy kiểm thử' },
   };
   export const STATUS_LABELS = { queued, blocked, planning, executing, verifying, completed, failed };
   ```

2. **`workflow-step-row.tsx`** — pure display: step_order badge + type label + status pill + durations + optional result snippet (truncated 200 chars). Tailwind classes only.

3. **`workflow-timeline.tsx`** — `"use client"`:
   - `useEffect` polls `GET /api/raas/workflows/[id]` every 3000ms
   - `clearInterval` when status ∈ terminal set
   - Renders 3 `<WorkflowStepRow>` + final result panel

4. **`workflow-new-form.tsx`** — server action:
   ```tsx
   async function createWorkflow(formData: FormData) {
     "use server";
     const prompt = formData.get('prompt') as string;
     const res = await fetch('/api/raas/workflows', {
       method: 'POST', body: JSON.stringify({prompt}), /* auth cookie forwarded */
     });
     const {workflow_id} = await res.json();
     redirect(`/dashboard/workflows/${workflow_id}`);
   }
   ```

5. **Pages** — wrap in `getCurrentUser()` check; 401 → redirect `/login`.

6. **Compile check**: `npm run build` (0 errors).

## Todo List
- [ ] Create labels module (vi+en)
- [ ] Create step-row component
- [ ] Create timeline client component with 3s polling
- [ ] Create new-workflow form (server action)
- [ ] Create list page + detail page
- [ ] Add sidebar link (if pattern exists)
- [ ] Compile → 0 errors
- [ ] Commit `feat(ui): supervisor workflow dashboard + timeline`

## Success Criteria
- Manual E2E: visit `/dashboard/workflows` → submit prompt → redirect to detail → watch 3 steps flip queued→running→completed within 3 min (with stepper running)
- Responsive on mobile (320px min width)
- Bilingual labels render correctly
- Zero TS errors, zero `:any`, zero `console.log`

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Polling wastes edge CPU | LOW | Stop polling on terminal status |
| Server action CSRF | MED | Next.js 16 built-in token validation on Server Actions |
| Missing sidebar pattern | LOW | Grep first; skip if not present |
| i18n drift vs existing translations | LOW | Keep labels module co-located; align with existing `messages/` later |

## Security Considerations
- Server action validates auth session — no client-side-only gate
- `prompt` length bounded by Zod (API re-validates)
- XSS: render prompt + result via React (auto-escape); NEVER `dangerouslySetInnerHTML`

## Integration Test Commands
```bash
cd apps/sophia-ai-factory
npm run build
npm run dev
# Visit: http://localhost:3000/dashboard/workflows
# Submit: "Build a login form with tests"
# Watch timeline advance step-by-step
```

## Ship Stamp (2026-04-17)
- **Files:** workflow-labels.ts (40 LOC, vi+en), workflow-timeline.tsx (160 LOC, client polls 3s), workflow-step-row.tsx (90 LOC), workflow-new-form.tsx (70 LOC), 2 pages (workflows/page.tsx 120 LOC, workflows/[id]/page.tsx 80 LOC)
- **Status:** ✅ Shipped
- **Tests:** 20 new tests (polling logic, status terminal detection, i18n coverage, server action form)
- **Code review:** 1 critical (polling interval on failed request), 3 highs (XSS on prompt display, empty state UX, responsive mobile) fixed → approved
- **Quality:** Bilingual labels, 0 `dangerouslySetInnerHTML`, useEffect cleanup on unmount, Tailwind responsive design

## Next Steps
- Unblocks Phase 05 (E2E Playwright test against this UI — optional in MVP) ✅ DONE
- Parallel to Phase 03 — can develop concurrently since both consume Phase 02 API ✅ DONE
