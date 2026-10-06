# Project: Full-Stack AGY (AgencyOS Multi-Tenancy, Agent Governance YAML, Client Onboarding & Agency Portal)

## Architecture
Clean 4-Layer Architecture (`seed` -> `tree` -> `forest` -> `land`) for Sophia AI Factory on Cloudflare Workers edge:
- **Seed Layer (`src/seed/`)**: Pure types, interfaces, Zod schemas, AGY YAML parsers, tenant context tokens, and database tenant scoping (`withTenantScope`). Strictly zero dependencies on upper layers.
- **Tree Layer (`src/tree/`)**: Pure deterministic domain logic with zero side effects. Contains domain router (`[agencySlug].agencyos.network`), tenant token cryptographic verification, agency quota calculators, sliding-window rate limit algorithms, AGY policy enforcement engine (L0–L4 autonomy, compute caps, allow/deny precedence, SHA-256 digests), and revenue attribution models.
- **Forest Layer (`src/forest/`)**: Edge middleware, background workers, and rich UI components. Contains `agy-tenant-isolation.ts` middleware, `agency-onboarding-wizard.tsx`, and `agency-admin-portal.tsx`. Never imported by `land`.
- **Land Layer (`src/land/`) & App Routes (`src/app/`)**: User-facing Server Actions, D1 database transactions, audit logging, and Next.js App Router controllers (`/agency`, `/agency/onboarding`). Calls `tree` for domain logic and `seed` for types/database clients.

