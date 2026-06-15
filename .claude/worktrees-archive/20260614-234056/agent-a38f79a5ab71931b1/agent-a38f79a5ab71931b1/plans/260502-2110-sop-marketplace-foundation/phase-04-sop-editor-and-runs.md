# Phase 04 — SOP Editor + Run History

## Context Links

- Plan: [./plan.md](./plan.md)
- Depends: Phase 02 (run engine + sop_runs table), Phase 03 (install API exists)
- Existing mission detail pattern: `apps/sophia-ai-factory/src/app/[locale]/dashboard/missions/[id]/page.tsx`
- Existing campaigns detail: `.../campaigns/[id]/page.tsx`

## Overview

- Priority: P1
- Status: pending
- Effort: 16h
- Description: User-facing pages to manage installed SOPs — list, detail with run history, edit playbook Markdown, view individual run with mission breakdown timeline. Day-1 editor = simple textarea; live-preview upgrade via `@uiw/react-md-editor` (~50KB) included in this phase.

## Key Insights

- Editor scope = `playbook.md` only Day-1; agents.yaml + output.schema deferred (advanced users, Phase 3 hooks).
- Save → PATCH `/api/sop/installations/[id]/customizations` writes to `customizations.playbook_md_override`.
- Run timeline reuses mission status pattern — each step shows command name + status + duration + link to `/dashboard/missions/[missionId]`.
- "Run Now" button triggers manual run via `POST /api/sop/installations/[id]/run` → calls `runSop()` with trigger='manual'.
- Webhook URL surfaced on installation detail with copy button + "Show secret" gated by re-auth (or simply "Regenerate secret" action returning new value once).

## Requirements

### Functional
- F1: `/dashboard/sops` list — table of user's installations with name, schedule, last run, run count, enabled toggle, link to detail.
- F2: `/dashboard/sops/[id]` detail — header (name + status badge), tabs: Overview / Runs / Edit / Webhook.
  - Overview: schedule, next-run-at, last-run summary, "Run Now" button, delete.
  - Runs: paginated list of `sop_runs`, each clickable.
  - Edit: Markdown editor for playbook (live preview), Save button.
  - Webhook: HMAC URL + "Regenerate secret" action.
- F3: `/dashboard/sops/[id]/runs/[runId]` — run detail with timeline of mission steps.
- F4: APIs:
  - `GET /api/sop/installations` — list user's installs
  - `GET /api/sop/installations/[id]` — detail incl runs (paginated)
  - `PATCH /api/sop/installations/[id]/customizations` — save playbook override (Zod validate length ≤32KB)
  - `POST /api/sop/installations/[id]/run` — trigger manual run (returns `{runId}`)
  - `POST /api/sop/installations/[id]/regen-secret` — rotate webhookSecret
  - `GET /api/sop/runs/[runId]` — single run + missions

### Non-Functional
- All files ≤200 LOC; tabs may be split into 4 client components.
- Markdown editor lazy-loaded (`next/dynamic` `ssr:false`) to avoid SSR bloat.
- Run detail polls every 3s if status='running' until terminal.
- Vi+En labels.

## Architecture

```
/dashboard/sops                       ← list (server)
/dashboard/sops/[id]                  ← detail (server) + 4 tab clients
   tabs: <OverviewTab/> <RunsTab/> <EditTab/> <WebhookTab/>
   actions: runNowAction, savePlaybookAction, regenSecretAction, deleteAction
/dashboard/sops/[id]/runs/[runId]     ← run detail (server) + <RunTimeline/> (client polls)

POST /api/sop/installations/[id]/run
  → ctx.waitUntil(runSop({installationId, trigger:'manual'}))
  → return {runId} immediately
```

## Related Code Files

### Create — Pages
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx` — list
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/[id]/page.tsx` — detail wrapper
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/[id]/runs/[runId]/page.tsx` — run detail
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/loading.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/[id]/loading.tsx`

