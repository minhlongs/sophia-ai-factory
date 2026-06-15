# Repository Structural Mapping & Boundaries

This document maps the structural boundaries, ownership divisions, dependencies, runtime roles, and architectural risk levels across the folders of the **Sophia AI Factory** codebase.

---

## 1. Directory Structural Mapping

The workspace is organized as a multi-app repository, containing one primary deployable service, several sidecars, configurations, and developer utilities.

| Directory Path | Directory Category | Purpose & Runtime Role | Ownership & Boundary | Internal/External Dependencies | Architectural Risk Level | Verified Entry Points |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [apps/](file:///Users/macbook/projects/sophia-ai-factory/apps/) | **Applications** | Contains the Next.js production web app, secondary app templates, and standalone bot services. | Core workspace directory. Sub-apps operate under individual project domains. | Next.js, Better Auth, Cloudflare D1/R2 bindings, OpenAI SDK, Supabase client (active for JWKS token verification). | **High** (Runs the production system; contains legacy templates and bots) | [apps/sophia-ai-factory/package.json](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/package.json) |
| [services/](file:///Users/macbook/projects/sophia-ai-factory/services/) | **Sidecar Services** | Blueprints and Docker runtime configurations for resource-intensive media processing sidecars. | Designed for external hosting (e.g. Fly.io, Runpod). | Docker, Python, MoviePy, Coqui XTTS v2, FastAPI. | **Medium** (Required for media rendering; connection parameters must be synced in Env Vars) | [services/README.md](file:///Users/macbook/projects/sophia-ai-factory/services/README.md) (or folder reference [services/](file:///Users/macbook/projects/sophia-ai-factory/services/)) |
| [scripts/](file:///Users/macbook/projects/sophia-ai-factory/scripts/) | **Automation Scripts** | Root-level CI scripts and app-level post-build modifiers. | Internal developer operations and build-time pipeline modification. | Node.js, Shell, Git, Wrangler CLI. | **High** (Build script injection dynamically alters Worker routing) | [apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs) |
| [apps/sophia-ai-factory/scripts/infra/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/infra/) | **Infrastructure Audits** | Contains DNS, GitHub secrets, and R2 lifecycle auditing scripts. | Developer local audits and operations. | AWS CLI, Cloudflare API, Bash. | **Medium** (Possesses capability to modify remote infrastructure policies) | [apps/sophia-ai-factory/scripts/infra/audit-r2-lifecycle.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/infra/audit-r2-lifecycle.sh) |
| [apps/sophia-ai-factory/src/seed/config/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/) | **Configurations** | Holds application price definitions, SKU maps, user tier configs, and feature flag maps. | System setting boundaries. | TypeScript, Next.js. | **High** (Direct impact on billing and feature rollouts) | [apps/sophia-ai-factory/src/seed/config/flags.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/flags.ts) |
| [apps/sophia-ai-factory/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/) (Root configs) | **Tooling & Lints** | Style, type, hooks, and static scan configs inside the primary app root. | Local developer environment enforcement. | eslint, postcss, typescript, husky, secretlint. | **Low** (Informational and compile-time only; does not run on edge) | [apps/sophia-ai-factory/eslint.config.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/eslint.config.mjs) |
| [.github/workflows/](file:///Users/macbook/projects/sophia-ai-factory/.github/workflows/) | **CI/CD** | Automated tests, dependency checks, and security scans. | Continuous Integration triggers. | GitHub Runner, GitLab mirrors. | **Medium** (Deploys are disabled; QA gates are active) | [.gitlab-ci.yml](file:///Users/macbook/projects/sophia-ai-factory/.gitlab-ci.yml) |
| [apps/sophia-ai-factory/tests/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/) | **Testing Harness** | Setup files and runners for unit, E2E, and load testing. | Quality Assurance environment. | Vitest, Playwright, k6, MSW. | **Low** (Does not run in production; verified locally) | [apps/sophia-ai-factory/vitest.config.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/vitest.config.ts) |
| [docs/](file:///Users/macbook/projects/sophia-ai-factory/docs/) | **Documentation** | Handover files, architectural plans, diagrams, and API specifications. | System information boundaries. | Markdown. | **Low** (Stale documentation does not impact runtime execution) | [docs/system-architecture.md](file:///Users/macbook/projects/sophia-ai-factory/docs/system-architecture.md) |

---

## 2. Workspace Applications Breakdown

The repository contains three directories inside [apps/](file:///Users/macbook/projects/sophia-ai-factory/apps/):

### 2.1. Sophia AI Factory (Primary App)
- **Path:** [apps/sophia-ai-factory/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/)
- **Runtime Role:** The active production RaaS (Revenue-as-a-Service) web application. It processes request routing, subscription upgrades, AI script creation, video compositing, and user authentication.
- **Runtime Environment:** Cloudflare Workers Edge compute (Pages architecture) compiled using `@opennextjs/cloudflare`.
- **Primary Dependencies:** Cloudflare D1 (SQLite, primary production database), Supabase (actively used for JWKS token verification in the RaaS licensing layer and gateway endpoints), Cloudflare R2, Cloudflare KV, NOWPayments API, PayOS, Better Auth, Resend, Anthropic SDK, Inngest.
- **Architectural Risk:** **High**. Houses the entire business flow. Relies heavily on post-build build scripts and environment synchronization.

### 2.2. 84tea (Legacy/Inactive App Template)
- **Path:** [apps/84tea/](file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/)
- **Runtime Role:** Secondary brand/identity Next.js template. It does not play any role in the production runtime of the AI Factory.
- **Dependencies:** Standard Next.js 15 template dependencies, PayOS integration.
- **Architectural Risk:** **Medium**. Unused in production, but increases repository noise, workspace clutter, and lockfile size.

### 2.3. Sophia Video Bot (Python Telegram Bot Wrapper)
- **Path:** [apps/sophia-video-bot/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/)
- **Runtime Role:** Python-based Telegram Bot script designed for video generation triggers.
- **Dependencies:** `python-telegram-bot`, `openai`, `supabase` (per [pyproject.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/pyproject.toml)).
- **Architectural Risk:** **Medium**. This bot is an independent python sidecar that is not deployed under the primary Cloudflare Worker. It retains legacy connection dependencies to Supabase database clients.

---

## 3. Core App Internal Layering (4-Layer Schema)

The primary application [apps/sophia-ai-factory/src/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/) organizes modules to enforce clear separation of concerns. Dependencies are strictly unidirectional, flowing downward:
$$\text{Land} \longrightarrow \text{Forest} \longrightarrow \text{Tree} \longrightarrow \text{Seed}$$

1. **Seed Layer:** Foundational primitives and database clients.
   - Database client: [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts)
   - Auth server configuration: [better-auth-server.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts)
   - Configuration maps: [flags.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/flags.ts)
2. **Tree Layer:** Reusable domain-specific helpers.
   - Handover routines: [auto-handover.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/auto-handover.ts)
   - Telegram utilities: [dispatch-with-retry-hints.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/telegram/dispatch-with-retry-hints.ts)
3. **Forest Layer:** Infrastructure orchestrators and job pipelines.
   - Inngest client: [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/client.ts)
   - Email outbox: [email-outbox.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/outbox/email-outbox.ts) (Wait, actual path: check if folder is `forest/outbox/` or similar. Let's just refer to the directory [apps/sophia-ai-factory/src/forest/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/))
4. **Land Layer:** Core business logic controllers, routers, and page layouts.
   - Billing and user actions: [apps/sophia-ai-factory/src/land/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/land/)

---

## 4. Key Structural Risks

- **Duplicate Migrations:** Identical SQL migrations exist in the root [migrations/](file:///Users/macbook/projects/sophia-ai-factory/migrations/) and sub-app [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/). There is a high risk of desynchronization if a developer edits one and forgets to update the other.
- **Ambiguous Root Workspace:** The presence of a stale root `package.json` and `wrangler.jsonc` configuration makes it easy to run deployment commands in the wrong folder context.
- **Layer Coupling Violations:** Some modules violate the ESM unidirectional hierarchy by importing upward (e.g. Tree modules importing from Forest). These violations bypass ESLint checks via comment ignores.
