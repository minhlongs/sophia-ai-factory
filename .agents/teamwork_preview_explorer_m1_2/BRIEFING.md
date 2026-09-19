# BRIEFING — 2026-09-19T15:58:50Z

## Mission
Investigate R2 (Runtime Environment Variable Parity) and R3 (Defensive Registration & Magic Link Name Fallback) for Better-Auth on Cloudflare Workers.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Explorer 2
- Working directory: /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_2
- Original parent: 4b4014dc-c889-46e2-94e4-d87757729081
- Milestone: Milestone 1 - Discovery & Root-Cause Mapping

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in production codebase directly
- Write all findings, analyses, and recommendations into working directory
- Provide exact code modifications / patches in report and handoff

## Current Parent
- Conversation ID: 4b4014dc-c889-46e2-94e4-d87757729081
- Updated: 2026-09-19T15:58:50Z

## Investigation State
- **Explored paths**: `apps/sophia-ai-factory/wrangler.toml`, `wrangler.staging.toml`, `src/seed/auth/better-auth-server.ts`, `src/seed/auth/better-auth-client.ts`, `src/components/stitch/screens/auth/register-page.tsx`, `src/components/stitch/screens/login/login-form.tsx`, `src/app/api/auth/[...all]/route.ts`, `src/seed/db/client.ts`, migrations `0001-init.sql`, `0003-better-auth.sql`, `scripts/deploy-with-sha.sh`, `scripts/sophia-doctor.mjs`, `scripts/check-layer-boundaries.sh`
- **Key findings**:
  1. `BETTER_AUTH_URL` and `APP_URL` are missing from `wrangler.toml` `[vars]` (present in `wrangler.staging.toml`).
  2. Missing `BETTER_AUTH_URL` causes `baseURL` and `trustedOrigins` in `better-auth-server.ts` to fallback to `localhost:3000` when `NODE_ENV !== 'production'` in edge runtime, returning 403 `INVALID_ORIGIN` for requests with `Origin: https://sophia.agencyos.network` and generating localhost magic links in emails.
  3. `databaseHooks.user.create.before` in `better-auth-server.ts` throws `Error('Name is required')` when `name` is missing or empty. This crashes magic link registrations (which only supply email) and registration without explicit company name.
  4. Form in `register-page.tsx` has `noValidate` and passes unvalidated `companyName` directly as `name`.
- **Unexplored areas**: None for R2/R3 scope; findings are comprehensive and root-causes are confirmed.

## Key Decisions Made
- Formulated exact code changes for `wrangler.toml`, `better-auth-server.ts`, and `register-page.tsx` including robust email prefix fallback and deterministic `trustedOrigins` set.
- Completed comprehensive `report.md` and 5-component `handoff.md`.

## Artifact Index
- DISPATCH.md — Dispatch instructions log
- progress.md — Liveness and progress tracker
- report.md — Complete investigation report with exact proposed code changes
- handoff.md — 5-component handoff report for Worker/Orchestrator
