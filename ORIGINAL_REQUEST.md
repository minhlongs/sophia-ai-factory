# Original User Request

## Initial Request — 2026-05-30T09:26:57Z

Fix all identified bugs and quality issues in the SOP Dashboard (Bảng điều khiển SOPs) of a Next.js 15 project. This is a pre-handover quality sweep — no new features, only bug fixes and consistency improvements. The CEO needs this clean before accepting the product.

Working directory: /Users/macbook/projects/sophia-ai-factory
Integrity mode: development

## Requirements

### R1. Fix hardcoded English strings in SOP Creator Dashboard

The file `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/page.tsx` has many hardcoded English strings that should use `next-intl` translations:
- Line 94: `"Creator Dashboard"` (h1 title)
- Line 95: `"Manage your SOP templates and earnings"` (subtitle)
- Line 103: `"Create New SOP"` (button)
- Line 110-113: Earnings card labels ("Total Earned", "Pending", "Payable", "Paid Out")
- Line 129: `"Your SOPs"` (section header)
- Line 135: `"No SOPs yet"` (empty state)
- Line 136: `"Create your first SOP template to start earning"` (empty state description)
- Line 142: `"Create First SOP"` (empty CTA)
- Line 150-154: Table headers ("Name", "Category", "Status", "Sales", "Revenue")

Replace all with `getTranslations('sop.creator')` calls (this is a Server Component), adding the corresponding keys to the English and Vietnamese translation files (`messages/en.json` and `messages/vi.json`). Maintain the same visual appearance.

### R2. Fix hardcoded English in SOP Marketplace first-time callout

In `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/page.tsx`, lines 84-89 use inline `isVi ? 'Vietnamese' : 'English'` ternary patterns instead of proper translation keys. Replace with `getTranslations('sop.marketplace')` calls and add translation keys.

Also in `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx` (FirstSopCallout component, lines 87-103), same pattern — hardcoded bilingual ternary. Replace with translations.

### R3. Fix duplicate `category-badge.test.tsx` test file

There are TWO test files for CategoryBadge:
- `src/forest/components/sop/category-badge.test.tsx` (root level — wrong location)
- `src/forest/components/sop/__tests__/category-badge.test.tsx` (correct location)

Delete the duplicate at root level (`category-badge.test.tsx`), keeping only the `__tests__/` version. Verify tests still pass.

### R4. Fix N+1 query pattern in SOP list page

In `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx`, lines 50-55:
```typescript
const withTemplates = await Promise.all(
  installations.map(async (inst) => {
    const template = db ? await getTemplateById(db, inst.template_id) : null;
    return { ...inst, template };
  }),
);
```

This fires N individual `SELECT` queries for each installation's template. Replace with a single batch query using `WHERE id IN (...)` pattern. Either:
- Add a `getTemplatesByIds(db, ids: string[])` function to `sop-repo-templates.ts`, or
- Use a single `db.prepare('SELECT * FROM sop_templates WHERE id IN (...)').bind(...)` call inline.

### R5. Add missing error handling for `getD1()` null cases

The SOP marketplace page (`sop-marketplace/page.tsx`) calls `listOfficialTemplates(db)` etc. with a possibly-null `db`, using ternary fallbacks. But the SOP creator page (`sop-creator/page.tsx`, line 71-77) also does this but with less protection — if `db` is null, `fetchEarnings` receives `null` as the second arg. Add an early `if (!db)` guard that shows a user-friendly error state or redirects, consistent with how `sops/[id]/page.tsx` handles it (line 42: `if (!db) notFound()`).

### R6. Add missing SOP creator detail page

The SOP creator table links to `/dashboard/sop-creator/${t.id}` (line 164) but there is NO `[id]/page.tsx` route inside `sop-creator/`. This means clicking any SOP in the creator table leads to a 404. At minimum, create a placeholder page that shows the template details and a "Submit for Review" button, or redirect to the marketplace detail page if the template is published.

### R7. Add `submitForReviewAction` button to SOP creator flow

The `submitForReviewAction` exists in `sop-creator/actions.ts` (line 72) but is never called from any UI component. Wire it into the creator detail page (from R6) or the creator list page with a "Submit for Review" button for templates in `draft` status.

## Acceptance Criteria

### Translation completeness
- [ ] Zero hardcoded English user-facing strings remain in SOP creator dashboard page
- [ ] Zero hardcoded English user-facing strings remain in SOP marketplace first-time callout
- [ ] Zero hardcoded English user-facing strings remain in SOP list FirstSopCallout component
- [ ] Both `messages/en.json` and `messages/vi.json` contain all new `sop.creator.*` and updated `sop.marketplace.*` keys
- [ ] Vietnamese translations are natural Vietnamese (not Google Translate quality)

### Code quality
- [ ] Duplicate `category-badge.test.tsx` at root level is deleted
- [ ] N+1 query in SOP list page is replaced with batch query
- [ ] All `getD1()` null cases have explicit handling (no undefined passed to functions)
- [ ] SOP creator detail route (`/dashboard/sop-creator/[id]`) exists and renders without crash

### No regressions
- [ ] All existing SOP-related tests pass: `npx vitest run src/forest/components/sop/ src/lib/sop/`
- [ ] TypeScript compiles without errors in changed files: `npx tsc --noEmit 2>&1 | grep -i sop` returns empty
- [ ] `submitForReviewAction` is wired to a UI button and changes template status to `published`

## Follow-up — 2026-05-30T04:28:04-07:00

Transform the repository `/Users/macbook/projects/sophia-ai-factory` into a production-grade, enterprise-ready, operationally understandable system capable of reaching “Go Live 100/100” standards.

Working directory: /Users/macbook/projects/sophia-ai-factory
Integrity mode: development

## Requirements

### R1. Phase 1 — Full Codebase Intelligence
Deeply inspect architecture, runtime behavior, data flow, dependencies, and operational bottlenecks. Build a verified system understanding and service map.

### R2. Phase 2 — Documentation Backfill
Generate or update the following enterprise-grade docs:
- `README.md` & `QUICKSTART.md` & `CONTRIBUTING.md`
- `LOCAL_DEV.md` & `TESTING.md` & `TROUBLESHOOTING.md`
- `RELEASE_PROCESS.md` & `DEPLOYMENT.md`
- `INCIDENT_RESPONSE.md` & `SECURITY.md`
- `ENVIRONMENT_VARIABLES.md`
- `ARCHITECTURE.md` & `SYSTEM_DESIGN.md`
- `RUNBOOKS.md` & `OPERATIONAL_GUIDES.md`

### R3. Phase 3 — Production Readiness Audit
Evaluate reliability (retry, timeouts, idempotency), scalability (concurrency, DB contention), security (secrets, auth, rate limiting), observability (logs, metrics, tracing), DevEx, and infra repeatability.

### R4. Phase 4 — Technical Debt Discovery
Identify and classify dead code, duplicate logic, abandoned systems, and high-risk modules with estimated blast radius and severity.

### R5. Phase 5 — Go-Live Gap Analysis
Produce a "Go Live Scorecard" scoring all 10 standard categories out of 100, listing blockades, high/medium/low priority fixes.

## Acceptance Criteria

### Documentation Delivery
- [ ] All 15+ standard markdown documents exist in the `docs/` directory or root with complete, non-empty, actionable details.
- [ ] System architecture and data flow diagrams are represented in clear ASCII/Mermaid format inside `ARCHITECTURE.md` or `SYSTEM_DESIGN.md`.

### Production Readiness & Audit Delivery
- [ ] A detailed Audit and Gap Analysis report exists at `docs/audit_report.md` or similar path.
- [ ] The report contains a completed Go Live Scorecard table with ratings for all 10 categories.
- [ ] The report contains a clear, prioritized list of blockers, high, medium, and low priority issues.

### Verification & Regression
- [ ] A validation script or audit check runs to verify the presence of all generated files.
- [ ] No functional code regressions; all existing tests in the workspace must pass successfully.

## Follow-up — 2026-05-30T05:02:01-07:00

Deep, comprehensive operational audit, architectural mapping, security assessment, and reliability review of the Sophia AI Factory codebase to elevate it to Stripe/Vercel-grade engineering standards.

Working directory: `/Users/macbook/projects/sophia-ai-factory`

## Requirements

### R1. Deep System Mapping
Analyze and document the full system topology, including bounded contexts, service orchestration, runtime boundaries, hot paths, concurrency models, state flows, and Cloudflare/D1 infrastructure dependencies.

### R2. Quality & Reliability Audit
Audit the system against Stripe/Vercel operational excellence standards:
- **Reliability:** Timeout/retry strategies, eventual consistency, idempotency, failure containment.
- **Scalability:** DB contention, N+1 queries, memory footprint, lock/queue saturation.
- **Security:** Auth boundaries, RBAC, input validation (Zod), secret leakage, injection risk.
- **Observability:** Logging quality, correlation IDs, telemetry/tracing depth.

### R3. Subsystem Breakdown (Required Format)
For every subsystem identified, generate:
1. **Purpose:** Business + technical role.
2. **Entry Points:** Exact startup/execution path.
3. **Runtime Lifecycle:** Step-by-step flow.
4. **State Management:** Mutability and storage.
5. **Dependencies:** Internal and external packages.
6. **Failure Modes:** Potential breakage paths.
7. **Recovery Behavior:** Active recovery mechanisms.
8. **Scale Limits:** Breakage at 10x load.
9. **Security Surface:** Attack vectors.
10. **Observability:** Debugging paths.
11. **Technical Debt:** Known code debt.
12. **Missing Knowledge:** Unknowns needing verification.
13. **Confidence Level:** High / Medium / Low.

### R4. Executive-Level Gap Analysis
Quantify structural health across these domains:
- Architectural Risk Map
- Operational Maturity, Scaling Readiness, Engineering Velocity, Infra Resilience, Security Posture, and Maintainability Scores
- Technical Debt Index
- Categorized findings: P0 (Existential), P1 (Scale Blockers), P2 (Velocity Killers), P3 (Optimizations)

## Acceptance Criteria

### Architectural Transparence
- [ ] Detailed documentation is created under the `docs/` or `plans/` workspace folder.
- [ ] All major entry points and runtime paths have exact file links and code symbol references.

### Reliability & Security Gap Identification
- [ ] Identification of any potential race conditions, N+1 patterns, lack of Zod schemas on API endpoints, or un-isolated Worker faults.
- [ ] List of P0/P1 risks with recommended architectural remedies.

### Executive Scorecard
- [ ] An executive gap analysis summary with metric ratings for scalability, security, and velocity is compiled.

## Follow-up — 2026-05-31T06:37:17Z

Perform a parallel codebase review of the Sophia AI Factory project to identify and verify edge cases across payments, auth, video generation, and metering.

Working directory: `/Users/macbook/projects/sophia-ai-factory`
Integrity mode: development

## Requirements

### R1. Parallel Codebase Review & Edge Case Identification
Identify and categorize edge cases in the Sophia AI Factory codebase focusing on:
- Payments (NOWPayments & PayOS webhook signatures, idempotency, underpayments).
- Authentication (Better Auth session state synchronization, D1 database failure handling).
- Video & Credits (HeyGen webhook verification, optimistic locking in decrementCredits, Cloudflare timeouts).
- Metering (Non-atomic Redis updates, CPU/memory performance of D1 usage rollup queries).

### R2. Edge Case Verification
Verify whether each identified edgecase is Handled, Unhandled, or Partially Handled, providing code references and line numbers.

### R3. Aggregated Reporting
Compile a structured Markdown report highlighting all verified edge cases, categorized by concern, with remediation recommendations.

## Acceptance Criteria

### Coverage & Verification
- [ ] List at least 10 critical edge cases across the four key categories.
- [ ] Each edgecase is marked with status (✅ Handled, ❌ Unhandled, or ⚠️ Partial).
- [ ] Exact file names and line numbers are cited for every verified case.
- [ ] Provide specific, actionable remediation recommendations for any unhandled or partial cases.

## Follow-up — 2026-05-31T06:45:17Z

Implement robust fixes for the 10 unhandled and partially handled edge cases identified in the codebase edge cases review report (`docs/codebase_edge_cases_report.md`) across payments, auth, video generation, and metering.

Working directory: `/Users/macbook/projects/sophia-ai-factory`
Integrity mode: development

## Requirements

### R1. Resolve Webhook & Payment Race Conditions and Underpayments
- Fix NOWPayments and PayOS concurrent duplicate webhook races by adding an atomic database lock or constraint check on event insertion.
- Add expected VND amount verification to the PayOS IPN route to prevent underpayment exploits.
- Remove the insecure orders fallback match (`orders?.[0]`) on PayOS IPN matching failures.

