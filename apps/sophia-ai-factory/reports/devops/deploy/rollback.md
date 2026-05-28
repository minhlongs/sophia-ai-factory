# Rollback Plan

This document outlines the trigger criteria and step-by-step recovery procedures for rollback in the event of post-deployment failures.

## Rollback Triggers

Rollback should be executed immediately if any of the following occur:
1. **Service Down:** Endpoint `/api/health` or `/api/version` returns HTTP 500 or is unreachable for over 2 minutes.
2. **Crash Loop:** Critical Inngest background jobs crash repeatedly due to runtime edge compatibility issues.
3. **Muxing Failures:** ElevenLabs audio upload or HeyGen video creation throws unhandled runtime failures.

## Step-by-Step Rollback Procedure

1. **Revert GitHub Code:**
   Locate the previous stable commit SHA on remote (e.g. `bb38414b`) and deploy it:
   ```bash
   git checkout bb38414b
   git push origin HEAD:main --force
   ```

2. **Rollback D1 Migrations (if DB structure was corrupted):**
   ```bash
   npx wrangler d1 migrations rollback sophia-raas-db --remote
   ```

3. **Verify Restoration:**
   Check `/api/version` to confirm version matches `bb38414b` and that health pings resume.
