# Handoff Report — Repository Structural Mapping & Audit

**Auditor:** Explorer 1 (Repository Structural Auditor)
**Working Directory:** `/Users/macbook/projects/sophia-ai-factory/.agents/explorer_m1_1/`
**Target Repository:** `/Users/macbook/projects/sophia-ai-factory/`

---

## 1. Observation

Direct observations made via code search, directory listings, and documentation checks:
1. **Root Directory Listing:** 
   * Active directories: `apps/`, `docs/`, `scripts/`, `services/`, `supabase/`.
   * Files: `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `all_files.txt`.
   * Observed path: `file:///Users/macbook/projects/sophia-ai-factory/`
2. **Subsystems inside `apps/`:**
   * `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/`: Canonical Next.js 16/React 19 application.
   * `file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/`: Separate Next.js 15 template.
   * `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/`: Python Telegram Bot project (observed dependencies: `python-telegram-bot`, `openai`, `supabase` inside `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/pyproject.toml`).
3. **Architecture and Infrastructure Docs:**
   * Stated deploy doctrine in `file:///Users/macbook/projects/sophia-ai-factory/docs/codebase-summary.md` (lines 8): `"Deploy doctrine: CF-direct via npm run deploy:full (wrangler CLI). GitHub Actions DISABLED by design since 2026-05-03"`
   * Chronological D1 database migration count: `120 SQL files in apps/sophia-ai-factory/migrations/` as of 2026-05-21.
4. **Tooling & CI/CD:**
   * Active GitHub workflow scans in `file:///Users/macbook/projects/sophia-ai-factory/.github/workflows/` (`security-scan.yml`, `quality-gate.yml`, `dependency-audit.yml`, `canary-rollback.yml`, `agent-self-review.yml`). The deploy action (`test.yml.disabled`) is disabled.
   * Mirror definition `file:///Users/macbook/projects/sophia-ai-factory/.gitlab-ci.yml`.
5. **Key Inconsistencies & Risks:**
   * **Cron Drift:** Unmapped cron entries in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml` compared to `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` (unmapped patterns: `0 5`, `*/10`, `0 7`, `10 *`, `0 */4`).
   * **Legacy Supabase code:** DB client and migration artifacts in `file:///Users/macbook/projects/sophia-ai-factory/supabase/` exist despite Cloudflare D1 being the active production database.
   * **Deprecated code:** `/api/videos/generate` is active in `src/forest/inngest/functions/index.ts` but returns 410 Gone at the route handler level, replaced by `video:create` missions.

---

## 2. Logic Chain

1. **Monorepo Architecture Structure:** Listing the files and configuration of `file:///Users/macbook/projects/sophia-ai-factory/` shows that although `pnpm-lock.yaml` and `package-lock.json` coexist, the project is managed as a localized Next.js repository inside `apps/sophia-ai-factory`. `84tea` and `sophia-video-bot` are standalone sidecars.
2. **Production Runtime Boundary:** By checking imports and dependencies, we verified that the Cloudflare Worker output (`.open-next/worker.js` built via `@opennextjs/cloudflare`) represents the active codebase running at `https://sophia.agencyos.network`. Therefore, all packages and configs outside of `apps/sophia-ai-factory` are non-production.
3. **Infrastructure Audit:** Because Cloudflare D1 is SQLite-based, the schema definitions in `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/` are the definitive production schema. The PostgreSQL migrations in `file:///Users/macbook/projects/sophia-ai-factory/supabase/` are legacy artifacts.
4. **Cron Execution Gap:** Examining `inject-scheduled-handler.mjs` shows that incoming Cloudflare cron actions are routed by fetching internal API paths matching a static route map. Because some cron schedules listed in `wrangler.toml` are missing from the script's `CRON_ROUTES` list, those schedules will trigger the worker but will fail to invoke any corresponding business logic.

---

## 3. Caveats

* We have not validated active Cloudflare credentials or executed live production deployments.
* We assumed that the GitLab mirror configured in `file:///Users/macbook/projects/sophia-ai-factory/.gitlab-ci.yml` is inactive for primary deploys as stated in the system documentation.
* We have not run the Python-based `sophia-video-bot` to verify if it connects to the production Cloudflare D1 database.

---

## 4. Conclusion

The repository structural layout maps to a serverless edge architecture centered on `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/`. While the 4-layer internal codebase architecture is highly organized, cleanup of legacy assets (`file:///Users/macbook/projects/sophia-ai-factory/supabase/`, `file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/`) is recommended. Crucially, the unmapped cron routes represent a high-severity operational bug that must be addressed to prevent scheduled job failures.

---

## 5. Verification Method

1. **Verify D1 Table Setup:**
   Run the following command to check active SQLite tables in the production D1 database:
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
   ```
2. **Run App Typechecks and Vitest Suites:**
   Verify code and test coverage by running:
   ```bash
   cd apps/sophia-ai-factory
   npm run ci
   ```
3. **Verify Cron Injection Integration:**
   Inspect `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` and confirm the `CRON_ROUTES` array covers all crons defined in the triggers block of `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml`.
