# Phase 4: Production Verification (The Green Gate)

**Priority**: Medium 🟡
**Status**: Pending
**Context**: [Master Plan](./plan.md)

## 🎯 Objective
Automated verification of the production deployment immediately after it goes live. Ensure that "Success" in Vercel actually means the app is working for users.

## 🔍 Key Insights (from Research)
- **Current State**: `verify.sh` is mostly pre-build checks (lint, test).
- **Gap**: No post-deploy "smoke test" running against the actual `sophia-ai-factory.vercel.app` URL.
- **Risk**: A build can pass, but the app crashes on boot due to missing runtime env vars or edge config issues.

## 🛠 Implementation Steps

### 1. Enhance Health Check Endpoint
- **Update**: `src/app/api/health/route.ts`
- **Logic**: Add "Deep" check mode (verifies DB connection, Redis/KV if used, critical 3rd party connectivity) protected by a secret key.

### 2. Create Post-Deploy Smoke Test
- **Script**: `scripts/smoke-test.ts`
- **Actions**:
    - Hit `GET /api/health` (Deep Check).
    - Verify `GET /` returns 200 and expected content.
    - Verify critical assets (JS/CSS) load (not 404).

### 3. Integrate with Vercel Deployment
- **Method**: GitHub Action `deployment_status` trigger or Vercel "Checkly" integration.
- **Action**: When Vercel says "Ready", trigger `smoke-test.ts` against the deployment URL.
- **Rollback**: If smoke test fails, auto-trigger Vercel rollback (or alert high-priority channel).

### 4. Synthetic Monitoring (Optional)
- Set up a scheduled job (GitHub Actions Cron or UptimeRobot) to ping the health endpoint every 5 minutes.

## ✅ Definition of Done
- [ ] Every production deployment is followed by an automated smoke test.
- [ ] If the smoke test fails, the team is alerted immediately (e.g., via Telegram/Slack).
- [ ] Health endpoint accurately reflects the status of all critical downstream dependencies.

## 🛡️ Risk Assessment
- **Risk**: Health check exposing sensitive info.
- **Mitigation**: Ensure strict auth (Bearer token) for "Deep" health checks. Public health check should only return "OK" (status 200).
