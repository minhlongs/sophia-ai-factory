# BRIEFING — 2026-09-20T12:20:00+07:00

## Mission
Design the 5-tier RBAC system for Milestone 2 (Phase 18–19 Enterprise Scale Ready):
- 5 Roles: `owner`, `admin`, `creator`, `billing_manager`, `viewer`
- 5 Typed Permissions: `canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`
- Typed helper predicates and matrix evaluation in `src/seed/types/rbac-matrix.ts` and `src/tree/rbac/permissions.ts`
- Role hierarchy, non-linear lattice analysis, and boundary tests (viewer 0 mutation, only owner/billing_manager manage billing).

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Teamwork explorer, investigator, synthesiser
- Working directory: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_2/
- Original parent: fa4ccdba-2027-47c6-b690-4bf2f401a527
- Milestone: Milestone 2: Authentication & MFA
- [2026-09-20T05:16:27Z] Agent: teamwork_preview_explorer_m2_2
- Working directory: /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_2/
- Current parent: 78b5382f-0b81-4402-ad59-b06284d61c09
- Milestone: Milestone 2: Multi-User Organizations & 5-Tier RBAC (Enterprise Scale Engine)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- No external network requests
- Only write to my working directory `/Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_2/`
- [2026-09-20T05:16:27Z] Strict 4-layer architecture compliance (`seed` → `tree` → `forest` → `land`)
- [2026-09-20T05:16:27Z] No `:any` types in TypeScript
- [2026-09-20T05:16:27Z] All public interfaces and UI copy must be bilingual Vietnamese + English

## Current Parent
- Conversation ID: 78b5382f-0b81-4402-ad59-b06284d61c09
- Updated: 2026-09-20T12:20:00+07:00

## Investigation State
- **Explored paths**:
  - `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts`
  - `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/enterprise-test-harness.ts`
  - `apps/sophia-ai-factory/src/seed/auth/rbac.ts`
  - `apps/sophia-ai-factory/src/seed/db/org-membership.ts`
  - `apps/sophia-ai-factory/src/seed/db/org-membership-ext.ts`
  - `apps/sophia-ai-factory/src/seed/types/white-label-branding.ts`
  - `apps/sophia-ai-factory/src/tree/branding/theme-resolver.ts`
  - `.agents/orchestrator_enterprise_scale/PROJECT.md`
  - `.agents/ORIGINAL_REQUEST.md`
  - `.agents/teamwork_preview_explorer_m2_1/handoff.md`
  - `.agents/teamwork_preview_explorer_m2_3/analysis.md`
- **Key findings**:
  - 5-Tier Role Lattice: Not a linear integer ranking! `admin` and `billing_manager` have orthogonal privileges (admin has ops/webhooks/members but NO billing; billing_manager has billing but NO ops/webhooks/members).
  - Permission matrix consists of 5 explicit typed permissions: `canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`.
  - Architecture cleanly separates types/constants into `seed/types/rbac-matrix.ts` and evaluators/predicates/assertions into `tree/rbac/permissions.ts`.
  - Viewer has strictly 0 mutation permissions across all 5 checks.
- **Unexplored areas**: None.

## Key Decisions Made
- Use both `RBAC_PERMISSIONS_MATRIX` (`Record<OrgRole, readonly OrgPermission[]>`) and precomputed `ROLE_PERMISSION_FLAGS` (`Record<OrgRole, Record<OrgPermission, boolean>>`) for O(1) property checks.
- Structure `assertOrgPermission` with custom `RbacPermissionError` for clean integration with Server Actions and API route error handlers.
- Specify comprehensive boundary unit test suite in `src/__tests__/unit/enterprise/rbac-matrix.test.ts`.

## Artifact Index
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_2/analysis.md` — Detailed architectural analysis & blueprint.
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_2/handoff.md` — 5-component handoff report.
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_2/progress.md` — Progress tracker.