### Create — Components
- `apps/sophia-ai-factory/src/components/sop/installation-list-table.tsx` (client; uses existing `<Table>` primitive)
- `apps/sophia-ai-factory/src/components/sop/installation-overview-tab.tsx` (client)
- `apps/sophia-ai-factory/src/components/sop/installation-runs-tab.tsx` (client)
- `apps/sophia-ai-factory/src/components/sop/installation-edit-tab.tsx` (client; lazy-loads MD editor)
- `apps/sophia-ai-factory/src/components/sop/installation-webhook-tab.tsx` (client)
- `apps/sophia-ai-factory/src/components/sop/sop-run-timeline.tsx` (client; polls)
- `apps/sophia-ai-factory/src/components/sop/run-status-badge.tsx`
- `apps/sophia-ai-factory/src/components/sop/playbook-markdown-editor.tsx` (client; wraps `@uiw/react-md-editor` with `next/dynamic`)

### Create — Actions + APIs
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/[id]/actions.ts` — Server Actions
- `apps/sophia-ai-factory/src/app/api/sop/installations/route.ts` — GET list
- `apps/sophia-ai-factory/src/app/api/sop/installations/[id]/route.ts` — GET detail (also DELETE from Phase 03; merge if needed)
- `apps/sophia-ai-factory/src/app/api/sop/installations/[id]/customizations/route.ts` — PATCH
- `apps/sophia-ai-factory/src/app/api/sop/installations/[id]/run/route.ts` — POST manual
- `apps/sophia-ai-factory/src/app/api/sop/installations/[id]/regen-secret/route.ts` — POST
- `apps/sophia-ai-factory/src/app/api/sop/runs/[runId]/route.ts` — GET

### Create — Validation
- `apps/sophia-ai-factory/src/lib/sop/customization-input-schema.ts` — Zod for PATCH body

### Modify
- `apps/sophia-ai-factory/package.json` — add `@uiw/react-md-editor`
- i18n messages — `sop.list.*`, `sop.detail.*`, `sop.run.*` keys

## Implementation Steps

1. **i18n keys** added Vi + En (list/detail/run/edit/webhook tabs).
2. **customization-input-schema**:
   ```ts
   export const customizationInputSchema = z.object({
     playbookMdOverride: z.string().max(32 * 1024).optional(),
     vars: z.record(z.string(), z.unknown()).optional(),
   });
   ```
3. **List page** server-fetches installations + recent run summary per installation (single query joining latest run via SQL window or repo helper).
4. **InstallationListTable** — columns: Name (Vi/En), Category, Schedule, Last Run (status badge), Run Count, Enabled (toggle calls Server Action), Actions menu (View / Run Now / Delete).
5. **Detail page** — server fetches installation + template + last 10 runs; renders tab navigation. Default tab = Overview.
6. **OverviewTab** — read-only fields + 3 buttons: "Run Now" (Server Action), "Disable/Enable" (toggle), "Delete" (confirm modal).
7. **RunsTab** — paginated table (20 per page); each row shows trigger, status, started-at, duration, link.
8. **EditTab**:
   ```tsx
   const Editor = dynamic(() => import('@/components/sop/playbook-markdown-editor'), { ssr: false, loading: () => <Skeleton/> });
   <Editor initialValue={installation.playbookMd} onSave={savePlaybookAction} />
   ```
   Below editor: Diff viewer (optional Phase 4.5) showing template-default vs current.
9. **WebhookTab** — show URL: `https://sophia.agencyos.network/api/v1/sop/${installation.id}/trigger`. "Reveal secret" button triggers Server Action that returns plaintext secret ONCE then re-encrypts. "Regenerate" action rotates and shows new secret in toast.
10. **Run detail page** + `SopRunTimeline`:
    - Server fetches run + missions array (parse missionIds JSON, fetch each via existing mission repo).
    - Client polls `/api/sop/runs/[runId]` every 3s if status='running'.
    - Timeline UI: vertical list, each item = step number + command + status icon + duration + "View mission →" link to `/dashboard/missions/[missionId]`.
