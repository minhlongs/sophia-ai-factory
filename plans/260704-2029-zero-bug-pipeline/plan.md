---
title: "Zero-Bug Pre-Deploy Pipeline"
description: "Automated pre-deploy gate: route audit + page render check + CSS audit. Blocks deploy if bugs found."
status: active
priority: P1
branch: "main"
tags: [quality, pre-deploy, automation, zero-bug]
blockedBy: []
blocks: []
created: "2026-07-04T13:31:30.128Z"
updated: "2026-07-04T20:30:00.000Z"
createdBy: "ck:plan"
source: skill
---

# Zero-Bug Pre-Deploy Pipeline

## Overview

Script `scripts/pre-deploy-gate.mjs` chạy 3 bước tự động trước deploy, block nếu fail.

| Step | Check | Fail condition |
|------|-------|---------------|
| 1 | Route integrity | `href="/whatever"` → không có page.tsx |
| 2 | Page render | HTTP không 200 (404/500) |
| 3 | CSS audit | Hardcoded `#6366F1` / `indigo-*` trong changed files |

Tích hợp vào `deploy-with-sha.sh`. Có `SKIP_PRE_DEPLOY_GATE=1` bypass.

## Phases

| Phase | Status |
|-------|--------|
| 1 | ✅ Built |
| 2 | ✅ Built |
| 3 | ✅ Built |
| 4 | ✅ Integrated into deploy-with-sha.sh |