## Feature Inventory
Every feature required by user request 2026-10-06T05:07:29Z is enumerated below:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Multi-Agency Domain Router | Maps `[agencySlug].agencyos.network` and custom domains to tenant organizations via Cloudflare edge routing | M1 | Survey (R1) |
| 2 | Reserved Domain Partitioning | Distinguishes platform reserved subdomains (`sophia`, `api`, `admin`, `portal`, `sub`) from dynamic customer agency slugs | M1 | Survey (R1) |
| 3 | D1 Row-Level Tenant Isolation | Schema and row-level tenant token isolation (`agency_id` / `org_id`) with registration in `withTenantScope` | M1 | Survey (R1) |
| 4 | D1 Multi-Tenancy Migrations | Tables `agy_tenant_configs`, `agy_tenant_tokens`, `agy_agency_domains`, `agy_audit_logs` in migration `0435` | M1 | Survey (R1) |
| 5 | Edge Tenant Isolation Middleware | Edge middleware enforcing tenant scoping, cross-tenant blocking, and request decoration | M1 | Survey (R1) |
| 6 | Agency Rate-Limiting & Quota Engine | Sliding-window request rate-limiting (HTTP 429) and monthly compute quota enforcement (HTTP 402) | M1 | Survey (R1) |
| 7 | Multi-Tenancy Server Actions | Server Actions in `src/land/agy/agency-tenant-actions.ts` for domain binding and tenant token lifecycle | M1 | Survey (R1) |
| 8 | Declarative AGY YAML Schema | Zod and TypeScript schemas for Agent Governance YAML (capabilities, permissions, compute caps, escalation) | M2 | Survey (R2) |
| 9 | Safe AGY Parser & Size Guard | Memory-safe YAML parser using `js-yaml` with a 512KB payload cap for Cloudflare Workers edge runtime | M2 | Survey (R2) |
| 10 | AGY Pure Policy Enforcement Engine | Pure domain engine in `tree/governance/` evaluating L0–L4 autonomy, compute caps, and allow/deny precedence | M2 | Survey (R2) |
| 11 | Deterministic SHA-256 Policy Digest | Generates tamper-evident SHA-256 evaluation digest and escalation triggers for every policy evaluation | M2 | Survey (R2) |
| 12 | D1 AGY Policy Audit Ledger | Migration `0436` creating `agy_policy_audit_ledger` with tamper-evident indices and query actions | M2 | Survey (R2) |
| 13 | AGY Governance Server Actions | Server Actions in `src/land/governance/agy-actions.ts` for policy registration, validation, and audit queries | M2 | Survey (R2) |
| 14 | Agency Client Onboarding Wizard | 5-step onboarding wizard at `/agency/onboarding` (Profile → Branding → Custom Domain → Seed Agents → Launch) | M3 | Survey (R3) |
| 15 | White-Label Branding Engine | Custom agency branding, logo upload, color theming, and real-time unbranded client preview | M3 | Survey (R3) |
| 16 | Seed Agent Deployment Flow | Deploys pre-configured seed agents (Video Creator, UGC Reviewer, Outreach Bot) bound to AGY governance policies | M3 | Survey (R3) |
| 17 | High-Performance Agency Portal | Responsive admin portal at `/agency` for agency owners: KPI metrics, client management, campaign tracking | M3 | Survey (R3) |
| 18 | Agency Revenue Attribution Ledger | Real-time attribution and client subaccount tracking for agency MRR and video credit usage | M3 | Survey (R3) |
| 19 | Bilingual Jargon-Free UI Copy | Full Vietnamese and English localization in `messages/vi.json` and `messages/en.json` explaining concepts cleanly | M3 | Survey (R3) |
| 20 | Protected Flows Preservation | Preserves `/setup-wizard`, Telegram Commander Bot, and NOWPayments IPN 100% intact | M4 | Survey (R4) |
| 21 | Clean 4-Layer Architecture Enforcement | `bash scripts/check-layer-boundaries.sh` reports exactly 0 violations across all codebase layers | M4 | Survey (R4) |
| 22 | Strict TypeScript Compilation | `npm --prefix apps/sophia-ai-factory run type-check` returns exit code 0 with 0 errors and zero `:any` types | M4 | Survey (R4) |
| 23 | Clean ESLint Standards | `npm --prefix apps/sophia-ai-factory run lint` completes with 0 errors | M4 | Survey (R4) |
| 24 | Complete Test Suite Coverage | 100% test pass rate across all unit, integration, and stress tests (`npx vitest run`) | M4 | Survey (R4) |
| 25 | Root Wrapper Script Parity | Repository root wrapper `scripts/zero-bug-verify.sh` forwarding to `apps/sophia-ai-factory/scripts/` | M4 | Survey (R4) |
| 26 | 9/9 Zero-Bug Certification | `bash apps/sophia-ai-factory/scripts/zero-bug-verify.sh --quick` achieves 9/9 PASS with 100/100 score | M4 | Survey (R4) |
| 27 | Cloudflare Workers Edge Deployment | Direct deploy via `EMERGENCY_CF_DIRECT=1 ALLOW_UNPUSHED_DEPLOY=1 SKIP_SYMBOL_UPLOAD=1 ./scripts/deploy-with-sha.sh` | M4 | Survey (R4) |
| 28 | Live Edge SHA & Health Verification | Bit-for-bit SHA match at `https://sophia.agencyos.network/api/version` and HTTP 200 at `/api/health` | M4 | Survey (R4) |
| 29 | Opaque-Box E2E Test Suite | End-to-end tests covering Tiers 1-4 across multi-tenancy, governance, onboarding, and portal flows | E2E | Survey (E2E) |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | AGY Multi-Tenancy & Tenant Isolation | Features 1–7: Migration 0435, seed types, tree domain router, quota engine, forest middleware, land actions | none | DONE |
| M2 | Agent Governance YAML Schema & Engine | Features 8–13: Migration 0436, seed parser, tree policy engine, audit ledger, land actions | M1 | DONE |
| M3 | Agency Client Onboarding & Portal Experience | Features 14–19: Onboarding wizard, agency admin portal, seed agent deployment, attribution, bilingual copy | M1, M2 | PLANNED |
| M4 | Zero-Bug Quality Invariants & Production Edge Deployment | Features 20–28: Quality checks, root wrapper, 9/9 zero-bug certification, edge deploy, live SHA verification | M1, M2, M3, E2E | PLANNED |
| E2E | E2E Testing Track | Feature 29: Comprehensive opaque-box test suites (Tiers 1-4), test runner, and `TEST_READY.md` publication | none | DONE |

## Interface Contracts

### M1 (Multi-Tenancy) ↔ Core Middleware & M2/M3
- `AgencyTenantContext`: `{ agencyId: string; orgId: string; agencySlug: string; customDomain?: string; quotaLimitMcu: number; quotaUsedMcu: number; rateLimitRps: number }`
- `TenantResolutionResult`: `{ isAgencySubdomain: boolean; isCustomDomain: boolean; agencySlug: string | null; tenantOrgId: string | null; agencyId: string | null }`
- `AgyTenantToken`: `{ token: string; agencyId: string; permissions: string[]; expiresAt: number; signature: string }`

