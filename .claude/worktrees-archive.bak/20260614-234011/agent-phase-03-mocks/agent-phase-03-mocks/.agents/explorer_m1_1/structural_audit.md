# Repository Structural Audit — Sophia AI Factory

**Audit Date:** 2026-05-30
**Auditor Archetype:** Explorer 1 (Repository Structural Auditor)
**Target Directory:** `file:///Users/macbook/projects/sophia-ai-factory/`

---

## 1. Executive Summary

This report provides a detailed structural audit and repository mapping of the Sophia AI Factory codebase. The repository is set up as a multi-app project with a partial monorepo design, utilizing npm scripts and wrangler CLI configs for canonical workflows. 

Our analysis confirms the following:
* **Production Core:** The sole deployable production subsystem is `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/`. It runs on Cloudflare Workers edge compute (compiled via OpenNext) and relies on Cloudflare D1 as its primary persistence layer.
* **Architecture Layering:** Within the main app source (`file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/`), the project enforces a strict 4-layer architecture (`seed`, `tree`, `forest`, `land`) which organizes dependencies from basic primitives up to business domain workflows.
* **Secondary/Legacy Subsystems:** Other folders like `file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/` (secondary Next.js project) and `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/` (python-telegram-bot) exist in the repository but do not participate in production deployments. Legacy database configurations (`file:///Users/macbook/projects/sophia-ai-factory/supabase/`) remain in the codebase but are completely bypassed by the production application.
* **Deploy Doctrine:** Deployments are executed CF-direct (Wrangler CLI) using local triggers. GitHub Actions are archived and disabled, meaning automated CI/CD runs are restricted to quality and SAST checks.

---

## 2. Structural Audit Table

Below is the verification mapping of the audited folders. Each path and entry point has been verified locally.

