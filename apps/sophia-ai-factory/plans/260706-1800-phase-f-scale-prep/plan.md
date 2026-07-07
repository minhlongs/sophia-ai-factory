---
title: "Phase F: Scale Preparation"
description: "Production hardening — i18n completeness, import hygiene, security audit. 3 parallel tracks, 2–3 days."
status: completed
priority: P1
branch: main
tags: ["scale", "i18n", "security", "hardening", "deploy-readiness"]
blockedBy: []
blocks: []
created: "2026-07-06T18:00:00.000Z"
createdBy: "ck-cli"
source: cli
---

# Phase F: Scale Preparation

## Overview

Production hardening sprint before first real customers. No new features — pure quality closure.
Three independent tracks run in parallel.

## Tracks

| Track | Name | Status | Est. Effort | Files |
|-------|------|--------|-------------|-------|
| F-A | [i18n + Import Hygiene](./phase-fa-i18n-hygiene.md) | Pending | 1–2d | 6 |
| F-B | [Security Audit](./phase-fb-security-audit.md) | Pending | 1d | 3 |
| F-C | [Deploy Readiness](./phase-fc-deploy-readiness.md) | Pending | 0.5d | 2 |

## Dependencies

All 3 tracks independent. Can execute in parallel.

## Key Decisions

- Creator marketplace `/creator/` routes are canonical; `[locale]/dashboard/sop-creator/` is live (not orphaned)
- `scripts/audit/verify-hash-chain.mjs` exists — Turbopack warning is false positive
- Ban `next/link` import in creator pages → use canonical `@/navigation`
- Normalize i18n to `marketplace.creator` namespace for all creator-facing strings
