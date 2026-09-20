# Project: Sophia AI Factory — Phase 20: 100/100 Automated Customer Handover, Project Closeout & Operational Acceptance Engine

## Architecture
- Layer discipline: Canonical 4-layer hierarchy (`seed` → `tree` → `forest` → `land`).
  - `seed`: Type definitions (`verification-types.ts`, `handover-types.ts`), crypto utility (`certificate-hasher.ts`).
  - `tree`: Core domain engines: `customer-handover-service.ts`, `handover-certificate-engine.ts`, `day1-verification-engine.ts`, `dr-drill-executor.ts`, `env-export-generator.ts`, `runbook-catalog-service.ts`.
  - `forest`: Composite workflows and UI orchestrations: `verification-orchestrator.ts`, `handover-acceptance-client.tsx`, `handover-admin-console-client.tsx`, `runbook-reader-client.tsx`.
  - `land`: Next.js 16 App Router pages and API routes:
    - Customer portal: `src/app/[locale]/dashboard/handover/page.tsx`
    - Admin console: `src/app/(app)/admin/handover/page.tsx`
    - Runbook reader: `src/app/[locale]/dashboard/docs/runbooks/page.tsx` & `[slug]/page.tsx`
    - Verification API: `src/app/api/admin/handover/verify/route.ts`
    - Env export API: `src/app/api/admin/handover/export-env/route.ts`
    - Server actions: `src/land/actions/handover-actions.ts`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | D1 Schema Migration `0280` | Adds `acceptance_status`, `signer_name`, `signer_email`, `signer_role`, `certificate_hash`, `verification_results`, `signed_at`, `verification_passed_at` to `customer_handovers` | M1 | Survey |
| 2 | Handover Domain Engine & Service | DB queries and state updates for customer handovers, certificates, and verification runs | M1 | Survey |
| 3 | Certificate Hasher & Generator | SHA-256 tamper-evident certificate generator with canonical JSON and markdown export | M1 | Survey |
| 4 | Environment Sanitizer | Generates clean `.env.production` bundle matching `env.example`, masking secrets while preserving structure | M1 | Survey |
| 5 | Runbook Catalog Service | Ingests and renders 10 operational SOPs with bilingual support and offline export | M1 | Survey |
| 6 | 11-Checkpoint Verification Probes | Individual probes for Edge, D1 CRUD, R2 bindings, Auth, NOWPayments, Telegram, Better Stack, DR drill, BYOK encryption, Runbooks, SHA parity | M2 | Survey |
| 7 | Verification Orchestrator & API | Concurrent runner at `/api/admin/handover/verify` producing JSON diagnostics | M2 | Survey |
| 8 | Automated DR Drill Executor | Probes D1 read/write consistency, verifies R2 `BACKUPS_BUCKET` snapshots, and validates restore schemas | M2 | Survey |
| 9 | Handover Server Actions | `signHandoverAcceptanceAction`, `triggerHandoverVerificationAction`, `exportSanitizedEnvAction` | M2 | Survey |
| 10 | Customer Handover Portal (`/dashboard/handover`) | Bilingual customer acceptance interface with deliverables audit, health card, founder checklist, and sign-off | M3 | Survey |
| 11 | Admin Handover Console (`/admin/handover`) | Operator console for tracking tenant handovers, running automated Day-1 tests, and inspecting certificates | M3 | Survey |
| 12 | Customer Runbook Reader (`/dashboard/docs/runbooks`) | In-app reader for 10 operational SOPs with bilingual toggle, code copy, and Markdown/HTML export | M3 | Survey |
| 13 | Sidebar Navigation & i18n | Navigation links in customer dashboard and admin sidebar; full EN/VI translations | M3 | Survey |
| 14 | Unit & Integration Test Suite | Comprehensive tests for verification runner, certificate engine, env sanitizer, and runbook service | M4 | Survey |
| 15 | Layer Boundary & Type Safety Checks | 0 layer boundary violations (`scripts/check-layer-boundaries.sh`), 0 TypeScript errors | M4 | Survey |
| 16 | Adversarial Challenger & Forensic Audit | Verification against mock implementations and edge case robustness | M4 | Survey |
| 17 | Remote Cloudflare D1 Migration | Apply `0280_customer_handover_acceptance.sql` to production `sophia-raas-db` | M5 | Survey |
| 18 | CF-Direct Production Deployment | Deploy to Cloudflare Workers via `npm run deploy:full`, verify live SHA match | M5 | Survey |
| 19 | Sophia Doctor 11/11 Certification | Execute `node scripts/sophia-doctor.mjs` verifying 100% green health on production | M5 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | D1 Migration & Core Domain Engine | Schema migration 0280, seed types, certificate hasher, handover service, env sanitizer, runbook service | none | PLANNED |
| 2 | CEO Day-1 Verification Engine & APIs | 11-checkpoint probes, DR drill executor, verification orchestrator, `/api/admin/handover/verify`, server actions | M1 | PLANNED |
| 3 | Handover Portals, Admin Console & UI | Customer portal (`/dashboard/handover`), Admin console (`/admin/handover`), Runbook reader (`/dashboard/docs/runbooks`), sidebar nav, i18n | M1, M2 | PLANNED |
| 4 | Dual-Track Testing & Quality Gates | Vitest unit/integration tests, E2E test verification, layer boundary checks, typecheck, challenger & forensic audit | M1, M2, M3 | PLANNED |
| 5 | Remote D1 Migration, Deploy & Doctor 11/11 | Remote D1 migration, CF-direct deploy, live edge SHA match, Sophia Doctor 11/11 GREEN, final closeout | M4 | PLANNED |

