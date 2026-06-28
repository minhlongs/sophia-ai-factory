# Operational Risks & Information Gaps Audit

This document highlights critical operational risks and information gaps identified across the **Sophia AI Factory** codebase.

---

## 1. Operational Risks

### 1.1. Cron Job Drift (High Severity)
- **Description:** A severe discrepancy exists between the crons configured in Cloudflare and the crons mapped in the worker's router code:
  - Schedules registered in [apps/sophia-ai-factory/wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml) (lines 66-70) trigger the Pages instance.
  - However, the script [apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs) lacks mappings for `0 7 * * *` (llm-cache-purge), `0 */4 * * *` (affiliate-scout), `10 * * * *` (wallet-rebuild), and `*/10 * * * *` (heartbeat).
- **Operational Impact:** When Cloudflare invokes these crons, they hit a routing mismatch and terminate silently. Critical processes (such as cache purges, wallet syncs, and scout automation) do not execute in production.

### 1.2. Credentials and Secrets Leak Vectors (High Severity)
- **Description:** Version sync parameters in [apps/sophia-ai-factory/scripts/deploy-with-sha.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/deploy-with-sha.sh) and environment variables defined in [apps/sophia-ai-factory/.env.example](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.env.example) use several shared encryption secrets (such as `OAUTH_TOKEN_ENC_KEY`, `OAUTH_STATE_SECRET`, and `BYOK_MASTER_KEY`).
- **Operational Impact:** If local settings or scripts containing live secrets are accidentally committed, a security breach could occur. Disabling automated deployment in CI/CD puts the responsibility of scanning and securing these keys during wrangler deploys entirely on the developer.

### 1.3. Package-Manager Ambiguity (Medium Severity)
- **Description:** The root workspace directory [package.json](file:///Users/macbook/projects/sophia-ai-factory/package.json) contains a stale `package-lock.json` alongside `pnpm-lock.yaml`.
- **Operational Impact:** Developers or automation agents executing commands at the root might accidentally use `pnpm` workspace routines or run `npm install`, causing lockfile divergence, corrupting local `node_modules`, and producing build errors during compilation.

### 1.4. Sidecar Service Connectivity (Medium Severity)
- **Description:** Standalone rendering services (such as [services/moviepy-render/server.py](file:///Users/macbook/projects/sophia-ai-factory/services/moviepy-render/server.py) and [services/coqui-tts/server.py](file:///Users/macbook/projects/sophia-ai-factory/services/coqui-tts/server.py)) are packaged as Docker configurations for Fly.io/Runpod, but their production connectivity is configured dynamically via environment secrets.
- **Operational Impact:** If remote connection parameters (such as `INTERNAL_API_SECRET` or FastAPI endpoint hostnames) desynchronize, the video creation pipeline will fail. While protected by a circuit breaker wrapper in [apps/sophia-ai-factory/src/lib/video/composer-ffmpeg.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/composer-ffmpeg.ts), failures will lead to fallback outputs (base64 stub MP4s) instead of successful compositions.

---

## 2. Information Gaps

### 2.1. Inactive Monorepo Application Ownership
- **App:** [apps/84tea/](file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/)
- **Details:** The directory contains an undocumented Next.js application template. It has no build scripts, deployment history, or ownership boundaries listed in the main system guides.
- **Impact:** It is unclear if this folder is abandoned or acts as a template for branding experiments, leading to maintenance confusion.

### 2.2. Production Database Verification Boundaries
- **Details:** While D1 SQL migrations are stored under [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/), developers lack a clear runbook mapping existing tables to downstream RaaS services. This makes it difficult to audit schema changes.

### 2.3. HeyGen Avatar Webhook Endpoint Quota Status
- **Details:** Incoming video success webhooks are processed at [apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts). However, there is no centralized logging tracking HeyGen API consumption against the master account quota limits, which can result in unexpected failures during high-traffic intervals.