| Folder Category | Directory Path | Purpose & Runtime Role | Ownership Boundaries | Internal/External Dependencies | Architectural Risk Level | Verified Entry Points |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **apps/** | `file:///Users/macbook/projects/sophia-ai-factory/apps/` | Monorepo apps directory containing the production application and auxiliary apps. | Shared workspace for active/inactive user interfaces and telegram integrations. | Next.js, React, Better Auth, Cloudflare D1/R2/KV bindings, OpenAI, Supabase Python wrapper. | **High** (Production runtime relies entirely on the primary subfolder) | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/package.json` |
| **packages/** | N/A | *No active root packages folder exists.* Code modularity is achieved within the main app directory. | N/A | N/A | **Low** (No active codebase surface) | N/A |
| **services/** | `file:///Users/macbook/projects/sophia-ai-factory/services/` | Contains sidecar service blueprints for resource-heavy media workflows (TTS, video render). | Infrastructure templates to be hosted externally (e.g. Fly.io or Runpod). | Docker runtimes, Python, MoviePy, Coqui XTTS v2, Runpod, Fly.io configuration files. | **Medium** ( Blueprints only; requires verified connection endpoints in production) | `file:///Users/macbook/projects/sophia-ai-factory/services/README.md` |
| **scripts/** | `file:///Users/macbook/projects/sophia-ai-factory/scripts/` | Automation, diagnostic, and build-time code at both the monorepo root and app level. | Internal developer operations and post-build injection scripts. | Node.js, Shell, Git API, Cloudflare wrangler CLI. | **High** (Build injection modifies output files dynamically) | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` |
| **infra/** | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/infra/` | Script-level infrastructure audit tools (DNS, R2 lifecycle, GitHub secrets). | Local developer operations and Cloudflare resource audits. | Bash CLI, Cloudflare API, AWS CLI (R2 S3 compatibility). | **Medium** (Scripts can alter remote Cloudflare policies) | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/infra/audit-r2-lifecycle.sh` |
| **configs/** | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/` | Config files at the application level (tiers, quotas) and root wrangler configurations. | App configuration definitions and bindings. | Cloudflare Bindings, TypeScript environments. | **High** (Mismatched cron configuration risk) | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml` |
| **tooling/** | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/` (app root config files) | Code style, linting, git hooks, and TypeScript compilation configurations. | Developer workspace enforcement. | eslint, postcss, typescript, husky, secretlint. | **Low** (Ensures code hygiene; does not run on production Workers) | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/eslint.config.mjs` |
| **CI/CD** | `file:///Users/macbook/projects/sophia-ai-factory/.github/workflows/` | Continuous integration workflows for automated testing and SAST scans. | GitHub actions and GitLab mirrors. | GitHub Runner, GitLab Runner, Wrangler API. | **Medium** (Deploy tasks are disabled; security scans are active) | `file:///Users/macbook/projects/sophia-ai-factory/.gitlab-ci.yml` |
| **tests/** | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/` | Playwright E2E tests, k6 load testing, mock setups, and co-located Vitest unit suites. | Verification harness. | Playwright, Vitest, k6, MSW (Mock Service Worker). | **Low** (Does not impact production runtime directly) | `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/vitest.config.ts` |
| **docs/** | `file:///Users/macbook/projects/sophia-ai-factory/docs/` | System architecture, cloud infrastructure, runbooks, and handover documentation. | Project memory and operator manuals. | Markdown readers (human/agent). | **Low** (Informational only; historical paths may drift) | `file:///Users/macbook/projects/sophia-ai-factory/docs/system-architecture.md` |

---

## 3. Subsystem Detailed Analysis

### 3.1. Applications (`apps/`)
The repository contains three sub-folders inside `file:///Users/macbook/projects/sophia-ai-factory/apps/`:
1. **sophia-ai-factory (`file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/`):**
   * *Purpose:* The central RaaS application codebase. Integrates AI proposal engines, Remotion-based video builders (HeyGen driven), affiliate networks, and Better Auth.
   * *Role:* Next.js compiled wrapper served on Cloudflare Workers edge compute.
   * *Dependencies:* Cloudflare D1 (SQLite), Cloudflare R2, Cloudflare KV, NOWPayments API, PayOS API, Resend, Anthropic SDK, HeyGen, Inngest.
   * *Risk:* **High**. Contains 2,400+ source files. Legacy logic coexists with modern modular designs.
2. **84tea (`file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/`):**
   * *Purpose:* Secondary Next.js application template.
   * *Role:* Completely independent, not built/deployed as part of the production environment.
   * *Dependencies:* Independent Next.js 15 template dependencies.
   * *Risk:* **Medium**. Unused in the production deploy, but presents monorepo noise.
3. **sophia-video-bot (`file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/`):**
   * *Purpose:* A python-telegram-bot wrapper designed for video generation commands.
   * *Role:* Standalone sidecar or prototype telegram bot.
   * *Dependencies:* python-telegram-bot, openai, supabase-py.
   * *Risk:* **Medium**. Not deployed to the main Worker route. Integrates with legacy Supabase connections.

### 3.2. Packages (`packages/`)
* **Status:** Non-existent. Modularity is achieved by dividing code under the 4-layer schema (`seed`, `tree`, `forest`, `land`) in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/`.
* **Seed:** Foundational primitives (e.g. `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts`, `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts`).
* **Tree:** Reusable domain-specific objects (e.g. `tree/credentials/`, `tree/telegram/`).
* **Forest:** Infrastructure coordinators (e.g. `forest/inngest/`, `forest/quota/`).
* **Land:** Core business rules (e.g. `land/billing/`, `land/payouts/`).
* *Risk:* **Low**. Clean import rules prevent circular dependencies (imports must flow downward: seed ← tree ← forest ← land).

### 3.3. Services (`services/`)
Blueprints reside in `file:///Users/macbook/projects/sophia-ai-factory/services/`:
1. **coqui-tts (`file:///Users/macbook/projects/sophia-ai-factory/services/coqui-tts/`):** Coqui XTTS v2 service config to run on Fly.io Docker.
2. **moviepy-render (`file:///Users/macbook/projects/sophia-ai-factory/services/moviepy-render/`):** Video rendering engine blueprint.
3. **runpod-hunyuan (`file:///Users/macbook/projects/sophia-ai-factory/services/runpod-hunyuan/`):** Video synthesis orchestration template running HunyuanVideo.
* *Risk:* **Medium**. These are docker blueprints. If utilized by the main application, their connection strings rely on Cloudflare Worker environment variables, which must be verified manually by operators.

### 3.4. Scripts (`scripts/`)
Located at root `file:///Users/macbook/projects/sophia-ai-factory/scripts/` and app `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/`:
* *Purpose:* Automation. The most critical is `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs`, which injects the `scheduled()` hook handler after Next.js compilation to map Cloudflare cron triggers to HTTP endpoint paths.
* *Risk:* **High**. Post-build script modifications can introduce stealth bugs if OpenNext build outputs change.

### 3.5. Infrastructure (`infra/`)
* **Status:** No dedicated infrastructure directory at root. Infrastructure configurations are declared in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml` and managed dynamically via Wrangler.
* **Audit tools:** Scripted audits for DNS, R2, and Github secrets reside in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/infra/`.
* *Risk:* **Medium**. Configuration drift can occur if manual changes are applied in the Cloudflare dashboard bypassing the git-controlled `wrangler.toml`.

### 3.6. Configurations (`configs/`)
* **App Configs:** Stored in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/` (contains tier constraints, SKU price points, etc.).
* **Runtime Configs:** Controlled by `wrangler.toml`.
* *Risk:* **High**. As detailed below, there is a known divergence between unmapped crons in `wrangler.toml` and active endpoints.

### 3.7. Tooling
Includes ESLint (`file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/eslint.config.mjs`), Vitest (`file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/vitest.config.ts`), and Husky configurations inside the primary app root.
* *Risk:* **Low**. Local validation tools ensure code style compliance but do not execute at runtime.

### 3.8. CI/CD
* **GitHub Actions:** Located in `file:///Users/macbook/projects/sophia-ai-factory/.github/workflows/`. Build/deploy workflow is disabled (`test.yml.disabled`). Active workflows run security scans and quality gates.
* **GitLab CI:** Located in `file:///Users/macbook/projects/sophia-ai-factory/.gitlab-ci.yml`. Used as an auxiliary mirror target.
* *Risk:* **Medium**. Disabling GitHub Action deployments places full verification responsibility on the deploying developer.

### 3.9. Tests
* **E2E/Load Tests:** Contained in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/` (E2E Playwright setup, k6 scripts).
* **Unit/Contract Tests:** Co-located in `__tests__` folders under `src/`.
* *Risk:* **Low**. Robust suite (4,400+ tests) ensures regression security.

### 3.10. Documentation (`docs/`)
Extensive codebase documents reside in `file:///Users/macbook/projects/sophia-ai-factory/docs/`.
* *Risk:* **Low**. Stale documentation exists (specifically referring to old pricing models, deprecated endpoints, or Supabase configurations), but it does not degrade system execution.

---

## 4. Key Architectural Risks Identified

During the audit, we uncovered several structural inconsistencies:

1. **Cron Configuration Drift (High Severity):**
   The Cloudflare Workers configuration file `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml` defines cron schedules that are not mapped inside the `CRON_ROUTES` router in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs`. 
   * *Impact:* Scheduled tasks like `error-digest`, `llm-cache-purge`, and `affiliate-scout` may be triggered by Cloudflare but will fail silently or return 404/unhandled routes at the Worker level.
2. **Environment Variable Discrepancies (High Severity):**
   There are differences in name registry between `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.env.example` and the variables referenced in the deployment script (`file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/deploy-with-sha.sh`).
   * *Impact:* Can lead to missing environment parameters during local development setup or fresh environment deployments.
3. **Legacy Supabase Artifacts (Medium Severity):**
   The folder `file:///Users/macbook/projects/sophia-ai-factory/supabase/` contains PostgreSQL migration scripts, and `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/supabase/` client bindings still remain in the codebase.
   * *Impact:* Developers might mistake Supabase as the primary active database. The production application runs entirely on Cloudflare D1. Supabase files are legacy remnants.
4. **Deprecated Video Inngest Routines (Medium Severity):**
   The endpoint `/api/videos/generate` is deprecated and hardcoded to return HTTP 410 (Gone) per ADR 0007. However, the Inngest handler folders still export legacy jobs.
   * *Impact:* Increases code surface complexity; registration checks must be validated against `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts`.

---

## 5. Verification Commands

To verify the structural integrity and status of the project, execute the following commands in the terminal:

* **Verify active D1 tables:**
  ```bash
  npx wrangler d1 execute sophia-raas-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
  ```
* **Verify Next.js compilation & OpenNext build output:**
  ```bash
  cd apps/sophia-ai-factory
  npm run deploy:build
  ```
* **Run local quality gates:**
  ```bash
  npm run ci
  ```
* **Check local git/deploy sync:**
  ```bash
  git log origin/main..HEAD
  ```

---

*End of structural audit report.*