11. **Manual run API** — auth, ownership check, generate runId, kick `runSop()` via `ctx.waitUntil`, return `{runId, status:'queued'}`.
12. **Tests**:
    - `customization-input-schema.test.ts`
    - API routes: install/customizations PATCH (auth/ownership/size limit), run POST (returns runId), runs GET, regen-secret rotation.
    - Component: `RunStatusBadge` snapshots, `InstallationListTable` empty state.
    - Integration: install → run-now → poll until succeeded → assert run row + missionIds populated.

## Todo List

- [ ] Install `@uiw/react-md-editor` + verify SSR-safe import
- [ ] i18n keys (Vi + En) for list/detail/edit/runs/webhook
- [ ] customization-input-schema.ts
- [ ] Server Actions (run-now, save-playbook, regen-secret, delete) in actions.ts
- [ ] /api/sop/installations GET
- [ ] /api/sop/installations/[id] GET (merge with Phase 03 DELETE in same route)
- [ ] /api/sop/installations/[id]/customizations PATCH
- [ ] /api/sop/installations/[id]/run POST
- [ ] /api/sop/installations/[id]/regen-secret POST
- [ ] /api/sop/runs/[runId] GET
- [ ] page.tsx list + InstallationListTable
- [ ] [id]/page.tsx detail wrapper + 4 tabs
- [ ] OverviewTab + RunsTab + EditTab + WebhookTab components
- [ ] PlaybookMarkdownEditor (next/dynamic ssr:false)
- [ ] [runId]/page.tsx + SopRunTimeline (polling)
- [ ] RunStatusBadge component
- [ ] Loading skeletons
- [ ] Tests (≥8 unit + ≥3 integration)
- [ ] `npm run build` + bundle size check (editor lazy)

## Success Criteria

- User installs SOP (Phase 03), navigates to `/dashboard/sops/[id]`, sees Overview.
- "Run Now" → run row appears in Runs tab within 2s, status transitions running → succeeded within ≤30s for fast-step playbook.
- Edit playbook → Save → next run uses customized version (assert via integration test).
- Webhook URL copyable, regenerate-secret rotates HMAC and invalidates prior signatures (verify by retrying old signature → 401).
- Run detail shows mission timeline with links that open existing `/dashboard/missions/[id]` pages.
- Editor lazy bundle ≤80KB gz; first-paint of detail page <1s.
- Existing tests pass; ≥11 new tests pass.
- No `:any`, no `console.log`, all files ≤200 LOC (split where needed).

## Risk Assessment

- R1: `@uiw/react-md-editor` SSR breakage. Mitigation: `ssr:false` dynamic import + skeleton fallback. Test in `npm run build`.
- R2: Polling burns Workers req. Mitigation: stop polling when status terminal; backoff to 5s then 10s after 2 minutes.
- R3: Manual run via `ctx.waitUntil` may exceed CF wall-clock for slow steps (video). Mitigation: same as Phase 02 R3 — Phase 1 expects fast steps, document long-step limitation.
- R4: Reveal-secret flow leaks secret to UI. Mitigation: only return on regenerate; Reveal button does NOT decrypt+show in Phase 1 (deferred to "secret ledger" feature). Show only "regenerate" pattern. Update F2 accordingly.

## Security Considerations

- Ownership check on every API route: `installation.userId === currentUser.id`.
- Customizations size limit (32KB) prevents abuse.
- Regenerate-secret invalidates prior HMAC immediately (overwrite encrypted column).
- Polling endpoint rate-limited per-user (existing rate limiter).
- Editor sanitizes Markdown input via Zod; rendering via `react-markdown` with `disallowedElements=['script','iframe']` and `remark-gfm` only.
- Webhook URL itself is non-secret (HMAC protects); displaying it is safe.

## Next Steps

- Phase 05 sidebar exposes "Run SOP" via Cmd+K palette.
- Future Phase 1.5: agents.yaml editor + diff viewer + dry-run preview.

## Open Questions

- Reveal-secret pattern — Phase 1 = regenerate-only (no plaintext reveal of existing). Confirm with CEO. If changed, extend to "show once" pattern.
- Pagination size for runs — 20 default OK? Configurable later.
- Edit conflict if SOP runs while user editing — last-write-wins for now; add optimistic-lock with `updated_at` if seen in practice.