### R2. Resolve Auth Admin Demotion Caching & MFA Fail-Open Security
- Bypass the 5-minute Better Auth session cookie cache in the critical admin privilege check by enforcing a live database role lookup when demoting.
- Modify the MFA check in the middleware to fail closed (redirecting to login/error page) when the D1 database experiences connectivity failures.

### R3. Resolve Credit & Video Concurrency, Locking, and Timeout Limits
- Implement Compare-And-Swap (CAS) checks for HeyGen completed webhooks to prevent redundant downloading, R2 uploads, and duplicate receipt email notifications.
- Fix optimistic locking in `decrementCredits` so that it returns `false` if zero rows are updated, ensuring transactions are verified.
- Parallelize or chunk the retry queue cron jobs to prevent edge runtime wall-time timeouts.

### R4. Resolve Quota Metering Race Conditions and DB Rollup Overhead
- Implement atomic increments in Upstash Redis for realtime usage tracking (incorporating window starts in key structures).
- Migrate D1 usage rollup queries from JavaScript in-memory reductions to SQL aggregate sums (`SUM`) inside a single conditional database call.

## Acceptance Criteria

### Security & Reliability Gates
- [ ] All 10 edge case fixes pass TypeScript typechecking compiler (`npm run ci:typecheck`) with zero compile errors.
- [ ] The full Vitest unit/integration test suite (`npm run ci:test`) passes successfully with zero failures.
- [ ] The documentation verification script (`python3 scripts/verify-go-live-docs.py`) remains 100% green.

## Follow-up — 2026-09-19T02:25:34Z

This is a single self-contained fix; keep it small and focused. Complete Go-Live Handover: Confirm live edge SHA 13224f8e on Cloudflare, run live smoke checks, and update customer readiness audit docs to GREEN.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/audit/customer-readiness/FINAL-VERDICT.md
- docs/audit/forensic/FINAL-VERDICT.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md

## Requirements

### R1. Production Verification & Live SHA Match
Verify live Cloudflare Workers deployment at `https://sophia.agencyos.network/api/version` returns `shortSha` matching the current HEAD commit (`13224f8e`), and confirm endpoints `/api/health`, `/login`, and `/vi/login` return expected HTTP status codes.

### R2. Customer Readiness Audit Synchronization & Graduation to GREEN
Synchronize `docs/audit/customer-readiness/FINAL-VERDICT.md` and `apps/sophia-ai-factory/docs/audit/customer-readiness/FINAL-VERDICT.md` with the verified production deployment of SHA `13224f8e`, update all 11 dimension statuses to reflect full completion, and graduate the final certification verdict from YELLOW to GREEN.

### R3. Live Production Smoke Validation
Verify that live endpoints on `https://sophia.agencyos.network` execute cleanly without HTTP 500 errors, confirming zero regression in public and localized onboarding routes.

## Acceptance Criteria

### Production Truth & Health
- [ ] `curl -s https://sophia.agencyos.network/api/version` reports `shortSha` identical to local `git rev-parse HEAD | cut -c1-8` (`13224f8e`)
- [ ] `https://sophia.agencyos.network/api/health` returns HTTP 200
- [ ] `https://sophia.agencyos.network/login` returns HTTP 307 redirect
- [ ] `https://sophia.agencyos.network/vi/login` returns HTTP 200

### Audit Documentation & Handover
- [ ] `docs/audit/customer-readiness/FINAL-VERDICT.md` records verified live SHA `13224f8e`
- [ ] Final certification verdict in `FINAL-VERDICT.md` is updated from YELLOW to GREEN
- [ ] All changes committed cleanly to `main` with zero working tree divergence

## 2026-09-19T09:19:46Z

The user requested: The full multi-agent team.
Implement Next Evolution Phase 1–5: Build out the automated AI video pipeline and creative mission workflow, coordinating script generation, TTS audio synthesis, and visual frame generation into a multi-track rendering pipeline with bilingual studio UI.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/development-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md

## Requirements

### R1. Multi-Track Creative Mission Orchestration
Extend creative mission capabilities in `src/forest/mission/` to coordinate multi-stage generation: script synthesis, voiceover/TTS audio generation, and visual frame/video generation with fail-closed preflight checks and atomic state transitions (`running` → `completed` / `failed` / `cancelled`).

### R2. AI Provider Capability Integration
Expand provider resolution in `src/forest/ai/provider-factory.ts` and `src/seed/ai/capability-model.ts` to seamlessly route multi-track requests (OpenRouter/fal.ai/ElevenLabs/Replicate) under BYOK envelope encryption and circuit-breaker protection.

### R3. Bilingual Creative Studio & Blueprint UI
Update the Creative Studio in `/dashboard/missions/new` with blueprint templates, multi-track generation options, preflight cost estimation, and complete English/Vietnamese localization without mock placeholders.

### R4. Test Coverage & Layer Architecture Compliance
Ensure all new actions and domain modules strictly adhere to seed → tree → forest → land import hierarchies, passing all TypeScript checks, unit test suites, and multi-tenant isolation gates.

## Acceptance Criteria

### Architecture & Pipeline Integrity
- [ ] Multi-stage creative mission workflow dispatches and transitions states without deadlocks
- [ ] 7-gate preflight check protects multi-track generation before provider dispatch
- [ ] Strictly follows canonical 4-layer import discipline (seed → tree → forest → land)

### Provider & Asset Storage
- [ ] Multi-modal providers (TTS audio, visual frames) properly mapped in capability model
- [ ] Generated audio/visual assets vaulted to Cloudflare R2 with tenant-scoped keys
- [ ] BYOK credentials remain encrypted with AES-256-GCM

### Quality & Performance
- [ ] `npm run type-check` exits with code 0 (zero TypeScript errors)
- [ ] Vitest test suites for new modules pass with 100% success rate
- [ ] Bilingual translation keys validated with zero missing keys in `messages/vi.json` and `messages/en.json`
- [ ] Sophia Doctor (`npm run doctor`) remains 100% green

## 2026-09-19T13:36:30Z

The user requested: The full multi-agent team.
Implement Auto-Creative Playbook & Campaign Intelligence (Phase 5): Build the creative learning loop with pattern detection, automated recurring campaign playbooks, performance analytics, and a bilingual dashboard management UI.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/development-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md

## Requirements

### R1. Creative Learning Loop & Pattern Detection Engine
Build domain analytics in `src/forest/playbook/` or `src/tree/learning-loop/` that ingests completed creative mission outcomes, extracts high-performing creative variables (hook styles, audio voice profiles, duration patterns), and scores creative effectiveness.

### R2. Automated Playbook & Recurring Campaign Generator
Implement the automated playbook engine that translates winning patterns into repeatable campaign blueprints, scheduling recurring batch video generation runs with 7-gate preflight checks and quota enforcement.

### R3. Bilingual Playbook & Campaign UI
Deliver the interactive Playbook management interface in the dashboard with bilingual EN/VI support, displaying pattern analytics, auto-apply toggle rules, and campaign scheduling controls without mock placeholders.

### R4. Quality Gates & 4-Layer Architecture Enforcement
Ensure all modules adhere strictly to seed → tree → forest → land hierarchy (`bash scripts/check-layer-boundaries.sh` exit 0), compiling with zero TypeScript errors, zero `:any` types, and 100% test suite pass rates.

## Acceptance Criteria

### Architecture & Engine Integrity
- [ ] Creative learning loop extracts and scores mission patterns with OCC CAS state updates
- [ ] Automated campaign generator dispatches recurring multi-track missions with preflight checks
- [ ] Strictly adheres to canonical 4-layer import discipline (`bash scripts/check-layer-boundaries.sh` exit 0)

### UI & Bilingual Experience
- [ ] Dashboard Playbook interface renders pattern insights and campaign schedules
- [ ] All customer-facing copy fully bilingual in `messages/vi.json` and `messages/en.json` (0 missing keys)
- [ ] Zero unhandled errors or layout breaks across mobile/desktop viewports

### Quality & Diagnostics
- [ ] `npm run type-check` exits with code 0 (zero TypeScript errors)
- [ ] Unit and integration test suites pass with 100% success rate
- [ ] Sophia Doctor (`npm run doctor`) remains 100% green on production edge

## 2026-09-19T14:56:03Z

The user requested: The full multi-agent team.
Execute complete Customer Handover & 100/100 Project Closeout: Package credentials, generate the unified bilingual Handover Dossier and Sign-off Pack, execute Day-1 CEO access verification, and formally certify project closure for unattended autonomous operation.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/audit/customer-readiness/FINAL-VERDICT.md
- apps/sophia-ai-factory/docs/ceo-handover/
- docs/development-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md

## Requirements

### R1. Unified Customer Handover Dossier & Exit Sign-Off Pack
Consolidate all operational handover documentation into a comprehensive bilingual Handover Dossier (`docs/customer-handover/HANDOVER_DOSSIER_FINAL.md` and `HANDOVER_SIGN_OFF_PACK.md`), covering critical asset registers (Cloudflare, D1, R2, DNS, Payments, AI Providers), access ownership matrix, and the Customer Operational Governance Charter.

### R2. Founder 30-Minute Clean Access Transfer & Security Protocol
Create the streamlined, actionable Founder 30-Minute Transfer Checklist (`docs/customer-handover/FOUNDER_30MIN_TRANSFER.md`): exact steps for Cloudflare account membership & role transfer, D1 automated backup verification, 1Password/Bitwarden vault export protocol, and BYOK upstream credentials delegation.

### R3. Day-1 Customer Acceptance & Verification Validation
Execute and document the Day-1 Acceptance Test Suite across production surfaces (`https://sophia.agencyos.network`): probe core health, auth flows, setup wizard onboarding, creative mission workflows, and billing endpoints to empirically verify zero regressions and zero remaining operational blockers.

### R4. Formal Project Closure Certification (100/100 Verdict)
Synthesize the final Project Closure Audit Certificate (`docs/customer-handover/PROJECT_CLOSEOUT_VERDICT.md`), verifying zero outstanding P0/P1 blockers, 100% test pass rates, live edge SHA parity, and independence score graduation to 100/100 GREEN.

## Acceptance Criteria

### Documentation & Deliverables
- [ ] Unified Handover Dossier published with complete asset register and access ownership matrix
- [ ] Actionable Founder 30-Minute Transfer Checklist documented with exact role delegation instructions
- [ ] Bilingual Sign-off Pack and Customer Acceptance Certificate completed with zero missing sections

### Verification & Live Parity
- [ ] Live edge SHA matches repository HEAD commit with zero working tree divergence
- [ ] Production health `/api/health`, `/api/version`, and authenticated routes return valid HTTP statuses
- [ ] Automated customer journey test suite passes with 100% success rate
- [ ] Sophia Doctor (`npm run doctor`) confirms 11/11 checks green (0 warnings, 0 errors)

### Independence & Closeout
- [ ] Verified that the platform operates autonomously without single-founder manual intervention
- [ ] Independent Victory Auditor issues `VICTORY CONFIRMED` on the closeout package

## 2026-09-19T15:50:21Z

The user requested: The full multi-agent team.
Fix the critical production authentication bug in Sophia AI Factory: Resolve Better Auth 403 `INVALID_ORIGIN` on `https://sophia.agencyos.network`, enforce canonical trusted origins and environment variables, harden registration and magic-link flows, and deploy live edge fix with 100% verification.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts
- apps/sophia-ai-factory/src/seed/auth/better-auth-client.ts
- apps/sophia-ai-factory/wrangler.toml
- apps/sophia-ai-factory/src/components/stitch/screens/auth/register-page.tsx
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md

## Requirements

### R1. Production Origin & Trusted Domain Hardening
Fix Better Auth server configuration in `src/seed/auth/better-auth-server.ts` to deterministically include `https://sophia.agencyos.network`, `https://sophia-ai-factory.agencyos-openclaw.workers.dev`, and localhost in `trustedOrigins` regardless of `process.env.NODE_ENV` in Cloudflare Workers edge runtime.

### R2. Runtime Environment Variable Parity
Configure `BETTER_AUTH_URL` and `APP_URL` in `wrangler.toml` (`[vars]`) to ensure the Workers runtime always resolves the canonical production base URL, preventing fallback to `http://localhost:3000`.

### R3. Defensive Registration & Magic Link Name Fallback
Harden user creation hooks in `better-auth-server.ts` and `register-page.tsx` so users registering via magic-link or without an explicit company name gracefully fall back to the email prefix instead of throwing uncaught errors.

### R4. Production Edge Deployment & Live Auth Verification
Deploy the fix via CF-direct doctrine (`./scripts/deploy-with-sha.sh`), verify that `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, and `/api/auth/sign-in/magic-link` accept requests with `Origin: https://sophia.agencyos.network` with HTTP 200/401 instead of 403 `INVALID_ORIGIN`, and confirm Sophia Doctor remains 11/11 GREEN.

