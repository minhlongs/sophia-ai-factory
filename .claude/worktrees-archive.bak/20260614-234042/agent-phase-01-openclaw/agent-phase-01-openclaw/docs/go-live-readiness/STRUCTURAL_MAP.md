# Repository Structural Mapping

This document mappings the directory structure of the Sophia AI Factory workspace, defining the purpose, boundary interfaces, dependencies, runtime roles, and architectural risk profiles for each module.

---

## 1. Directory Structural Overview

```
sophia-ai-factory/
├── apps/
│   ├── 84tea/                        # Independent landing/ecommerce application (Low risk)
│   └── sophia-ai-factory/            # Primary Sophia Platform Application (High risk)
│       ├── src/
│       │   ├── app/                  # App Router Pages and API Routing Layer (Land)
│       │   ├── forest/               # Jobs, Emailing, and Integration Workflows (Forest)
│       │   ├── land/                 # Controllers, State Reducers, and Custom Views (Land)
│       │   ├── lib/                  # Shared Business Logic and Helper Repositories (Tree/Forest)
│       │   ├── seed/                 # Database Clients, Logger, Utility Tools (Seed)
│       │   └── tree/                 # Core Cryptography, User Management Services (Tree)
│       ├── scripts/                  # Build scripts, Cron Injections, Migrations (High risk)
│       └── tests/                    # Load tests and End-to-End browser scenarios (Medium risk)
├── docs/                             # Architecture Diagrams and SOP Playbooks (Low risk)
└── package.json                      # Workspace Root Configuration
```

---

## 2. Directory Boundaries and Specifications

### `apps/sophia-ai-factory`
- **Purpose**: Core application powering the Sophia AI Factory dashboard, background processing, billing, video rendering coordination, and AI model orchestration.
- **Path**: [apps/sophia-ai-factory](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory)
- **Dependencies**: React 19, Next.js 16 (Edge Runtime), Inngest 3.x, Better Auth 1.6, Wrangler/Cloudflare workers integrations.
- **Runtime Role**: Edge computing API and Client UI.
- **Architectural Risk**: **High**. Contains core financial, ledger, and background processing systems.

#### `src/seed`
- **Purpose**: Ground-level infrastructure utilities. No dependencies on outer layers (Tree, Forest, Land).
- **Path**: [apps/sophia-ai-factory/src/seed](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed)
- **Boundary**: Strict input validation (`input-sanitization-utilities.ts`) and logger abstraction.
- **Runtime Role**: Database connection lifecycle (`client.ts`), execution tracing, and logger utility.
- **Architectural Risk**: **Medium**. Any error in this layer halts the entire application.

#### `src/tree`
- **Purpose**: Pure business entities, authentication primitives, and internal gateway clients.
- **Path**: [apps/sophia-ai-factory/src/tree](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree)
- **Boundary**: Imports from `seed`. Never imports from `forest` or `land`.
- **Runtime Role**: Encrypts/decrypts payloads, handles MFA challenge creation, and integrates OpenClaw LLM routes.
- **Architectural Risk**: **Medium**. Security-sensitive cryptographic primitives.

#### `src/forest`
- **Purpose**: Integration flows, queues, cron-jobs, and heavy asynchronous state orchestration.
- **Path**: [apps/sophia-ai-factory/src/forest](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest)
- **Boundary**: Imports from `tree` and `seed`. Never imports from `land`.
- **Runtime Role**: Triggers Inngest background pipelines, schedules email marketing drip campaigns, and processes daily payouts.
- **Architectural Risk**: **High**. Critical queue workers reside here. A breakdown stops payouts and video delivery.

#### `src/land`
- **Purpose**: Front-facing presentation controllers and API endpoint decorators.
- **Path**: [apps/sophia-ai-factory/src/land](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/land)
- **Boundary**: Imports from `forest`, `tree`, and `seed`.
- **Runtime Role**: Renders UI components, formats API JSON responses, and executes Client-side validation hooks.
- **Architectural Risk**: **Medium**. Directly exposes user-facing interfaces.

---

### `apps/84tea`
- **Purpose**: Autonomous ecommerce and storefront application.
- **Path**: [apps/84tea](file:///Users/macbook/projects/sophia-ai-factory/apps/84tea)
- **Dependencies**: React 18, Next.js 15, Vite testing suite.
- **Runtime Role**: Server-side rendering (SSR) and checkout logic.
- **Architectural Risk**: **Low**. Isolated from the main Sophia platform.

---

### `scripts`
- **Purpose**: Build post-processing, schema migration, and doctor diagnostic execution.
- **Path**: [apps/sophia-ai-factory/scripts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts)
- **Runtime Role**: Injects the `scheduled` hook into Cloudflare Workers bundles (`inject-scheduled-handler.mjs`), runs bundle analysis, and applies SQLite D1 migration scripts.
- **Architectural Risk**: **High**. Faulty scripts break the build pipeline or corrupt production schemas.

---

### `tests`
- **Purpose**: Integration and performance verification.
- **Path**: [apps/sophia-ai-factory/tests](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests)
- **Runtime Role**: Runs Playwright end-to-end user journeys and k6 load tests (steady, spike, soak).
- **Architectural Risk**: **Low**. Executed only during CI/CD checks.

---

### `docs`
- **Purpose**: Architectural specifications, change logs, and operational runbooks.
- **Path**: [docs](file:///Users/macbook/projects/sophia-ai-factory/docs)
- **Runtime Role**: Static reference files.
- **Architectural Risk**: **Low**. Has no executable impact on production.
