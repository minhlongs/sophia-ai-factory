# Phase 4 — Multi-Provider Architecture

**Status:** Design  
**Date:** 2026-06-27  
**Layer:** forest/llm (new) + seed/types (extend)

## Overview

Replace the hardcoded DeepSeek → Anthropic fallback in `resolveLlmRoute` with a pluggable multi-provider system: abstract provider interface, registry with health tracking, automatic fallback chains, cost-aware routing, and BYOK key resolution.

## Phases

| # | File | Status |
|---|------|--------|
| 1 | `phase-01-provider-interface.md` | Design |
| 2 | `phase-02-provider-registry.md` | Pending |
| 3 | `phase-03-fallback-chain.md` | Pending |
| 4 | `phase-04-cost-aware-router.md` | Pending |
| 5 | `phase-05-health-monitor.md` | Pending |
| 6 | `phase-06-byok-integration.md` | Pending |
| 7 | `phase-07-backward-compat.md` | Pending |

## Acceptance Criteria

- [ ] `resolveLlmRoute` backward-compatible (existing callers unchanged)
- [ ] New `forest/llm/` modules importable from forest and land
- [ ] Zero `:any` types, zero `console.*`
- [ ] Cloudflare Workers compatible (no Node.js APIs)
- [ ] All new code uses `createLogger` from `@/seed/utils/logger-utility`
- [ ] Tests pass: `npm test` in `apps/sophia-ai-factory/`
