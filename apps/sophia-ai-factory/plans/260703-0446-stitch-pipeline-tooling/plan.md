---
title: "Stitch Pipeline Tooling — Session Persistence + Token Export"
description: "Build tooling scripts for Stitch→Next.js pipeline: session persistence (stitch-session.mjs), token export (stitch-tokens.sh), pre-flight validation (stitch-preflight.sh)"
status: pending
priority: P2
branch: "main"
tags: []
blockedBy: []
blocks: []
created: "2026-07-03T02:50:50.344Z"
createdBy: "ck-cli"
source: brainstorm
---

# Stitch Pipeline Tooling — Session Persistence + Token Export

## Overview

3 scripts để giải quyết pain points từ pipeline vừa chạy:
- MCP auth expired → session persistence để resume
- No token SOURCE OF TRUTH → single token file cho agents
- Purple/i18n phát hiện muộn → pre-flight gate

Brainstorm report: [`plans/reports/workflow-optimization-stitch-pipeline-260703-0446-report.md`](../reports/workflow-optimization-stitch-pipeline-260703-0446-report.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [stitch-session.mjs](./phase-01-stitch-session-mjs.md) | Pending |
| 2 | [stitch-tokens.sh + preflight.sh](./phase-02-stitch-tokens-sh-preflight-sh.md) | Pending |
| 3 | [Integration & Verify](./phase-03-integration-verify.md) | Pending |

## Dependencies

- Phase 1 → Phase 2 → Phase 3 (sequential)
- Phase 1 creates session helper used by Phase 2