### M2 (Governance Engine) ↔ Agent Runtime & M3
- `AgentGovernanceYaml`: `{ schemaVersion: string; agent: { id: string; name: string; role: string; maxAutonomyLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' }; compute: { maxTokensPerRun: number; maxComputeUnitsMcu: number }; permissions: { allow: string[]; deny: string[] }; escalation: { onQuotaExceeded: 'halt' | 'request_approval'; onDisallowedAction: 'halt' | 'escalate_human' } }`
- `PolicyEvaluationRequest`: `{ agencyId: string; agentId: string; action: string; requestedAutonomy: 'L0'|'L1'|'L2'|'L3'|'L4'; requestedComputeUnits: number; metadata?: Record<string, unknown> }`
- `PolicyEvaluationVerdict`: `{ allowed: boolean; reason: string; requiredAutonomy: 'L0'|'L1'|'L2'|'L3'|'L4'; escalationTriggered: boolean; evaluationSha256: string }`

### M3 (Onboarding & Portal) ↔ Multi-Tenancy & Governance
- `AgencyOnboardingInput`: `{ agencyName: string; agencySlug: string; customDomain?: string; primaryColor?: string; logoUrl?: string; seedAgents: Array<{ role: string; template: string; maxAutonomy: 'L0'|'L1'|'L2'|'L3'|'L4' }> }`
- `AgencyPortalOverview`: `{ agencyId: string; agencyName: string; totalClients: number; activeCampaigns: number; totalMcuConsumed: number; estimatedMrrUsd: number }`

## Code Layout
```
apps/sophia-ai-factory/
├── migrations/
│   ├── 0435_agy_multitenancy_and_tenant_isolation.sql   # M1: Multi-tenancy D1 tables
│   └── 0436_agent_governance_yaml_and_audit_ledger.sql  # M2: AGY audit ledger tables
├── src/
│   ├── seed/
│   │   ├── types/
│   │   │   ├── agy-multitenancy.ts                      # M1: Multi-tenancy types
│   │   │   ├── agent-governance.ts                      # M2: AGY schema & evaluation types
│   │   │   └── agency-portal.ts                         # M3: Onboarding & Portal types
│   │   ├── validators/
│   │   │   ├── agy-schema.ts                            # M2: Zod AGY schema
│   │   │   └── agy-parser.ts                            # M2: YAML parser with size guard
│   │   └── db/
│   │       └── with-tenant-scope.ts                     # M1: Register AGY tenant tables
│   ├── tree/
│   │   ├── agy/
│   │   │   ├── domain-router.ts                         # M1: Agency subdomain & custom domain resolver
│   │   │   ├── tenant-token-engine.ts                   # M1: Token generation & HMAC verification
│   │   │   └── agency-quota-engine.ts                   # M1: Sliding-window rate-limiter & quota engine
│   │   ├── governance/
│   │   │   └── agy-policy-engine.ts                     # M2: Pure policy enforcement & evaluation SHA-256
│   │   └── agency/
│   │       ├── attribution-engine.ts                    # M3: Revenue attribution & client usage
│   │       └── onboarding-validator.ts                  # M3: Agency slug & branding validator
│   ├── forest/
│   │   ├── middleware/
│   │   │   └── agy-tenant-isolation.ts                  # M1: Tenant isolation & quota middleware
│   │   └── agency/
│   │       ├── agency-onboarding-wizard.tsx             # M3: 5-step onboarding wizard component
│   │       └── agency-admin-portal.tsx                  # M3: Agency management portal component
│   ├── land/
│   │   ├── agy/
│   │   │   └── agency-tenant-actions.ts                 # M1: Server actions for tenant management
│   │   ├── governance/
│   │   │   └── agy-actions.ts                           # M2: Server actions for policy evaluation
│   │   └── agency/
│   │       └── agency-portal-actions.ts                 # M3: Server actions for onboarding & portal
│   ├── app/
│   │   └── [locale]/(app)/
│   │       └── agency/
│   │           ├── page.tsx                             # M3: Agency Admin Portal page
│   │           └── onboarding/page.tsx                  # M3: Agency Onboarding Wizard page
│   └── middleware.ts                                    # M1: Wire AGY domain & tenant router
├── messages/
│   ├── en.json                                          # M3: English translations (no jargon)
│   └── vi.json                                          # M3: Vietnamese translations (no jargon)
└── tests/
    └── e2e/
        └── agy-fullstack.test.ts                        # E2E Track: Comprehensive E2E test suite
```