## Acceptance Criteria

### Security & Origin Validation
- [ ] `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-up/email" -H "Origin: https://sophia.agencyos.network"` returns application status (not 403 `INVALID_ORIGIN`)
- [ ] `curl -s -i -X POST "https://sophia.agencyos.network/api/auth/sign-in/magic-link" -H "Origin: https://sophia.agencyos.network"` returns HTTP 200 (not 403 `INVALID_ORIGIN`)
- [ ] `trustedOrigins` in `better-auth-server.ts` unconditionally covers `https://sophia.agencyos.network`

### Code Quality & Deployment
- [ ] `npm run type-check` exits 0 with 0 TypeScript errors
- [ ] All auth test suites pass with 100% pass rate
- [ ] Live edge SHA matches new commit SHA
- [ ] Sophia Doctor reports 11/11 checks green

## 2026-09-19T16:49:35Z

The user requested: The full multi-agent team.
Execute the complete Full Roadmap Next Horizon (Phases 15–16 & Enterprise Autonomy): Build the end-to-end Playwright customer journey E2E test suite, advance the multi-model AI video generation engine with multi-track rendering, implement the autonomous social publisher distribution fleet, and ship enterprise AES-256-GCM BYOK key rotation with OpenTelemetry observability.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/development-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts
- apps/sophia-ai-factory/src/forest/mission/
- apps/sophia-ai-factory/src/forest/publisher/
- apps/sophia-ai-factory/src/lib/byok/

## Requirements

### R1. Comprehensive Playwright Customer Journey E2E & Reliability Suite (Phase 15)
Implement and verify an automated end-to-end browser test suite simulating complete bilingual customer journeys:
- Guest discovery to registration and magic-link authentication (`/vi/login`, `/en/login`, `/register`).
- 6-step Onboarding Setup Wizard (`/setup`, `/setup-wizard`) with BYOK key validation probes.
- Creative Studio mission creation (`/dashboard/missions/new`) with pre-flight MCU/USD cost calculation.
- Scheduled distribution and publishing queue (`/dashboard/videos`).
- Self-serve subscription checkout with NOWPayments USDT invoice and PayOS VN QR code flows.
- Performance benchmark verifying TTFB < 300ms and 0 unhandled client-side exceptions.

### R2. Next-Gen Multi-Model AI Video Generation Pipeline (Phase 16)
Expand the video creation engine to support multi-provider synthesis with fail-closed circuit breakers:
- Multi-track pipeline coordinating script generation, ElevenLabs TTS voice synthesis, and visual frame synthesis (fal.ai / Kling AI / HunyuanVideo adapters).
- Pre-flight quota check against tenant MCU balance with envelope-encrypted BYOK API keys.
- Real-time video preview state machine (`queued` → `scripting` → `rendering` → `completed` / `failed`) with auto-vaulting to Cloudflare R2 (`VIDEO_BUCKET`).

### R3. Autonomous Multi-Channel Social Publisher Fleet
Implement autonomous scheduled distribution across social platforms:
- Multi-channel publishing adapters for YouTube Shorts (Data API v3 with auto token refresh), TikTok Shop, Instagram Reels, and Telegram Bot API (`sendVideo`).
- Idempotent scheduler cron ensuring exactly-once publication and deduplication.
- Webhook callbacks, automated retry queues with exponential backoff on HTTP 429/5xx, and viral performance metrics ingestion.

### R4. Enterprise Security Vault, Key Rotation & Production Observability
Harden platform security, credential lifecycle, and runtime observability:
- Automated BYOK key rotation daemon (`/api/admin/byok-rotation`) supporting AES-256-GCM versioned re-encryption of stored provider keys.
- OpenTelemetry (OTEL) production instrumentation with Honeycomb tracing for API latencies, D1 query metrics, and error rates.
- SOC 2 Type I audit evidence registry verification and immutable hash-chain audit logging.

### R5. Layer Architecture Discipline & Live Edge Deployment
- Strictly preserve the canonical 4-layer import hierarchy (`seed` → `tree` → `forest` → `land`) with 0 violations.
- Compile cleanly with 0 TypeScript errors and 100% test pass rate across all suites.
- Deploy to Cloudflare Workers edge via CF-direct doctrine, verify live edge SHA match, and confirm Sophia Doctor reports 11/11 GREEN.

## Acceptance Criteria

### Customer Journey & Reliability (R1)
- [ ] Playwright E2E suite covers all 5 core journeys with bilingual assertions (VI/EN)
- [ ] All public and authenticated routes return expected HTTP 200/307 with zero HTTP 500 errors
- [ ] TTFB measured < 300ms median on production edge endpoints

### AI Video Pipeline & Storage (R2)
- [ ] Multi-track video orchestration executes atomic state transitions without deadlocks
- [ ] Synthesized video/audio artifacts vaulted to Cloudflare R2 with tenant-scoped keys
- [ ] All BYOK API keys remain encrypted with AES-256-GCM

### Publisher Fleet & Distribution (R3)
- [ ] Social publisher adapters handle multi-channel publishing with token refresh
- [ ] Distribution cron executes idempotently with zero duplicate dispatches
- [ ] Exponential backoff retry handler recovers from transient provider rate limits

### Enterprise Security & Telemetry (R4)
- [ ] BYOK key rotation endpoint re-encrypts keys cleanly with key version increments
- [ ] OpenTelemetry tracer exports spans and traces without blocking request critical path
- [ ] Audit logs record immutable security events with hash verification

### Quality Gates & Production Deployment (R5)
- [ ] `npm run type-check` exits with code 0 (0 TypeScript errors)
- [ ] All unit and integration test suites pass with 100% success rate
- [ ] `bash scripts/check-layer-boundaries.sh` exits with code 0
- [ ] Deployed commit SHA matches live edge `https://sophia.agencyos.network/api/version`
- [ ] Sophia Doctor (`node scripts/sophia-doctor.mjs`) reports 11/11 GREEN (100% score)

## 2026-09-20T01:31:42Z

The user requested: The full multi-agent team.
Execute the complete Autonomous Growth & Revenue Engine ($1M MRR Path): Build the Hermes V2 autonomous AI marketing swarm and viral growth loop, implement the Creator Marketplace and blueprint remix ecosystem, launch the multi-network affiliate commission engine with automated NOWPayments USDT mass payouts, and ship the Mekong AI hybrid edge node synchronization with live Cloudflare Workers deployment.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/mrr-roadmap.md
- docs/HERMES_INTELLIGENCE_V2.md
- docs/development-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/src/forest/mission/
- apps/sophia-ai-factory/src/forest/publishing/
- apps/sophia-ai-factory/src/land/video/publishing/

## Requirements

### R1. Hermes Intelligence V2 — Autonomous AI Marketing Swarm & Viral Loop
Build an autonomous growth agent swarm coordinating trend discovery and viral video generation:
- Automated trend and hashtag scouting across TikTok, YouTube Shorts, and X with viral hook scoring.
- Autonomous daily campaign generator dispatching multi-track video synthesis based on top-performing creative patterns.
- Continuous viral feedback loop that analyzes view counts, shares, and watch time to autonomously refine future script prompts and visual styles.

### R2. Creator Marketplace & Video Blueprint Ecosystem (Phase 17)
Implement a community-driven creator marketplace for AI video templates:
- Marketplace discovery interface (`/marketplace`, `/vi/marketplace`) with filtering by niche, platform, and conversion rate.
- One-click blueprint cloning into Creative Studio (`/dashboard/missions/new`) with pre-flight cost estimation.
- Creator royalty attribution engine tracking remix usage, calculating creator revenue shares, and maintaining an immutable earnings ledger.

### R3. Multi-Network Affiliate Commission & Automated USDT Payouts Engine
Implement multi-network affiliate monetization and mass payout infrastructure:
- Webhook and event ingestion for 5 affiliate networks (TikTok Shop, Amazon Associates, ClickBank, AccessTrade, Awin) with HMAC signature verification and click attribution.
- Automated payout batch processor via NOWPayments USDT mass-payout API with a 14-day anti-fraud clawback hold.
- Dual-entry accounting ledger reconciling commissions, clawbacks, and net creator earnings.

### R4. Mekong AI Hybrid Edge Node Synchronization (Private GPU / Offline Mode)
Bridge Cloudflare Workers cloud execution with private local GPU inference nodes:
- Secure communication protocol connecting Cloudflare Workers to local `mekongd` daemons via Cloudflare Tunnels.
- Hybrid routing policy directing heavy LLM and TTS tasks to local zero-cost hardware (M1 Max / Ollama / vLLM) with transparent fallback to cloud BYOK providers on node unreachability.
- Bidirectional heartbeat and health monitor with encrypted status reporting.

### R5. Layer Architecture Discipline & Live Edge Deployment
- Strictly preserve canonical 4-layer import hierarchy (`seed` → `tree` → `forest` → `land`) with 0 violations.
- Maintain 0 TypeScript compilation errors and 100% test pass rate across all new and existing test suites.
- Deploy to Cloudflare Workers edge via CF-direct doctrine, verify live edge SHA match, and confirm Sophia Doctor reports 11/11 GREEN.

## Acceptance Criteria

### Autonomous Growth & Viral Loop (R1)
- [ ] Hermes V2 agent swarm autonomously evaluates viral hooks and schedules batch missions
- [ ] Engagement metrics harvester ingests view/share counts and updates pattern scores
- [ ] End-to-end simulation verifies autonomous dispatch without human intervention

### Creator Marketplace & Blueprints (R2)
- [ ] Bilingual marketplace UI allows browsing, searching, and previewing video blueprints
- [ ] One-click remix imports blueprints directly into Creative Studio with valid parameters
- [ ] Creator earnings ledger calculates royalties accurately with OCC CAS concurrency protection

### Affiliate Engine & USDT Payouts (R3)
- [ ] Webhook handlers process affiliate conversion events with HMAC signature verification
- [ ] Mass payout processor generates NOWPayments USDT payout batches with 14-day hold
- [ ] Reconciliation engine prevents double-payouts and handles clawbacks correctly

### Mekong Hybrid Edge Node (R4)
- [ ] Hybrid router routes requests to local `mekongd` node when available and falls back to cloud cleanly
- [ ] Node heartbeat monitor detects offline transitions within 15 seconds
- [ ] Tenant credentials and inference payloads remain encrypted in transit

### Quality Gates & Production Deployment (R5)
- [ ] `npm run type-check` exits with code 0 (0 TypeScript errors)
- [ ] All unit, integration, and E2E test suites pass with 100% success rate
- [ ] `bash scripts/check-layer-boundaries.sh` exits with code 0
- [ ] Deployed commit SHA matches live edge `https://sophia.agencyos.network/api/version`
- [ ] Sophia Doctor (`node scripts/sophia-doctor.mjs`) reports 11/11 GREEN (100% score)

## 2026-09-20T03:49:57Z

User requested: "go next". The server was restarted. Please revive all monitoring crons and child workers, continue execution of the Autonomous Growth & Revenue Engine ($1M MRR Path): complete Milestone 4 (Mekong AI Hybrid Edge Node Sync), Milestone 5 (Final E2E Verification & CF-Direct Live Edge Deployment to Cloudflare Workers), conduct the mandatory independent Victory Audit, and report final closeout.

## 2026-09-20T04:35:33Z

The user requested: The full multi-agent team.
Execute the complete Enterprise White-Label, Multi-Tenant Organizations, Executive BI, and Resilient Outbound Webhooks Engine (Phase 18–19 Scale Ready): Build the custom domain & dynamic white-label portal engine, implement the multi-user organization hierarchy with 5-tier RBAC and invitation workflows, launch the Executive BI reporting and automated digest engine with multi-format streaming export, deploy the outbound HMAC-signed webhook bus with DLQ retry handling, and verify with live Cloudflare Workers deployment and Sophia Doctor 11/11 GREEN certification.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/mrr-roadmap.md
- docs/development-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/src/tree/branding/org-branding-repo.ts
- apps/sophia-ai-factory/src/land/admin/org-manager.ts
- apps/sophia-ai-factory/src/seed/auth/resolve-org-id.ts

## Requirements

### R1. Enterprise White-Label & Custom Domain Engine (MASTER Tier)
Build a multi-tenant white-label branding and custom domain engine:
- D1 schema and management for `custom_domains` with Cloudflare for SaaS verification status tracking (SSL, DNS CNAME, routing).
- Dynamic white-label theme resolver serving custom agency logos, favicons, brand colors, and portal titles per hostname/tenant.
- White-label email header and footer formatting for transactional agency-branded notifications.