## Interface Contracts
### `src/seed/handover/handover-types.ts`
- Data models for `CustomerHandoverRecord`, `HandoverAcceptanceInput`, `HandoverCertificate`, `VerificationRunReport`, `CheckpointResult`.

### `src/seed/handover/certificate-hasher.ts`
- `export async function generateCertificateSha256(payload: HandoverCertificatePayload): Promise<string>`
- `export async function verifyCertificateSha256(payload: HandoverCertificatePayload, expectedHash: string): Promise<boolean>`

### `src/tree/handover/customer-handover-service.ts`
- `getCustomerHandover(db: D1Database, userIdOrHandoverId: string): Promise<CustomerHandoverRecord | null>`
- `listAllCustomerHandovers(db: D1Database, filter?: HandoverFilter): Promise<CustomerHandoverRecord[]>`
- `recordHandoverAcceptance(db: D1Database, input: HandoverAcceptanceInput): Promise<HandoverCertificate>`

### `src/tree/handover/day1-verification-engine.ts`
- `runAllDay1Probes(env: CloudflareEnv, options?: ProbeOptions): Promise<VerificationRunReport>`

### `src/tree/handover/dr-drill-executor.ts`
- `executeDrDrillProbe(env: CloudflareEnv): Promise<DrDrillResult>`

### `src/tree/handover/env-export-generator.ts`
- `generateSanitizedEnvProduction(envExampleContent: string, currentEnv: Record<string, string | undefined>): { sanitizedContent: string; missingKeys: string[]; totalKeys: number }`

### `src/tree/handover/runbook-catalog-service.ts`
- `getRunbookCatalog(locale: 'en' | 'vi'): RunbookMetadata[]`
- `getRunbookContent(slug: string, locale: 'en' | 'vi'): Promise<RunbookContent | null>`

## Code Layout
- `apps/sophia-ai-factory/migrations/0280_customer_handover_acceptance.sql`
- `apps/sophia-ai-factory/src/seed/handover/`
- `apps/sophia-ai-factory/src/tree/handover/`
- `apps/sophia-ai-factory/src/forest/handover/`
- `apps/sophia-ai-factory/src/forest/components/handover/`
- `apps/sophia-ai-factory/src/forest/components/runbooks/`
- `apps/sophia-ai-factory/src/land/actions/handover-actions.ts`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/handover/page.tsx`
- `apps/sophia-ai-factory/src/app/(app)/admin/handover/page.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/docs/runbooks/`
- `apps/sophia-ai-factory/src/app/api/admin/handover/`
- `apps/sophia-ai-factory/tests/handover/`
