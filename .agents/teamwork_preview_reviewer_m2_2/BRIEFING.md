# BRIEFING — 2026-09-20T12:32:45+07:00

## Mission
Conduct independent adversarial security and robustness review of Milestone 2 (Multi-User Organizations & 5-Tier RBAC) implemented by teamwork_preview_worker_m2, verifying tenant isolation, 5-tier RBAC permissions, cryptographic token storage, atomic CAS token acceptance, typechecks, and 4-layer boundaries.

## 🔒 My Identity
- Archetype: reviewer-critic
- Roles: reviewer, critic
- Working directory: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/
- Original parent: 699d8c86-9fd2-4f43-9bd2-31aae57a990a
- Milestone: Milestone 2
- Instance: 1 of 1
- Current Working Directory: /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/
- Current Parent: 78b5382f-0b81-4402-ad59-b06284d61c09
- Instance: 2 of 2

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code.
- No cheating, no hardcoding, no dummy/facade implementations, no bypassed verification.
- Run typechecks and tests to verify correctness.
- Strictly verify assertTenantScope throws CROSS_TENANT_VIOLATION.
- Strictly verify viewer has 0 mutation permissions and only owner/billing_manager can manage billing.
- Strictly verify SHA-256 token hashing and no raw tokens stored in D1.
- Strictly verify CAS atomic acceptance against race conditions and replay attacks.

## Current Parent
- Conversation ID: 78b5382f-0b81-4402-ad59-b06284d61c09
- Updated: 2026-09-20T12:32:45+07:00

## Review Scope
- **Files to review**:
  - `apps/sophia-ai-factory/src/forest/tenant/isolation-guard.ts`
  - `apps/sophia-ai-factory/src/seed/types/rbac-matrix.ts`
  - `apps/sophia-ai-factory/src/tree/rbac/permissions.ts`
  - `apps/sophia-ai-factory/src/seed/security/invitation-token.ts`
  - `apps/sophia-ai-factory/src/tree/organizations/invitation-service.ts`
  - `apps/sophia-ai-factory/migrations/0277_enterprise_org_invitations.sql`
  - `apps/sophia-ai-factory/src/land/admin/org-invitation-actions.ts`
  - `apps/sophia-ai-factory/src/app/api/v1/invitations/accept/route.ts`
- **Interface contracts**: PROJECT.md Milestone 2 specifications.
- **Review criteria**:
  - `assertTenantScope` strictly throws `CROSS_TENANT_VIOLATION` on mismatch or empty ID.
  - `viewer` has 0 mutation permissions and only `owner`/`billing_manager` can manage billing.
  - Raw tokens are never stored in D1 and SHA-256 hashes are used.
  - CAS atomic acceptance prevents double consumption / race conditions.
  - Zero integrity violations, zero hardcoding or fake facades.
  - `npm run type-check` and `bash scripts/check-layer-boundaries.sh` exit 0.

## Key Decisions Made
- Confirmed `assertTenantScope` strictly throws `CROSS_TENANT_VIOLATION` on mismatch or empty string.
- Confirmed `viewer` has 0 mutation permissions and only `owner` and `billing_manager` can manage billing.
- Confirmed raw tokens are never stored in D1; SHA-256 hashes are used throughout schema and services.
- Confirmed `npm run type-check` (0 errors) and `bash scripts/check-layer-boundaries.sh` (0 violations) passed.
- **Identified critical concurrency vulnerability in CAS atomic acceptance**: `acceptOrgInvitation` inserts member records BEFORE executing the CAS update, and discards the CAS update result (`meta.changes`), allowing concurrent requests to double-consume tokens.
- Issued verdict: `REQUEST_CHANGES`.

## Artifact Index
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/handoff.md` — Final Handoff report.
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/review_report.md` — Quality Review report.
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/challenge_report.md` — Adversarial Challenge report.
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/progress.md` — Heartbeat and progress.
- `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_reviewer_m2_2/DISPATCH.md` — Dispatch log.

## Review Checklist
- **Items reviewed**:
  - `isolation-guard.ts` (VERIFIED: strict tenant scope assertion)
  - `rbac-matrix.ts` & `permissions.ts` (VERIFIED: viewer has 0 perms; only owner & billing_manager can manage billing)
  - `invitation-token.ts` & migration `0277` (VERIFIED: 256-bit CSPRNG, SHA-256 hashing, 0 plain tokens in D1)
  - `invitation-service.ts` (REJECTED: CAS atomicity flaw, inverted order, unchecked changes)
- **Verdict**: request_changes
- **Unverified claims**: None.

## Attack Surface
- **Hypotheses tested**:
  - Concurrent token acceptance with different user accounts (CRITICAL FLAW CONFIRMED: TOCTOU race condition in `acceptOrgInvitation`)
  - Tenant ID tampering / empty string input (VERIFIED: blocked by `assertTenantScope`)
  - Admin attempting billing mutation (VERIFIED: blocked by `canManageBilling === false`)
  - Viewer attempting any mutation (VERIFIED: blocked by all false flags)
- **Vulnerabilities found**:
  - Critical: Inverse execution order and unchecked CAS changes in `acceptOrgInvitation`.
- **Untested angles**:
  - Remote Cloudflare D1 distributed primary-leader failover (covered in M5 remote migration).