### R2. Multi-User Organizations & Role-Based Access Control (RBAC)
Implement multi-user organization collaboration and granular permissions:
- Complete organization lifecycle: organization creation, member seat quota enforcement per tier, invitation generation with cryptographic single-use tokens, and invitation acceptance.
- 5-tier RBAC system (`owner`, `admin`, `creator`, `billing_manager`, `viewer`) with typed permission matrix (`canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`).
- Org context switching helper and middleware guard ensuring strict tenant data isolation across all mutation actions.

### R3. Executive Business Intelligence (BI) & Automated Reporting Engine
Build comprehensive analytics aggregation and automated report delivery:
- Unified BI metrics aggregator compiling MRR, video generation throughput, viral engagement metrics, and affiliate conversion ROI.
- Scheduled executive digest dispatcher delivering automated weekly/monthly performance summaries to email outbox and Telegram bot.
- Streaming multi-format export API supporting CSV, JSON, and structured report summaries with tenant scoping and date range filters.

### R4. Resilient Outbound Webhooks & Event Streaming Bus
Build an enterprise developer webhook integration system:
- Outbound webhook subscription manager (`webhook_endpoints`) with event filtering (video rendered, campaign completed, commission earned, payout processed).
- Timing-safe HMAC-SHA256 signature generator (`X-Sophia-Signature`) for payload integrity verification.
- Asynchronous webhook delivery queue with exponential backoff retry, jitter, dead letter queue (DLQ) logging, and manual replay capability.

### R5. Layer Architecture Discipline & Live Edge Deployment
- Strictly preserve canonical 4-layer import hierarchy (`seed` → `tree` → `forest` → `land`) with 0 violations.
- Maintain 0 TypeScript compilation errors and 100% test pass rate across all new and existing test suites.
- Apply database migration to remote Cloudflare D1 database (`sophia-raas-db`).
- Deploy to Cloudflare Workers edge via CF-direct doctrine, verify live edge SHA match, and confirm Sophia Doctor reports 11/11 GREEN.

## Acceptance Criteria

### Enterprise White-Label & Custom Domains (R1)
- [ ] Custom domain resolver accurately maps hostnames to tenant branding configurations
- [ ] White-label UI theme injector dynamically provides custom logos, colors, and portal branding
- [ ] Domain DNS and SSL status validation handles pending, active, and error states cleanly

### Multi-User Organizations & RBAC (R2)
- [ ] Organization invitation flow creates secure tokens and adds members with assigned roles
- [ ] RBAC guard enforces permissions accurately across all 5 roles with 0 privilege leakage
- [ ] Multi-tenant isolation prevents cross-organization data leakage in queries and mutations

### Executive BI & Reporting Engine (R3)
- [ ] BI aggregator computes accurate multi-channel ROI and operational metrics
- [ ] Automated digest dispatcher generates and enqueues weekly/monthly summaries
- [ ] Export API streams RFC-4180 compliant CSV and structured JSON reports

### Resilient Outbound Webhooks (R4)
- [ ] Webhook dispatcher delivers payloads signed with HMAC-SHA256 signatures
- [ ] Delivery failures trigger exponential backoff retries and route to DLQ upon final exhaustion
- [ ] Replay API allows re-dispatching failed webhook deliveries safely

### Quality Gates & Production Deployment (R5)
- [ ] `npm run type-check` exits with code 0 (0 TypeScript errors)
- [ ] All unit, integration, and E2E test suites pass with 100% success rate
- [ ] `bash scripts/check-layer-boundaries.sh` exits with code 0
- [ ] Remote Cloudflare D1 migration applies cleanly to `sophia-raas-db`
- [ ] Deployed commit SHA matches live edge `https://sophia.agencyos.network/api/version`
- [ ] Sophia Doctor (`node scripts/sophia-doctor.mjs`) reports 11/11 GREEN (100% score)



## 2026-09-20T07:44:20Z

The user requested: The full multi-agent team.
Execute the complete Phase 20: 100/100 Automated Customer Handover, Project Closeout & Operational Acceptance Engine: Build the interactive customer handover portal and acceptance sign-off engine (`/dashboard/handover`, `/admin/handover`), implement the automated CEO Day-1 operational verification suite executing all 11 critical checkpoints programmatically, deploy the customer ownership delegation and credential sanitization export tools with automated DR backup verification, publish the bilingual customer runbook reader with immutable handover certificate generation, and verify with live Cloudflare Workers deployment and Sophia Doctor 11/11 GREEN certification.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/development-roadmap.md
- docs/mrr-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/docs/ceo-handover/CEO_HANDOVER_CLOSEOUT_REPORT.md
- apps/sophia-ai-factory/docs/ceo-handover/CEO_DAY_1_ACCESS_TEST.md
- apps/sophia-ai-factory/docs/ceo-handover/FOUNDER_FINAL_30_MINUTE_ACTIONS.md
- apps/sophia-ai-factory/docs/ceo-handover/CEO_HANDOVER_GATE_FINAL.md
- apps/sophia-ai-factory/src/tree/handover/auto-handover.ts
- apps/sophia-ai-factory/src/tree/handover/handover-doc-generator.ts

## Requirements

### R1. Interactive Customer Handover & Acceptance Sign-off Portal
Build a customer-facing interactive Acceptance Dashboard with bilingual guidance (Vietnamese & English):
- Dedicated handover interface (`/dashboard/handover`, `/vi/dashboard/handover`) allowing the customer/CEO to review all system deliverables, verify account capabilities, and track handover progress.
- Administrative handover management console (`/admin/handover`) for the operator/founder to track sign-off status across all tenants and trigger automated verification.
- Immutable digital acceptance sign-off flow generating a cryptographically verifiable Handover Certificate (stored in D1 `customer_handovers` with SHA-256 hash and timestamp).

### R2. Automated CEO Day-1 Operational Verification Suite
Implement an automated operational verification runner executing the 11 critical checkpoints from `CEO_DAY_1_ACCESS_TEST.md`:
- Automated test API (`/api/admin/handover/verify`) programmatically validating Cloudflare Workers edge responsiveness, D1 database CRUD and read-after-write consistency, R2 bucket bindings (`VIDEO_BUCKET`, `BACKUPS_BUCKET`), Better Auth session cookie authentication, NOWPayments IPN readiness, Telegram bot alert connectivity, and Better Stack heartbeat monitor.
- Automated Disaster Recovery (DR) drill execution verifying D1 database backup creation to R2 and integrity validation.

### R3. Customer Ownership Delegation, Credential Sanitization & Runbook Package
Deliver complete customer operational self-sufficiency tools:
- Customer environment export generator creating a sanitized `.env.production` bundle with verified configuration keys, masking secrets while validating structure against `env.example`.
- Bilingual customer runbook portal (`/dashboard/docs/runbooks`) rendering all 10 operational SOPs (Deployment, Disaster Recovery, BYOK Setup, Incident Response, Billing Ops, Health Monitoring) with offline export (Markdown & HTML).
- Clear 30-minute founder action plan checklist integrated directly into the handover dashboard.

### R4. Quality Gates, Live Edge Deployment & Sophia Doctor 11/11 GREEN
- Strictly preserve canonical 4-layer import hierarchy (`seed` → `tree` → `forest` → `land`) with 0 violations.
- Maintain 0 TypeScript compilation errors and 100% test pass rate across all new and existing test suites.
- Apply any required database migrations cleanly to remote Cloudflare D1 (`sophia-raas-db`).
- Deploy to Cloudflare Workers edge via CF-direct doctrine, verify live edge SHA match, and confirm Sophia Doctor reports 11/11 GREEN (100% score).

## Acceptance Criteria

### Customer Handover Portal & Sign-Off (R1)
- [ ] Bilingual handover portal (`/dashboard/handover`, `/vi/dashboard/handover`) displays live delivery status and verification checklist
- [ ] Digital sign-off flow creates an immutable audit record in D1 with verified timestamp and hash
- [ ] Admin console (`/admin/handover`) allows monitoring and approving customer handovers

### CEO Day-1 Automated Verification (R2)
- [ ] Verification suite programmatically checks all 11 CEO Day-1 operational checkpoints
- [ ] DR backup validation executes and verifies snapshot integrity in R2 storage
- [ ] Verification results return clear pass/fail status with diagnostic metrics

### Customer Delegation & Runbooks (R3)
- [ ] Environment generator exports structured, sanitized customer deployment configurations
- [ ] Runbook portal renders all customer operational runbooks with bilingual support
- [ ] Handover certificate can be downloaded or exported as a standalone document

### Quality Gates & Production Deployment (R4)
- [ ] `npm run type-check` exits with code 0 (0 TypeScript errors)
- [ ] All unit, integration, and E2E test suites pass with 100% success rate
- [ ] `bash scripts/check-layer-boundaries.sh` exits with code 0
- [ ] Deployed commit SHA matches live edge `https://sophia.agencyos.network/api/version`
- [ ] Sophia Doctor (`node scripts/sophia-doctor.mjs`) reports 11/11 GREEN (100% score)

## Follow-up — 2026-09-21T07:07:08Z

The user requested: The full multi-agent team.
Execute the complete Full Platform Obsidian Cyber-Glass Dashboard UI/UX Overhaul: Replace the broken Stitch prototype layout with a production-grade, pixel-perfect Obsidian Cyber-Glass dashboard experience (`#08090D` obsidian background, `#12141F` glass cards, `#6366F1` electric indigo accents, `#F59E0B` cyber amber highlights). Wire the canonical `DashboardSidebarNav` featuring real Sophia AI Factory capabilities (AI Missions, Creative Studio, YouTube Automation, Creator Marketplace, Handover, Runbooks), rebuild the revenue chart with smooth bottom-up SVG/gradient rendering, polish the topbar, and deploy live to Cloudflare Workers edge with bit-for-bit SHA verification and Sophia Doctor 11/11 GREEN certification.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- apps/sophia-ai-factory/src/app/globals.css
- apps/sophia-ai-factory/src/seed/components/ui/card.tsx
- apps/sophia-ai-factory/src/seed/components/ui/button.tsx
- apps/sophia-ai-factory/src/forest/dashboard/dashboard-sidebar-nav.tsx
- apps/sophia-ai-factory/src/components/stitch/screens/dashboard/dashboard-page.tsx
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md

## Requirements

### R1. Obsidian Cyber-Glass Dashboard Shell & Canonical Navigation
Build an executive-grade dashboard layout shell and sidebar navigation:
- Wire the canonical `DashboardSidebarNav` (`src/forest/dashboard/dashboard-sidebar-nav.tsx`) with real Sophia AI modules: Overview, Create Mission (`/dashboard/missions/new`), AI Missions (`/dashboard/missions`), Creative Studio (`/dashboard/creative-economy`), YouTube Automation (`/dashboard/youtube`), Playbooks (`/dashboard/playbooks`), Distribution Queue (`/dashboard/publish/queue`), Creator Marketplace (`/marketplace`), Handover & Acceptance (`/dashboard/handover`), Runbooks (`/dashboard/docs/runbooks`), and System Health (`/dashboard/system-health`).
- Implement sleek active indicators with subtle gradient glows (`bg-primary/10`, `border-primary/30`), hover translations, and responsive mobile drawer navigation.
- Fix user profile section at bottom with proper avatar, tier badge (MASTER, ENTERPRISE, PRO), and seamless upgrade CTA without text collision.

### R2. Rebuilt Revenue & Performance Chart (Bottom-Up Gradient)
Re-engineer the broken revenue visualization into a high-end financial chart:
- Eliminate inverted top-down ceiling bars; construct authentic bottom-up bars or smooth SVG area gradient curves with proper baseline alignment (`bottom: 0`, `items-end`).
- Add hover tooltips, date axis labels (Mon - Sun), and interactive time range selector (7 days, 30 days, 6 months, YTD).
- Apply Obsidian glass styling with subtle grid lines, glowing active state, and zero CSS class bugs.

### R3. TopBar, Executive KPI Cards & Recent Activity Tables
Redesign dashboard content widgets according to the Obsidian Cyber-Glass design system:
- **TopBar**: Fixed header with backdrop-blur (`backdrop-blur-xl bg-background/80 border-b border-border`), clean search input with icon, notification bell with unread badge, locale switcher (VI/EN), and high-contrast user menu.
- **KPI Metrics Grid**: 4 glowing glass cards (`bg-card/85 border border-border`) for Total Campaigns, Active Jobs, Videos Generated, and Success Rate, featuring trend badges (`+12%`, `neutral`), Lucide icons with tinted background pills, and letterpress shadow.
- **Onboarding Banner & Quick Actions**: Restyle the BYOK setup banner with proper flex spacing, badges, and primary action buttons (`/dashboard/setup`, `/dashboard/system-health`).
- **Recent Activity / Missions Table**: Clean table layout with status pills (`completed`, `processing`, `failed`), timestamps, and quick action links.

