# ADR-0001 — Cloudflare-Direct Deployment Is Canonical

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CTO

## Context

Production is a Cloudflare Workers build of the Next.js app. GitHub Actions are intentionally disabled as the deploy path. HTTP 200 alone can hide stale deployments.

## Decision

Use `npm run deploy:full` from `apps/sophia-ai-factory` as the canonical production deploy command. Verify `/api/version` live `shortSha` equals `git rev-parse HEAD | cut -c1-8`.

## Consequences

- Agents must not report GitHub Actions deploy success as production proof.
- Deploy reports must include build, deploy, migration, HTTP, and SHA match.
- Emergency unpushed deploys require explicit documentation.

## Evidence

- [`apps/sophia-ai-factory/CLAUDE.md`](apps/sophia-ai-factory/CLAUDE.md#L1-L89) — canonical deploy flow, CF-direct doctrine, and SHA verification.
- [`apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`](apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md#L1-L91) — mandatory deploy verification sequence and anti-patterns.
