---
title: "Auto-Deploy CI/CD + Middleware Decomposition + Deploy Script Hardening"
description: "3-track parallel: GitHub Actions auto-deploy, middleware split, deploy script reliability"
status: pending
priority: P2
effort: 6-8h
branch: main
tags: [deploy, cicd, middleware, reliability, automation]
created: 2026-06-30
---

## Overview

3 independent tracks, runnable in parallel. Each track is self-contained with its own test + verify gates.

| # | Track | Effort | Priority | Dependencies |
|---|-------|--------|----------|-------------|
| 01 | Auto-Deploy CI/CD | 2-3h | P2 | None |
| 02 | Middleware Decomposition | 3-4h | P3 | None |
| 03 | Deploy Script Hardening | 2-3h | P4 | None |

## Current State

- **Deploy:** Manual `npm run deploy:full` from local machine. GitHub Actions disabled since 2026-05-03.
- **Middleware:** 355-line monolith `proxyImpl()` with 47 historical fix commits. Already has modular helpers (`middleware/`) but orchestration logic is in one function.
- **Deploy Script:** 646-line `deploy-with-sha.sh` with `|| true` patterns, no tests, 29 fix commits.

## Success Criteria

- `git push origin main` → auto deploy to Cloudflare Workers → SHA verified on production
- Middleware split into focused handlers, each ≤100 lines, existing 6525 tests still pass
- Deploy script has error handling, all shellcheck warnings resolved, deploy still works

## Phase Files

- [Phase 01: Auto-Deploy CI/CD](phase-01-auto-deploy-cicd.md)
- [Phase 02: Middleware Decomposition](phase-02-middleware-decomposition.md)
- [Phase 03: Deploy Script Hardening](phase-03-deploy-script-hardening.md)