### R4. Quality Gates, Edge Deployment & Verification
- Strictly preserve canonical 4-layer import hierarchy (`seed` → `tree` → `forest` → `land`) with 0 violations.
- Maintain 0 TypeScript compilation errors and 100% test pass rate across all existing and new UI test suites.
- Deploy to Cloudflare Workers edge via CF-direct doctrine, verify live edge SHA match at `https://sophia.agencyos.network/api/version`, and confirm Sophia Doctor reports 11/11 GREEN.

## Acceptance Criteria

### Obsidian Cyber-Glass Layout (R1)
- [ ] Sidebar navigation renders all real Sophia AI modules with proper icons, labels, and active route indicators
- [ ] Zero text overlap in the sidebar user card and plan quota bar
- [ ] Mobile responsive drawer allows full navigation on viewport < 768px

### Revenue Chart & Metrics (R2 & R3)
- [ ] Revenue chart bars grow strictly from the bottom up with clean spacing and hover interactions
- [ ] All 4 metric cards display glassmorphism styling, clean borders, and proper typography
- [ ] TopBar renders search, notifications, locale switch, and user profile cleanly without visual glitches

### Quality Gates & Live Edge Deployment (R4)
- [ ] `npm run type-check` exits with code 0 (0 TypeScript errors)
- [ ] All unit, integration, and E2E test suites pass with 100% success rate
- [ ] `bash scripts/check-layer-boundaries.sh` exits with code 0
- [ ] Deployed commit SHA matches live edge `https://sophia.agencyos.network/api/version`
- [ ] Sophia Doctor (`node scripts/sophia-doctor.mjs`) reports 11/11 GREEN (100% score)

## 2026-09-22T04:05:48Z

The user requested: The full multi-agent team (DevOps/SRE Lead, Cloudflare Architect, QA Engineer).
Chuyển đổi hoàn toàn kiến trúc triển khai (deployment) của Sophia AI Factory từ triển khai thủ công từ máy local (CF-direct qua `deploy-with-sha.sh`) sang quy trình CI/CD tự động hóa chuẩn hóa trên GitHub Actions. Loại bỏ rủi ro sai lệch môi trường (environment drift), rủi ro push thiếu commit hoặc branch divergence giữa local và remote, đồng thời áp dụng nghiêm ngặt các cổng kiểm định chất lượng (Quality Gates) tự động trước khi code được đẩy lên Cloudflare Workers edge.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- .github/workflows/deploy.yml
- .github/workflows/quality-gate.yml
- apps/sophia-ai-factory/scripts/deploy-with-sha.sh
- apps/sophia-ai-factory/scripts/sophia-doctor.mjs
- apps/sophia-ai-factory/CLAUDE.md
- AGENTS.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md

## User Confirmed Decisions
1. **Cơ chế kích hoạt CI/CD**: Tự động kích hoạt khi push/merge vào `main`, đồng thời hỗ trợ trigger thủ công qua `workflow_dispatch`.
2. **Chính sách Local Deploy**: Chặn tuyệt đối triển khai thông thường từ máy local, yêu cầu cờ khẩn cấp tường minh `EMERGENCY_CF_DIRECT=1` kèm lý do giải trình.

## Requirements

### R1. Standardized GitHub Actions CI/CD Deployment Pipeline (`.github/workflows/deploy.yml`)
Xây dựng pipeline CI/CD hoàn chỉnh và tự động hóa toàn diện trên GitHub Actions:
- **Kích hoạt (Triggers)**: Tự động chạy khi có `push` vào nhánh `main` và cho phép chạy thủ công qua `workflow_dispatch` (với tùy chọn dry-run hoặc force-verify).
- **Giai đoạn 1: Quality Gate & Code Health (Pre-deploy)**
  - TypeScript compilation check (`npm run type-check` / `tsc --noEmit`).
  - ESLint verification (`npm run lint`).
  - Architecture layer boundary check (`bash scripts/check-layer-boundaries.sh`) đảm bảo 0 vi phạm Clean Architecture.
  - Kiểm tra tính toàn vẹn i18n (`npm run i18n:validate`).
  - Toàn bộ Vitest unit & integration tests (`npm run test`).
- **Giai đoạn 2: Cloudflare Build & D1 Migration**
  - Node.js v22 với npm cache.
  - Next.js & OpenNext build với phân bổ heap memory (`NODE_OPTIONS=--max-old-space-size=4096`).
  - Tự động áp dụng các delta migration D1 mới nhất (`npm run deploy:migrations`) tới remote database `sophia-raas-db`.
- **Giai đoạn 3: Cloudflare Edge Deploy & Secret Metadata Injection**
  - Thực thi deploy lên Cloudflare Workers edge qua `opennextjs-cloudflare deploy --config wrangler.toml`.
  - Tự động inject metadata: `COMMIT_SHA` (SHA commit thực tế đang deploy), `DEPLOYED_AT` (thời gian deploy ISO 8601), `DEPLOY_BRANCH` (`main`).
- **Giai đoạn 4: Post-Deploy Automated Verification & Health Smoke Test**
  - Thăm dò endpoint `https://sophia.agencyos.network/api/version` và khẳng định `shortSha` trả về khớp chính xác bit-for-bit với commit SHA vừa được build trên GitHub Actions.
  - Chạy post-deploy smoke test xác thực các endpoint sống còn: `/api/health`, `/login` (307 redirect), `/vi/login` (HTTP 200).

### R2. Local Deployment Deprecation & Break-Glass Guard (`deploy-with-sha.sh`)
- Sửa đổi `scripts/deploy-with-sha.sh` và `npm run deploy:full`: Khi chạy trên máy cục bộ (không phải môi trường CI `GITHUB_ACTIONS=true`), script lập tức chặn và in thông báo hướng dẫn rõ ràng:
  `❌ Local direct deployment is disabled to prevent bugs and environment drift.`
  `👉 Push your commits to 'main' for automated CI/CD deployment via GitHub Actions.`
- Chỉ cho phép chạy từ local khi có cờ tường minh: `EMERGENCY_CF_DIRECT=1 npm run deploy:full` (cơ chế Break-Glass khi CI gặp sự cố nghiêm trọng).

### R3. Sophia Doctor & Repository Governance Alignment
- Cập nhật `scripts/sophia-doctor.mjs` (Check 9b): Chuyển từ kiểm tra "CI: bypassed by design (test.yml.disabled)" sang kiểm tra và xác nhận "CI/CD: GitHub Actions active & canonical pipeline (`.github/workflows/deploy.yml` tồn tại và hợp lệ)".
- Đồng bộ hóa tài liệu dự án:
  - `AGENTS.md`: Cập nhật Deployment Rules nêu rõ GitHub Actions CI/CD là quy trình triển khai chính thức.
  - `apps/sophia-ai-factory/CLAUDE.md`: Cập nhật deploy doctrine sang CI/CD.
  - `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`: Hướng dẫn kiểm tra trạng thái CI/CD sau khi push code.

### R4. CI Secrets & Operations Verification Matrix
- Tạo script tiền kiểm tra cấu hình CI (`scripts/check-ci-readiness.mjs`) kiểm tra tính sẵn sàng của các biến và token Cloudflare cần thiết cho GitHub Actions.
- Hướng dẫn cấu hình repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Acceptance Criteria

### CI/CD Workflow Pipeline (R1)
- [ ] File `.github/workflows/deploy.yml` được chuẩn hóa với đầy đủ 4 giai đoạn (Quality Gate, Build/Migration, Edge Deploy, Post-verify).
- [ ] Workflow hỗ trợ `push: branches [main]` và `workflow_dispatch`.
- [ ] Post-deploy step kiểm tra bit-for-bit giữa commit SHA và `https://sophia.agencyos.network/api/version`.

### Local Guardrails & Break-Glass Mode (R2)
- [ ] Chạy `npm run deploy:full` từ local mà không có cờ `EMERGENCY_CF_DIRECT=1` sẽ bị chặn với mã thoát lỗi `exit 1` và hiển thị thông báo hướng dẫn push lên CI/CD.
- [ ] Chạy với `EMERGENCY_CF_DIRECT=1` cho phép triển khai khẩn cấp và in rõ cảnh báo BREAK-GLASS.

### Doctor & Governance Synchronization (R3)
- [ ] `node scripts/sophia-doctor.mjs` báo cáo 11/11 GREEN (100% pass score) với CI check ghi nhận pipeline chuẩn.
- [ ] `AGENTS.md`, `CLAUDE.md`, và các tài liệu doctrine được cập nhật đồng nhất, không còn mâu thuẫn.

### Code Integrity & Clean Architecture (R4)
- [ ] `npm run type-check` đạt 0 lỗi.
- [ ] `bash scripts/check-layer-boundaries.sh` đạt 0 vi phạm (100% clean architecture).
- [ ] Toàn bộ test suite chạy đạt 100% pass rate.

## 2026-09-22T13:51:24Z

The user requested: The full multi-agent team (DevOps/SRE Lead, QA Engineer, Site Reliability Engineer).
Execute full Production Go-Live and operational activation of Sophia AI Factory: deploy the latest codebase to Cloudflare Workers edge via the standardized GitHub Actions CI/CD pipeline, verify bit-for-bit live edge SHA synchronization on `https://sophia.agencyos.network/api/version`, execute live end-to-end synthetic user video flow preflight, confirm 11/11 GREEN Sophia Doctor score, and validate 100% production readiness across all public and authenticated routes.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- .github/workflows/deploy.yml
- apps/sophia-ai-factory/scripts/sophia-doctor.mjs
- apps/sophia-ai-factory/scripts/verify-user-video-flow-live.mjs
- apps/sophia-ai-factory/CLAUDE.md
- AGENTS.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/docs/ceo-handover/CEO_DAY_1_ACCESS_TEST.md

## Requirements

### R1. Live Edge CI/CD Deployment & SHA Parity Synchronization
- Kích hoạt và theo dõi pipeline GitHub Actions CI/CD (`.github/workflows/deploy.yml`) cho commit `HEAD` (`8de578b44` hoặc commit mới nhất).
- Đảm bảo toàn bộ 4 giai đoạn (Quality Gate, Build & D1 Migration, Edge Deploy, Post-Deploy Verify) hoàn thành thành công 100%.
- Xác thực endpoint `https://sophia.agencyos.network/api/version` trả về `shortSha` khớp chính xác từng ký tự với git commit SHA deployed.

### R2. End-to-End Live Synthetic User Flow Preflight
- Thực thi công cụ kiểm thử luồng thực tế `node scripts/verify-user-video-flow-live.mjs --preflight` kết nối trực tiếp tới live edge `https://sophia.agencyos.network`.
- Xác nhận toàn bộ các khâu sống còn:
  - Version handshake
  - Xác thực phiên làm việc Better Auth (sign-in cookie)
  - Mã hóa và lưu trữ BYOK credentials trong cơ sở dữ liệu Cloudflare D1
  - Kênh phát hành (publish channels) preflight thành công.

### R3. Sophia Doctor 11/11 GREEN & Operational Health Certification
- Chạy `node scripts/sophia-doctor.mjs` trên môi trường thực tế, đảm bảo đạt điểm số tuyệt đối 11/11 GREEN (0 cảnh báo, 0 lỗi).
- Xác nhận các kiểm tra trọng yếu:
  - Check 4: D1 migrations đồng bộ 100% (246/246 migrations).
  - Check 5: TypeScript 0 lỗi compilation.
  - Check 7: MCP servers whitelist đã được phê duyệt.
  - Check 9b: CI/CD GitHub Actions active & canonical pipeline (`deploy.yml`).
  - Check 11 & 12: Production `/api/version` và `/api/health` trả về trạng thái chuẩn.

### R4. Public & Authenticated Routes Live Smoke Audit
- Thăm dò và kiểm tra tính toàn vẹn của các route chính trên production:
  - `/api/health` -> HTTP 200
  - `/api/version` -> HTTP 200 (chứa metadata `shortSha`, `deployedAt`)
  - `/login` -> HTTP 307 redirect
  - `/vi/login` -> HTTP 200 (giao diện đăng nhập tiếng Việt)
  - `/dashboard` -> Được bảo vệ bởi middleware xác thực

## Acceptance Criteria

### Live Edge CI/CD Deployment (R1)
- [ ] Pipeline `.github/workflows/deploy.yml` hoàn tất với trạng thái `success` (GREEN) trên GitHub Actions.
- [ ] `curl -s https://sophia.agencyos.network/api/version` trả về `shortSha` khớp bit-for-bit với git commit SHA.

### Live Synthetic Preflight (R2)
- [ ] `node scripts/verify-user-video-flow-live.mjs --preflight` hoàn tất với thông điệp: `LIVE PREFLIGHT PASS: deployment, credentials, and publish channels are ready.`
- [ ] Không có lỗi runtime hoặc authentication failure nào trên production.

