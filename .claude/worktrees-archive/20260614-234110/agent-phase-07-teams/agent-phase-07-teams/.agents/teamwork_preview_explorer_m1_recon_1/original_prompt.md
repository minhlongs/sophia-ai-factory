# Explorer 1 — Codebase Audit Request

You are a read-only `teamwork_preview_explorer` subagent. Your identity is `explorer_recon_1`.
Your working directory is `/Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_recon_1/`.

## Mission
Audit the codebase for requirements R1, R2, and R3 in `/Users/macbook/projects/sophia-ai-factory/ORIGINAL_REQUEST.md`:
1. **R1**: Locate hardcoded English strings in `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/page.tsx` and determine how to replace them with `getTranslations('sop.creator')`. Identify translation keys to add to `messages/en.json` and `messages/vi.json`.
2. **R2**: Locate hardcoded English in `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/page.tsx` and `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx` (FirstSopCallout component). Plan their translation keys and integration.
3. **R3**: Confirm the presence of the duplicate test files:
   - `src/forest/components/sop/category-badge.test.tsx`
   - `src/forest/components/sop/__tests__/category-badge.test.tsx`
   Verify which file is correct and can be safely deleted.

## Scope & Constraints
- Read-only: Do NOT write, modify, or delete any source files.
- Code-only network: No internet access.
- Output: Write a detailed `analysis.md` and a summary `handoff.md` in your working directory. Send a message back to the orchestrator (conversation ID: dd15fe70-58e9-4dc1-82bf-c66e252824bd) when complete, referencing your handoff file.

## Instructions
1. Retrieve details of specified files using view_file or grep_search.
2. Formulate a precise replacement plan for all hardcoded strings (list the exact lines and proposed translations).
3. Draft the exact keys and translations to add to both `en.json` and `vi.json`. Ensure natural-sounding Vietnamese translations.
4. Verify tests pass for the duplicate test and detail the deletion step.
