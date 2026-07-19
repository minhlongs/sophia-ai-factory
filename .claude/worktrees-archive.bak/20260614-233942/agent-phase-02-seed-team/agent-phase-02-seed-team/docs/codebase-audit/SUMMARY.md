# Codebase Audit Summary

Welcome to the **Sophia AI Factory Codebase Audit Suite**. This suite compiles the comprehensive structural, flow, and risk analyses performed across the codebase to establish a baseline of system understanding, identify technical debt, and mitigate operational risks.

## Audit Suite Documents
- [Structural Map](file:///Users/macbook/projects/sophia-ai-factory/docs/codebase-audit/STRUCTURAL_MAP.md) — Detailed mapping of folders, ownership boundaries, and architectural risks.
- [Execution Flows](file:///Users/macbook/projects/sophia-ai-factory/docs/codebase-audit/EXECUTION_FLOWS.md) — Comprehensive tracing of entrypoints, middlewares, databases, authentication, background jobs, external integrations, and deployment topology.
- [Technical Debt Audit](file:///Users/macbook/projects/sophia-ai-factory/docs/codebase-audit/TECH_DEBT.md) — Remnants, dead code, cron drift, schema typing splits, and concrete examples of debt.
- [Risks and Information Gaps](file:///Users/macbook/projects/sophia-ai-factory/docs/codebase-audit/RISKS_GAPS.md) — Highlight of key operational risks (such as cron drift and credential management) and information gaps.

---

## High-Level Findings Overview

The audit confirms that the Sophia AI Factory is structured as a multi-app partial monorepo centered on a primary serverless application deploying to Cloudflare Pages (via OpenNext).

### 1. Repository Core
The active production codebase resides completely within [apps/sophia-ai-factory](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/). Other subfolders inside the workspace are either standalone sidecars (such as the Python Telegram Bot wrapper in [apps/sophia-video-bot](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/)) or unused templates (such as [apps/84tea](file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/)).

### 2. Main System Architecture
Within the main application, a strict 4-layer architecture (`seed` ← `tree` ← `forest` ← `land`) separates basic database primitives and configuration from reusable domain code, infrastructure orchestrators, and business workflows. 
- **Database:** Runs on Cloudflare D1 SQLite. Note that while SQLite/D1 is the primary production database, Supabase is NOT fully obsoleted and is still actively used for JWKS token verification in the RaaS licensing layer and gateway endpoints. Legacy elements in [supabase/](file:///Users/macbook/projects/sophia-ai-factory/supabase/) remain as remnants.
- **Background Operations:** Managed using type-safe event-driven queues with Inngest, served via [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts).

### 3. Critical Areas of Concern
- **Cron Configuration Drift:** A major configuration mismatch exists between the scheduler triggers in [wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml) and the path routing script [inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs). Four crons trigger in Cloudflare but fail to invoke target endpoint paths.
- **Unregistered Inngest Functions:** Up to 15 background handlers exported by [index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts) (including `videoGenerate` and `sopExecute`) are omitted from registration in the serve endpoint, resulting in silent failures when events are published.
- **Workspace Clutter:** Redundant root configurations, duplicate migration files in [migrations/](file:///Users/macbook/projects/sophia-ai-factory/migrations/), and outdated index files like [all_files.txt](file:///Users/macbook/projects/sophia-ai-factory/all_files.txt) introduce maintenance overhead and agent confusion.

Please proceed to the respective sub-documents to review the detailed mappings and step-by-step logic chains.
