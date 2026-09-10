# Baseline Verification Report — Customer Readiness

**Date**: 2026-09-10T09:18:00Z  
**Branch**: main  
**Working Tree**: clean (unmodified working directory)  

## Git Ground Truth

- **Local HEAD SHA**: `3356ffdc3b38c585f7855024d2410b4ebf0c3c4f` (short: `3356ffdc`)
- **Remote `origin/main` SHA**: `3356ffdc3b38c585f7855024d2410b4ebf0c3c4f` (synced with origin)
- **Recent Commits**:
  - `3356ffdc3` docs: record Customer Handover Productization Sprint and SHA c3b2e7e6 in roadmap and changelog
  - `c3b2e7e62` feat(handover): productize customer operations
  - `c35840f41` feat(auth): founder bootstrap authorization remediation (handover green)
  - `9ba36fa3e` docs: record Handover Hardening Sprint and SHA 12b8a022 in roadmap and changelog
  - `2b847afaf` docs(audit): update handover certificate and backlog with live deploy verification at 12b8a022

## Live Production Ground Truth (Cloudflare Workers)

- **Production URL**: `https://sophia.agencyos.network`
- **Live Version Endpoint (`GET /api/version`)**:
  - `shortSha`: `c3b2e7e6`
  - `deployedAt`: `2026-09-10T08:17:38Z`
  - `opennextVersion`: `1.19.11`
- **Live Health Endpoint (`GET /api/health`)**: `HTTP 200`
- **Live Login Endpoint**:
  - `GET /login`: `HTTP 307` (Temporary Redirect to `/vi/login` via Next.js locale routing)
  - `GET /vi/login`: `HTTP 200`
- **Status vs Local**: Live production is at commit `c3b2e7e6`. Local commit `3356ffdc` is a docs update commit immediately following the deploy.

## Local Quality Gates Ground Truth

- **TypeScript (`npm run type-check`)**:
  - Exit Code: `0`
  - TypeScript Errors: `0`
- **Unit & Integration Tests (`npm test` / `vitest run`)**:
  - Test Files: `884 passed`, `1 skipped` (`885` total)
  - Tests: `9092 passed`, `34 skipped`, `10 todo` (`9136` total)
  - Duration: `94.30s`
  - Exit Code: `0`
- **Production Build (`npm run build`)**:
  - Exit Code: `0` (clean build, 0 fatal errors)
  - Postbuild symbol upload: Skipped (no SENTRY_AUTH_TOKEN as expected per no-tech doctrine)
