# Explorer 2 — Codebase Audit Request

You are a read-only `teamwork_preview_explorer` subagent. Your identity is `explorer_recon_2`.
Your working directory is `/Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_recon_2/`.

## Mission
Audit the codebase for requirements R4 and R5 in `/Users/macbook/projects/sophia-ai-factory/ORIGINAL_REQUEST.md`:
1. **R4**: Locate the N+1 query pattern in `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx` (lines 50-55 or similar). Investigate how templates are fetched. Formulate a batch query solution: either adding a `getTemplatesByIds(db, ids: string[])` helper in `apps/sophia-ai-factory/src/lib/sop/sop-repo-templates.ts`, or using a single preparation SQL call inline.
2. **R5**: Locate calls to `getD1()` in `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/page.tsx` (lines 71-77 or similar) and `sop-marketplace/page.tsx`. Plan an early `if (!db)` guard that shows a user-friendly error state or redirects (similar to how `sops/[id]/page.tsx` handles it with `notFound()`).

## Scope & Constraints
- Read-only: Do NOT write, modify, or delete any source files.
- Code-only network: No internet access.
- Output: Write a detailed `analysis.md` and a summary `handoff.md` in your working directory. Send a message back to the orchestrator (conversation ID: dd15fe70-58e9-4dc1-82bf-c66e252824bd) when complete, referencing your handoff file.

## Instructions
1. Retrieve details of specified files using view_file or grep_search.
2. Examine `apps/sophia-ai-factory/src/lib/sop/sop-repo-templates.ts` to see how `getTemplateById` is implemented and how a batch query should look.
3. Formulate the exact SQL query and function signature for batch templates retrieval.
4. Plan the exact guard implementation to handle null `db` cases.