### Operational Certification (R3)
- [ ] `node scripts/sophia-doctor.mjs` báo cáo 11/11 GREEN (100% pass score).
- [ ] Kiến trúc tầng `bash scripts/check-layer-boundaries.sh` đạt 0 vi phạm.

### Production Routing & Security Smoke (R4)
- [ ] Tất cả các route `/api/health`, `/api/version`, `/login`, `/vi/login` phản hồi HTTP status codes chính xác.
- [ ] Header bảo mật (CSP, HSTS, X-Content-Type-Options) hiển thị đầy đủ trên production response.

## 2026-09-22T14:56:32Z

The user requested: The full multi-agent team (Growth Marketing Architect, Full-Stack Revenue Engineer, Telegram Bot Engineer, QA Auditor).
Triển khai toàn diện Cỗ máy Tăng trưởng Doanh thu Đa kênh (Omnichannel Revenue & Customer Acquisition Engine) nhằm chốt 10 khách hàng trả phí đầu tiên và chinh phục cột mốc $5K MRR cho Sophia AI Factory: xây dựng phễu Viral Video Lead Generation (TikTok Shop, YouTube Shorts), tự động hóa kịch bản chốt đơn qua Telegram Sales Bot, kích hoạt mạng lưới tiếp thị liên kết (Affiliate Commission Engine với thanh toán tự động NOWPayments USDT mass payouts), xuất bản hệ thống Programmatic SEO Landing Pages, và tích hợp bộ đo lường chuyển đổi Real-time Analytics Dashboard.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/mrr-roadmap.md
- docs/development-roadmap.md
- apps/sophia-ai-factory/CLAUDE.md
- AGENTS.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/src/tree/affiliate/
- apps/sophia-ai-factory/src/forest/mission/
- apps/sophia-ai-factory/src/land/telegram/

## Requirements

### R1. Viral Video Lead Generation & Multi-Channel Distribution Funnel
Xây dựng pipeline tự động sản xuất video ngắn thu hút khách hàng tiềm năng:
- Tích hợp công cụ phát hiện xu hướng (trending hook finder) và tự động tạo kịch bản bán hàng ngắn (short-form hook scripts) cho niche AI Automation, E-commerce và Solopreneur.
- Đóng gói quy trình xuất bản tự động đa nền tảng (TikTok, YouTube Shorts, X) đính kèm CTA mã giới thiệu (referral UTM tracking codes) và link dẫn về phễu đăng ký.
- Tạo màn hình quản lý phễu video (`/dashboard/growth/viral-funnel`, `/vi/dashboard/growth/viral-funnel`) cho phép đo lường lượt xem, tỷ lệ click CTA và số lượng leads đăng ký từ mỗi video.

### R2. Telegram Automated Sales & Lead Qualification Bot
Nâng cấp và tự động hóa toàn diện luồng tư vấn và chốt sales qua Telegram Bot:
- Xây dựng flow đối thoại tương tác tự động khi khách hàng bấm vào Telegram Link từ video viral: Chào đón, khảo sát nhu cầu (niche, ngân sách), demo nhanh 1 video mẫu tạo tự động.
- Kịch bản chốt đơn tự động (Automated Checkout Trigger): Gửi link thanh toán kích hoạt gói dịch vụ (NOWPayments USDT hoặc PayOS QR VN) ngay trong chat với mã ưu đãi độc quyền `SOLO100`.
- Cơ chế thông báo tức thời cho Founder/Admin mỗi khi có lead mới đăng ký hoặc có đơn hàng phát sinh.

### R3. Multi-Tier Affiliate Commission Engine & Automated USDT Mass Payouts
Xây dựng hạ tầng tiếp thị liên kết chuyên nghiệp để nhân bản đội ngũ đối tác bán hàng:
- Cổng thông tin Affiliate Partner (`/affiliate`, `/vi/affiliate`, `/dashboard/affiliate`): Cung cấp link chia sẻ cá nhân hóa, tài liệu marketing (banners, sample scripts), bảng thống kê số click, tỷ lệ chuyển đổi và hoa hồng tích lũy (20% - 30% recurring MRR).
- Cơ chế xác thực webhook hoa hồng chống gian lận (14-day hold period, HMAC-SHA256 signature verification).
- Module thanh toán hoa hồng hàng loạt tự động qua NOWPayments USDT Mass-Payout API (hoặc export CSV chuẩn ngân hàng cho đối tác Việt Nam).

### R4. Programmatic SEO Landing Pages & Real-Time Conversion Analytics
Mở rộng lưu lượng truy cập tìm kiếm tự nhiên bền vững:
- Xây dựng hệ thống dynamic programmatic landing pages (`/solutions/[use-case]`, `/vi/solutions/[use-case]`) tối ưu SEO cho hơn 20 ngành hàng (bất động sản, mỹ phẩm, thời trang, khóa học, F&B, bảo hiểm...).
- Tích hợp Schema.org structured data, OpenGraph tags, và điểm số Web Vitals tối ưu.
- Dashboard quản trị doanh thu thời gian thực (`/admin/growth-analytics`): Theo dõi trực quan phễu chuyển đổi: Visitors $\to$ Leads $\to$ Trial $\to$ Paid ($5K MRR tracker).

### R5. Layer Architecture Discipline & Production CI/CD Verification
- Tuân thủ nghiêm ngặt kiến trúc 4 tầng Clean Architecture (`seed` $\to$ `tree` $\to$ `forest` $\to$ `land`) với 0 vi phạm.
- Duy trì 0 lỗi biên dịch TypeScript (`tsc --noEmit`) và 100% test pass rate trên các test suite mới và hiện có.
- Tự động kiểm tra chất lượng và deploy thông qua GitHub Actions CI/CD (`.github/workflows/deploy.yml`), xác thực `shortSha` live trên `https://sophia.agencyos.network/api/version`.
- Đảm bảo Sophia Doctor báo cáo 11/11 GREEN (100% pass score).

## Acceptance Criteria

### Viral Video Lead Gen Pipeline (R1)
- [ ] Màn hình `/dashboard/growth/viral-funnel` hiển thị danh sách video phễu và tracking UTM leads chính xác từ D1.
- [ ] Kịch bản video tự động tạo hook hấp dẫn với CTA dẫn về landing page hoặc Telegram bot.
- [ ] Cơ chế đo lường click-through rate (CTR) và lead conversion hoạt động chính xác.

### Telegram Sales & Qualification Bot (R2)
- [ ] Luồng đối thoại bot tự động phân loại nhu cầu khách hàng qua các nút bấm tương tác (Inline Keyboard).
- [ ] Bot tạo và gửi link thanh toán NOWPayments/PayOS kèm voucher giảm giá `SOLO100` thành công.
- [ ] Founder/Admin nhận được thông báo Telegram tức thời khi có đơn hàng mới được thanh toán.

### Affiliate Commission Engine & USDT Payouts (R3)
- [ ] Giao diện `/dashboard/affiliate` hiển thị đúng mã giới thiệu, số dư khả dụng và lịch sử hoa hồng.
- [ ] Webhook ghi nhận đơn hàng thành công tự động cộng hoa hồng cho affiliate partner với cơ chế chống gian lận.
- [ ] Module payout hỗ trợ xuất lệnh chi trả USDT qua NOWPayments API hoặc file đối soát.

### Programmatic SEO & Growth Dashboard (R4)
- [ ] Các trang `/solutions/[use-case]` và `/vi/solutions/[use-case]` render SSR với đầy đủ metadata SEO song ngữ.
- [ ] Dashboard `/admin/growth-analytics` thống kê chính xác số lượng leads, tỷ lệ chuyển đổi và tiến độ đạt mốc $5K MRR.

### Quality Gates & Production Deployment (R5)
- [ ] `npm run type-check` đạt 0 lỗi.
- [ ] `bash scripts/check-layer-boundaries.sh` đạt 0 vi phạm (100% clean architecture).
- [ ] Toàn bộ unit/integration test suites chạy đạt 100% pass rate.
- [ ] Deployed commit SHA khớp bit-for-bit với live edge `https://sophia.agencyos.network/api/version`.
- [ ] Sophia Doctor (`node scripts/sophia-doctor.mjs`) báo cáo 11/11 GREEN (100% pass score).

## 2026-09-22T16:23:12Z

The user requested: /teamwork-preview go next
Triển khai Cỗ máy Mở rộng Tự động & Đa Khách thuê Đại lý (Autonomous Scale & Agency Multi-Tenancy Engine) nhằm chinh phục cột mốc $10K–$25K MRR và mở rộng phục vụ 50–125 khách hàng trả phí cho Sophia AI Factory: xây dựng Trợ lý AI Bảo vệ Khách hàng & Chống Rời bỏ (Autonomous Client Retention & Anti-Churn AI Guardian), triển khai Không gian Làm việc Đại lý Tự phục vụ & Phân quyền Tài khoản Phụ (Self-Service Agency Workspace & Client Sub-Accounts with Video Review Approval Portal), mở rộng Mạng lưới Tiếp thị Liên kết Master 2 tầng & Chi trả Kép (2-Tier Master Affiliate Network Expansion with Automated Tier Progression & VietQR/USDT Dual-Rail Payouts), thiết lập Cỗ máy Tối ưu Chi phí Đa Mô hình & Dự phòng Cạnh Lai (Multi-Model Cost Arbitrage & Hybrid Edge Fallback Engine with Real-Time Unit Economics Dashboard /admin/unit-economics), và xác thực triển khai sản xuất qua GitHub Actions CI/CD và Sophia Doctor 11/11 GREEN.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/mrr-roadmap.md
- MONEY_GRAPH.md
- BUSINESS_MODEL.md
- apps/sophia-ai-factory/CLAUDE.md
- AGENTS.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/src/land/growth/
- apps/sophia-ai-factory/src/land/affiliates/
- apps/sophia-ai-factory/src/tree/organizations/

## Requirements

### R1. Autonomous Client Retention & Anti-Churn AI Guardian
Xây dựng hệ thống tự động phát hiện nguy cơ rời bỏ và giữ chân khách hàng:
- Thuật toán tính toán Điểm Sức khỏe Khách hàng (Customer Health Score 0–100) dựa trên tần suất đăng nhập, số video tạo ra, số dư MCU, và tỷ lệ render lỗi.
- Tự động kích hoạt kịch bản chăm sóc phục hồi (Automated Win-Back Triggers) gửi qua Email (Resend) và Telegram Bot khi Health Score giảm dưới ngưỡng cảnh báo (< 40).
- Bổ sung màn hình Giám sát Sức khỏe Khách hàng vào `/admin/growth-analytics` với tính năng hỗ trợ founder can thiệp 1-click (tặng credit ưu đãi hoặc gửi tin nhắn hỗ trợ trực tiếp).

### R2. Self-Service Agency Workspace & Client Sub-Accounts (Phase 18 Scale)
Nâng cấp kiến trúc đa người dùng phục vụ các Agency quản lý nhiều khách hàng:
- Quản lý phân cấp Tài khoản phụ Khách hàng (`client_subaccounts`) cho phép Agency tạo không gian riêng biệt cho từng thương hiệu với logo, bảng màu và tên miền tùy chỉnh.
- Cơ chế phân bổ hạn ngạch MCU và phân quyền chi tiết (Agency Owner, Video Editor, Client Reviewer).
- Cổng Duyệt Video Khách hàng tương tác (`/client-review/[token]`, `/vi/client-review/[token]`): Khách hàng của Agency xem trước bản nháp video, bình luận phản hồi hoặc bấm Phê duyệt trước khi video được đăng tự động lên mạng xã hội.

### R3. 2-Tier Master Affiliate Network Expansion & Dual-Rail Payouts
Nâng cấp mạng lưới đối tác quy mô lớn và hỗ trợ thanh toán linh hoạt cho thị trường Việt Nam & Quốc tế:
- Tự động thăng hạng đối tác (Tier Progression Engine): Bạc (20%), Vàng (25%), Bạch Kim (30%) căn cứ theo doanh thu MRR kích hoạt thực tế.
- Bảng xếp hạng Đối tác Vinh danh trực tiếp (`/affiliate/leaderboard`, `/vi/affiliate/leaderboard`) hiển thị top 10 affiliate xuất sắc hàng tháng và phân bổ giải thưởng thưởng thêm.
- Hệ thống chi trả hoa hồng kênh đôi (Dual-Rail Payout Engine): Hỗ trợ thanh toán USDT tự động qua NOWPayments Mass-Payout API song song với tính năng xuất lệnh chuyển khoản VietQR chuẩn định dạng ngân hàng Việt Nam.

