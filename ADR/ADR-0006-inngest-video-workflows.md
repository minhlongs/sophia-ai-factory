# ADR-0006 — Long-Running Video Workflows Use Inngest

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CTO

## Context

Video generation can take minutes and cannot safely run inside Cloudflare Workers HTTP request limits. Sophia uses Inngest for long-running workflow steps.

## Decision

Long-running video and campaign workflows run through Inngest. Edge HTTP handlers enqueue work, persist state, and return status; Inngest owns retries, checkpoints, and downstream provider calls.

## Consequences

- Video rendering must not block Cloudflare Workers edge functions.
- Workflows must be idempotent and checkpointed.
- Legacy video job paths are cleanup candidates, not primary architecture.

## Evidence

- [`README.md`](README.md#L28-L38) — Cloudflare Workers, Inngest, and D1 stack.
- [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md#L17-L50) — edge runtime limits and Inngest workflow architecture.
- [`ROADMAP.md`](ROADMAP.md#L17-L27) — first-customer flow with video generation.