### R4. Multi-Model Cost Arbitrage & Hybrid Edge Fallback Engine
Tối ưu hóa lợi nhuận gộp (Unit Economics & Gross Margin) và loại bỏ điểm nghẽn hạ tầng:
- Bộ định tuyến AI thông minh (Cost-Arbitrage Router) tự động so sánh chi phí per-second giữa các nhà cung cấp (OpenRouter, fal.ai, ElevenLabs, và Mekong GPU cục bộ) để chọn lựa mô hình tối ưu theo ngân sách chiến dịch.
- Cơ chế Circuit Breaker và tự động chuyển đổi dự phòng (Automatic Fallback) tức thì sang nhà cung cấp phụ khi phát hiện lỗi hoặc độ trễ vượt ngưỡng.
- Dashboard Quản trị Hiệu quả Kinh tế Đơn vị (`/admin/unit-economics`, `/vi/admin/unit-economics`): Theo dõi biên lợi nhuận gộp thực tế (Gross Margin %), COGS hạ tầng trên mỗi video xuất bản, và tỷ lệ LTV:CAC theo thời gian thực.

### R5. Layer Architecture Discipline & Production CI/CD Verification
- Tuân thủ nghiêm ngặt cấu trúc 4 tầng Clean Architecture (`seed` → `tree` → `forest` → `land`) với 0 vi phạm.
- Duy trì 0 lỗi biên dịch TypeScript (`tsc --noEmit`) và 100% test pass rate trên các test suite mới và hiện có.
- Triển khai và xác thực thông qua GitHub Actions CI/CD (`.github/workflows/deploy.yml`), đảm bảo `shortSha` khớp bit-for-bit với live edge `https://sophia.agencyos.network/api/version`.
- Đảm bảo công cụ chẩn đoán Sophia Doctor báo cáo 11/11 GREEN (100% pass score).

## Acceptance Criteria

### Client Retention & Anti-Churn Guardian (R1)
- [ ] Customer Health Score được tính toán chính xác từ 4 tham số hoạt động trong D1.
- [ ] Luồng cảnh báo Win-Back tự động gửi thông báo qua email và Telegram khi điểm số suy giảm.
- [ ] Bảng điều khiển admin hiển thị danh sách khách hàng có nguy cơ rời bỏ kèm nút kích hoạt hỗ trợ.

### Agency Workspace & Client Review Portal (R2)
- [ ] Agency có thể khởi tạo tài khoản phụ cho khách hàng với hạn ngạch MCU độc lập.
- [ ] Link duyệt video `/client-review/[token]` hiển thị trình phát video bảo mật và ghi nhận trạng thái Phê duyệt/Yêu cầu chỉnh sửa.
- [ ] Phân quyền người dùng ngăn chặn rò rỉ dữ liệu giữa các khách hàng khác nhau.

### 2-Tier Affiliate Network & Dual-Rail Payouts (R3)
- [ ] Hệ thống tự động nâng hạng hoa hồng cho đối tác khi đạt mốc doanh thu giới thiệu.
- [ ] Bảng xếp hạng `/affiliate/leaderboard` hiển thị số liệu chính xác với hỗ trợ song ngữ VI/EN.
- [ ] Xuất file lệnh chi trả VietQR và tạo lệnh USDT mass payout thành công không trùng lặp.

### Cost Arbitrage & Unit Economics Dashboard (R4)
- [ ] Cost-Arbitrage Router lựa chọn nhà cung cấp có chi phí thấp nhất thỏa mãn yêu cầu chất lượng.
- [ ] Circuit breaker chuyển đổi dự phòng suôn sẻ khi nhà cung cấp chính gặp sự cố mô phỏng.
- [ ] Dashboard `/admin/unit-economics` biểu diễn chính xác Gross Margin, COGS per Video và LTV:CAC.

### Quality Gates & Production Deployment (R5)
- [ ] `npm run type-check` đạt 0 lỗi.
- [ ] `bash scripts/check-layer-boundaries.sh` đạt 0 vi phạm (100% clean architecture).
- [ ] Toàn bộ unit/integration test suites chạy đạt 100% pass rate.
- [ ] Deployed commit SHA khớp bit-for-bit với live edge `https://sophia.agencyos.network/api/version`.
- [ ] Sophia Doctor (`node scripts/sophia-doctor.mjs`) báo cáo 11/11 GREEN (100% pass score).

## 2026-09-24T07:15:21Z

Triển khai Cỗ máy Doanh nghiệp Nhãn trắng, SSO Đa Tổ chức & Mở rộng Nhà máy Video Tự động (Enterprise White-Label, Multi-Org SSO & Autonomous Video Factory Scale Engine) nhằm chinh phục cột mốc $25K–$50K+ MRR và mở rộng quy mô phục vụ 125–250+ khách hàng doanh nghiệp toàn cầu cho Sophia AI Factory: xây dựng Cỗ máy Cung cấp Tên miền Tùy chỉnh & Nhãn trắng Doanh nghiệp (Enterprise White-Label & Custom Domain SSL Provisioning Engine), triển khai Đăng nhập Một lần Doanh nghiệp SAML/OIDC & Kho Nhật ký Kiểm toán Mật mã Chống Thay đổi (Multi-Org SAML/OIDC SSO & Cryptographic Hash-Chain Audit Vault), thiết lập Cỗ máy Thanh toán Đa Tiền tệ & Hóa đơn Điện tử Xuyên Biên giới (Cross-Border Dual-Rail Billing, Dynamic Multi-Currency & Automated VAT/E-Invoicing), xây dựng Hàng đợi Lô Phân tán & Điều phối Lưới GPU Chia sẻ Công bằng (Distributed Batch Queue & Fair-Share GPU Mesh Scheduler), và xác thực triển khai sản xuất qua GitHub Actions CI/CD và Sophia Doctor 11/11 GREEN.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/mrr-roadmap.md
- MONEY_GRAPH.md
- BUSINESS_MODEL.md
- PROJECT.md
- apps/sophia-ai-factory/CLAUDE.md
- AGENTS.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/src/seed/types/custom-domains.ts
- apps/sophia-ai-factory/src/seed/types/audit-log.ts
- apps/sophia-ai-factory/src/seed/types/billing.ts
- apps/sophia-ai-factory/src/tree/organizations/

## Requirements

### R1. Enterprise White-Label & Custom Domain Hostname Provisioning Engine
Xây dựng giải pháp White-Label toàn diện cho các khách hàng gói Enterprise ($799/tháng) và Master ($4,999 trọn gói):
- Quản lý tên miền tùy chỉnh (Custom Domains) với quy trình tạo, xác thực CNAME / TXT record DNS và theo dõi trạng thái SSL Cloudflare for SaaS (pending_validation, active, error).
- Tùy biến thương hiệu đầy đủ (Tenant Branding): Tải lên logo, favicon, cấu hình bảng màu thương hiệu (Primary, Accent, Background CSS variables), tùy biến tiêu đề trang và văn bản chân trang.
- Trích xuất Tenant Context theo thời gian thực tại Edge dựa trên Host header hoặc subdomain/slug, tự động nạp cấu hình thương hiệu và cách ly tài nguyên giữa các khách thuê.
- Bảng điều khiển Quản trị Nhãn trắng song ngữ VI/EN (/admin/white-label, /vi/admin/white-label & /settings/white-label) cho phép cấu hình trực quan, xem trước giao diện trực tiếp (live branding preview) và kiểm tra trạng thái kích hoạt DNS.

### R2. Enterprise Multi-Org SAML/OIDC SSO & Cryptographic Hash-Chain Audit Vault
Nâng cấp bảo mật cấp doanh nghiệp đáp ứng tiêu chuẩn SOC 2 và quản trị danh tính tập trung:
- Hỗ trợ Enterprise SSO (SAML 2.0 & OIDC) tích hợp thông suốt với Better Auth cho các nhà cung cấp phổ biến (Google Workspace, Microsoft Entra ID / Azure AD, Okta) kèm tính năng tự động nhận diện tổ chức qua tên miền email công ty.
- Phân quyền tổ chức nâng cao (Multi-Org RBAC): Quản trị viên Doanh nghiệp (Enterprise Admin), Giám đốc Sản xuất (Creative Director), Kỹ thuật viên Video (Video Editor), và Người xem Xét duyệt (Reviewer).
- Kho Nhật ký Kiểm toán Mật mã Bất biến (enterprise_audit_events trong D1): Tự động ghi lại mọi hoạt động nhạy cảm (xuất bản video, cấp quota MCU, tạo API key, phê duyệt thanh toán đối tác, thay đổi phân quyền).
- Chuỗi băm SHA-256 chống thay đổi (content_hash = sha256(prev_hash + timestamp + action + actor + payload)), phát hiện ngay lập tức bất kỳ hành vi sửa đổi dữ liệu quá khứ nào.
- Trình khám phá Nhật ký Kiểm toán song ngữ (/admin/audit-vault, /vi/admin/audit-vault) hỗ trợ tìm kiếm, lọc theo ngày, actor, hành động và hiển thị huy hiệu xác thực tính toàn vẹn chuỗi băm (Chain Verified ✅).

### R3. Cross-Border Dual-Rail Billing, Dynamic Multi-Currency & Automated E-Invoicing
Mở rộng hạ tầng thanh toán đáp ứng khách hàng quốc tế và chuẩn hóa chứng từ kế toán:
- Công cụ Định giá & Hiển thị Đa Tiền tệ Thời gian thực: Tự động phát hiện và chuyển đổi tỷ giá giữa USD, VND, EUR, JPY, SGD với cơ chế bộ đệm tỷ giá (FX rate caching) an toàn.
- Cơ chế Khuyến mại Cam kết Năm (Annual Commitment Engine): Tự động áp dụng chiết khấu 20% (tặng 2 tháng miễn phí khi thanh toán theo năm), tính toán chi phí nâng cấp/hạ cấp linh hoạt (prorated upgrades/downgrades).
- Cỗ máy Xuất Hóa đơn Điện tử & Chứng từ Thuế Doanh nghiệp Tự động: Tạo hóa đơn PDF chuẩn kế toán (hỗ trợ Mã số thuế doanh nghiệp Việt Nam, tên công ty, địa chỉ, thuế suất VAT, cùng với chứng từ tuân thủ quốc tế W-8BEN/W-9).
- Hoàn thiện luồng Thanh toán Kênh Đôi: Tự động đối soát tức thì webhook NOWPayments USDT và PayOS VietQR theo mã định danh tài khoản phụ, gửi biên lai xác nhận ngay qua email Resend.

### R4. Distributed Batch Queue & Fair-Share GPU Mesh Scheduler
Tối ưu hóa năng lực kết xuất video đồng thời cho 125–250+ khách hàng doanh nghiệp:
- Hệ thống Hàng đợi Lô Phân tán (video_render_jobs queue) quản lý thông lượng cao, ngăn chặn việc nghẽn tiến trình trên Cloudflare Workers edge.
- Bộ điều phối Lưới GPU Chia sẻ Công bằng (Fair-Share GPU Scheduler): Phân làn ưu tiên (Priority Lane cho Enterprise với tốc độ xử lý tức thì vs Standard Lane cho Basic), giới hạn tần suất công bằng trên từng khách thuê để tránh tình trạng chiếm dụng hạ tầng độc quyền.
- Cơ chế Giám sát Sức khỏe Điểm cuối GPU & Chuyển đổi Dự phòng (Worker Health Monitor & Mesh Failover): Tự động điều hướng job sang các nhà cung cấp GPU phụ (fal.ai, Replicate, RunPod, Mekong GPU) khi phát hiện độ trễ vượt ngưỡng hoặc lỗi dịch vụ.
- Hàng đợi Thư chết (Dead-Letter Queue - DLQ) với cơ chế tự động thử lại theo cấp số nhân (exponential backoff) và gửi thông báo cảnh báo tức thì qua Telegram/Better Stack webhook khi job thất bại quá số lần quy định.

### R5. Layer Architecture Discipline & Production CI/CD Verification
- Tuân thủ nghiêm ngặt mô hình 4 tầng Clean Architecture (seed → tree → forest → land) với 0 vi phạm (kiểm tra bằng bash scripts/check-layer-boundaries.sh).
- Đạt 0 lỗi biên dịch TypeScript (npm run type-check).
- Toàn bộ unit/integration test suites mới và hiện có đạt tỷ lệ pass 100%.
- Triển khai và xác thực thông qua GitHub Actions CI/CD (.github/workflows/deploy.yml), đảm bảo shortSha khớp bit-for-bit với live edge https://sophia.agencyos.network/api/version.
- Đảm bảo công cụ chẩn đoán Sophia Doctor báo cáo 11/11 GREEN (node apps/sophia-ai-factory/scripts/sophia-doctor.mjs).

## Acceptance Criteria

### Enterprise White-Label & Custom Domains (R1)
- [ ] D1 schema và repository hỗ trợ đăng ký, lưu trữ và tra cứu cấu hình tên miền tùy chỉnh cùng chứng chỉ SSL.
- [ ] Tenant Branding Engine tự động áp dụng logo, favicon và bảng màu CSS động tương ứng theo request hostname.
- [ ] Giao diện /admin/white-label cho phép xem trước trực quan (live preview) và kiểm tra trạng thái xác thực DNS CNAME/TXT.

### Multi-Org SSO & Cryptographic Audit Vault (R2)
- [ ] Cấu hình Better Auth tích hợp SAML 2.0 / OIDC với định tuyến tự động theo tên miền email tổ chức.
- [ ] Bảng enterprise_audit_events lưu trữ nhật ký với chuỗi băm SHA-256 (content_hash, prev_hash) được bảo vệ toàn vẹn.
- [ ] Giao diện /admin/audit-vault hiển thị nhật ký kiểm toán với bộ lọc ngày, tác vụ và xác thực chuỗi băm thành công.

### Dynamic Multi-Currency & Automated E-Invoicing (R3)
- [ ] Bộ chuyển đổi đa tiền tệ hỗ trợ USD, VND, EUR, JPY, SGD với dữ liệu tỷ giá cập nhật.
- [ ] Luồng thanh toán năm áp dụng chiết khấu 20% và tính toán bù trừ prorated khi thay đổi gói dịch vụ.
- [ ] Trình tạo hóa đơn tự động xuất biên lai/hóa đơn PDF có đầy đủ mã số thuế, thông tin công ty và phân bổ chi phí.

### Distributed Video Queue & GPU Mesh Scheduler (R4)
- [ ] Hàng đợi video_render_jobs xử lý job theo phân làn ưu tiên (Enterprise vs Basic) và giới hạn công bằng theo tenant.
- [ ] Bộ điều phối tự động chuyển đổi sang GPU thay thế khi một nhà cung cấp gặp lỗi hoặc nghẽn mạng.
- [ ] DLQ ghi nhận job lỗi và kích hoạt cơ chế retry backoff kèm cảnh báo qua webhook.

### Quality Gates & Production Edge Verification (R5)
- [ ] npm run type-check đạt 0 lỗi biên dịch.
- [ ] bash scripts/check-layer-boundaries.sh đạt 0 vi phạm (100% clean architecture).
- [ ] Toàn bộ unit/integration test suites chạy đạt 100% pass rate.
- [ ] Deployed commit SHA khớp bit-for-bit với live edge https://sophia.agencyos.network/api/version.
- [ ] Sophia Doctor (node apps/sophia-ai-factory/scripts/sophia-doctor.mjs) báo cáo 11/11 GREEN (100% pass score).

## 2026-09-24T16:38:00Z

Triển khai Cỗ máy Lồng tiếng Video AI Đa ngôn ngữ APAC, Chợ Nhà sáng tạo & Lưới Phát hành Đa nền tảng Tự động (APAC Multi-Language AI Video Dubbing, Creator Marketplace & Autonomous Syndication Mesh Engine) nhằm chinh phục cột mốc $100,000 MRR và phục vụ 500 khách hàng trả phí khu vực Châu Á - Thái Bình Dương cho Sophia AI Factory: xây dựng Cỗ máy Lồng tiếng Video & Bản địa hóa 5 Ngôn ngữ APAC (APAC 5-Language Video Voice Dubbing & AI Translation Engine: VI, EN, JA, KO, TH kèm phụ đề tự động SRT/VTT), triển khai Chợ Mẫu Video Nhà sáng tạo & Giao thức Chia sẻ Doanh thu 70/30 (Autonomous Creator Marketplace & 70/30 Royalty Revenue-Sharing Protocol với Cổng Quản trị /creator/studio), xây dựng Cỗ máy Lên lịch & Phát hành Đa nền tảng Tự động (Multi-Platform Automated Video Syndication cho YouTube Shorts, TikTok, Instagram Reels, Facebook Reels với bộ tối ưu múi giờ vàng APAC), thiết lập Hệ thống Phát Video Luồng Thích ứng & Mạng Phân phối Cạnh Toàn cầu (Global Edge CDN Video Caching & Adaptive HLS Streaming qua Cloudflare Stream & R2 với hình mờ bản quyền động), và xác thực triển khai sản xuất qua GitHub Actions CI/CD và Sophia Doctor 11/11 GREEN.

Working directory: /Users/macbook/sophia-ai-factory
Integrity mode: development

References:
- docs/mrr-roadmap.md
- MONEY_GRAPH.md
- BUSINESS_MODEL.md
- apps/sophia-ai-factory/CLAUDE.md
- AGENTS.md
- apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md
- apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md
- apps/sophia-ai-factory/src/land/video/publishing/
- apps/sophia-ai-factory/src/forest/publishing/
- apps/sophia-ai-factory/src/seed/types/creator-marketplace.ts
- apps/sophia-ai-factory/src/tree/creator-royalties/

## Requirements

### R1. APAC Multi-Language Localization & Autonomous Video Voice Dubbing Engine
Mở rộng tệp khách hàng sang các thị trường tăng trưởng cao tại khu vực APAC (Việt Nam, Nhật Bản, Hàn Quốc, Thái Lan, Singapore):
- Hệ thống Lồng tiếng Video AI Tự động (Video Voice Dubbing Pipeline): Tự động trích xuất âm thanh, phiên âm lời thoại (Whisper/STT), dịch thuật ngữ cảnh sang 5 ngôn ngữ (Tiếng Việt, Tiếng Anh, Tiếng Nhật, Tiếng Hàn, Tiếng Thái) và sinh âm thanh lồng tiếng chuẩn bản xứ (ElevenLabs / Edge TTS) đồng bộ theo nhịp video.
- Tạo tệp phụ đề đa ngôn ngữ đồng bộ (SRT / VTT subtitles) và xuất bản video hỗ trợ đa luồng âm thanh hoặc video hardcoded subtitle theo yêu cầu chiến dịch.
- Bộ định tuyến bản địa hóa thông minh: Tự động nhận diện ngôn ngữ trình duyệt / vị trí địa lý của khách hàng để hiển thị giao diện, video mẫu và trang thanh toán tương ứng.

### R2. Autonomous Creator Marketplace & 70/30 Royalty Revenue-Sharing Protocol
Mở rộng kho ý tưởng và mẫu video bằng cách kết nối các chuyên gia sáng tạo nội dung hàng đầu:
- Kho Lưu trữ Mẫu Video Nhà sáng tạo (creator_templates trong D1): Cho phép Top Creator và Agency đóng gói các kịch bản video viral, cấu trúc storyboard, prompt phong cách hình ảnh và âm nhạc bản quyền thành các Mẫu (Templates) có thể tái sử dụng.
- Giao thức Phân bổ Doanh thu Tự động (70/30 Royalty Split): Tự động trích 70% phí mẫu cho tác giả và 30% cho nền tảng Sophia AI Factory mỗi khi mẫu được người dùng kích hoạt tạo video.
- Cổng Quản trị Nhà sáng tạo song ngữ VI/EN (/creator/studio, /vi/creator/studio): Theo dõi lượt sử dụng mẫu, doanh thu lũy kế, tỷ lệ đánh giá và yêu cầu rút tiền hoa hồng về ví USDT hoặc tài khoản ngân hàng VietQR.

### R3. Multi-Platform Automated Syndication & APAC Peak-Time Scheduling Engine
Tự động hóa hoàn toàn quy trình phân phối video lên tất cả các mạng xã hội video ngắn:
- Bộ phát hành tự động đa kênh (Omnichannel Video Publisher): Tích hợp trực tiếp API xuất bản của YouTube Shorts, TikTok, Instagram Reels, và Facebook Reels với cơ chế xác thực token OAuth2 và tự động làm mới (auto-refresh).
- Bộ Tối ưu hóa Giờ Vàng Đăng bài APAC (Smart Time-Zone Optimizer): Thuật toán phân tích khung giờ vàng tương tác cao nhất cho từng thị trường (Hà Nội UTC+7: 11:30 & 19:30; Tokyo UTC+9: 12:00 & 20:00; Bangkok UTC+7: 12:00 & 20:30) và tự động xếp hàng phát hành video.
- Bộ tạo Siêu dữ liệu Lan truyền (Viral Metadata Generator): Tự động tạo tiêu đề giật gân (hook title), mô tả video tối ưu SEO theo ngôn ngữ đích, danh sách hashtag thịnh hành và ảnh đại diện thumbnail tối ưu CTR.

### R4. Global Edge CDN Video Caching & Adaptive HLS Streaming Engine
Nâng cấp trải nghiệm xem video tức thì với độ trễ 0ms trên mạng di động toàn cầu:
- Trình phát Video Luồng Thích ứng (Adaptive Bitrate HLS/m3u8 Streaming): Tự động chuyển mã video sang nhiều độ phân giải (1080p, 720p, 480p) qua Cloudflare Stream & R2, cho phép xem trước video mượt mà không bị giật lag.
- Đóng dấu Bản quyền Pháp y Động (Dynamic Forensic Watermarking): Tự động nhúng watermark mờ bán trong suốt (Logo hoặc Tenant ID của khách hàng) vào bản xem trước để chống sao chép trái phép.
- Cơ chế Bảo vệ Bản quyền Liên kết: Tạo liên kết tải video có chữ ký điện tử mã hóa (Signed Download URLs) tự động hết hạn sau 24 giờ để ngăn chặn rò rỉ băng thông và liên kết ngoài luồng.

### R5. Layer Architecture Discipline & Production CI/CD Verification
- Tuân thủ nghiêm ngặt mô hình 4 tầng Clean Architecture (seed → tree → forest → land) với 0 vi phạm (kiểm tra bằng bash scripts/check-layer-boundaries.sh).
- Đạt 0 lỗi biên dịch TypeScript (npm run type-check).
- Toàn bộ unit/integration test suites mới và hiện có đạt tỷ lệ pass 100%.
- Triển khai và xác thực thông qua GitHub Actions CI/CD (.github/workflows/deploy.yml), đảm bảo shortSha khớp bit-for-bit với live edge https://sophia.agencyos.network/api/version.
- Đảm bảo công cụ chẩn đoán Sophia Doctor báo cáo 11/11 GREEN (node apps/sophia-ai-factory/scripts/sophia-doctor.mjs).

## Acceptance Criteria

### APAC Video Dubbing & AI Translation (R1)
- [ ] Pipeline lồng tiếng hỗ trợ chuyển ngữ âm thanh và phụ đề cho 5 ngôn ngữ: VI, EN, JA, KO, TH.
- [ ] File phụ đề SRT/VTT được sinh tự động với mốc thời gian chính xác khớp với khung hình video.
- [ ] Giao diện và video mẫu tự động thích ứng theo ngôn ngữ được chọn.

### Creator Marketplace & Royalty Revenue-Sharing (R2)
- [ ] D1 schema quản lý mẫu video của nhà sáng tạo với cơ chế phê duyệt và đánh giá chất lượng.
- [ ] Tỷ lệ chia sẻ doanh thu 70/30 được tính toán chính xác và ghi nhận tự động vào số dư ví của Creator.
- [ ] Cổng /creator/studio hiển thị bảng phân tích doanh thu và hỗ trợ yêu cầu rút tiền qua USDT/VietQR.

### Multi-Platform Video Syndication & Peak-Time Scheduling (R3)
- [ ] Hệ thống hỗ trợ lên lịch xuất bản tự động tới YouTube Shorts, TikTok, Instagram Reels và Facebook Reels.
- [ ] Bộ định thời gian tối ưu tự động sắp xếp video vào khung giờ vàng theo múi giờ địa phương của từng khu vực.
- [ ] Trình tạo siêu dữ liệu tự động gắn thẻ hashtag thịnh hành và mô tả bản địa hóa cho từng nền tảng.

### Global Edge CDN & Adaptive HLS Streaming (R4)
- [ ] HLS stream manifest (.m3u8) phát video mượt mà ở các độ phân giải thích ứng (1080p, 720p, 480p).
- [ ] Watermark định danh khách hàng được đóng dấu chính xác lên video render.
- [ ] URL tải video có chữ ký bảo mật và tự động hết hạn sau 24 giờ.

### Quality Gates & Production CI/CD Parity (R5)
- [ ] npm run type-check đạt 0 lỗi biên dịch.
- [ ] bash scripts/check-layer-boundaries.sh đạt 0 vi phạm (100% clean architecture).
- [ ] Toàn bộ unit/integration test suites chạy đạt 100% pass rate.
- [ ] Deployed commit SHA khớp bit-for-bit với live edge https://sophia.agencyos.network/api/version.
- [ ] Sophia Doctor (node apps/sophia-ai-factory/scripts/sophia-doctor.mjs) báo cáo 11/11 GREEN (100% pass score).



