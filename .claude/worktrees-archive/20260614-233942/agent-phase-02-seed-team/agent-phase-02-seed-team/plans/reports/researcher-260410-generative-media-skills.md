---
name: Generative-Media-Skills Repository Analysis
description: SamurAIGPT/Generative-Media-Skills research for integration potential with Sophia AI Factory
type: reference
---

# Generative-Media-Skills Research Report

**Date:** 2026-04-10  
**Status:** ACTIVE PROJECT — Last Updated 2026-04-10

---

## Executive Summary

**SamurAIGPT/Generative-Media-Skills** is a mature MCP server toolkit (3,015★, 331 forks) providing unified AI agent access to 100+ media generation models. Runs as Shell-based CLI wrapper around `muapi.ai` — not standalone. **HIGH INTEGRATION POTENTIAL** for Sophia AI Factory's media orchestration layer.

---

## Core Capabilities

### Media Generation
- **Image:** Midjourney v7, Flux (Kontext/Schnell/Dev), HiDream, upscaling, style transfer
- **Video:** Text-to-video, image-to-video, video extension, lip-sync via Kling 3.0, Seedance 2.0, Veo3
- **Audio:** Music (Suno), sound effects (MMAudio)
- **Image Enhancement:** Background removal, face swap, style transfer

### Architecture
- **MCP Server** — Exposes 19 structured tools to Claude Desktop, Cursor, Gemini CLI
- **Core/Library Split:**
  - Core: `edit/`, `media/`, `platform/` (platform abstraction layer)
  - Library: `motion/`, `visual/`, `workflow/` (expert skills — Cinema Director, UI Designer, Logo Creator, Nano-Banana)
- **Schema-Driven:** 637KB `schema_data.json` defines generation parameters and workflows

---

## Integration Points

### Tech Stack
- **Language:** Shell (CLI-first)
- **Core Dependency:** `muapi-cli` (wraps Douyin's muapi.ai service)
- **API Abstraction:** Model name → endpoint mapping (automatic)
- **Output Format:** JSON + semantic exit codes (agentic-friendly)

### Third-Party APIs
- **muapi.ai** (PRIMARY — unified API backend)
- **Stripe** (payment/credits)
- **Midjourney, Flux, Kling, Suno, Seedance, Veo3, HiDream, MMAudio, Gemini**

### MCP Compliance
- 19 structured tools exposed to agents
- JSON-based outputs, no streaming
- Async request polling (suitable for long-running media jobs)
- Local file upload support

---

## Sophia AI Factory Integration

### Fit Assessment: **EXCELLENT** ✅

**Pros:**
1. **Pre-built skills** — No need to reinvent media orchestration; reuse Cinema Director, UI Designer, Logo Creator
2. **Vendor agnostic** — muapi abstraction decouples from specific APIs; swap providers without code changes
3. **Agent-native** — Designed for Claude/Cursor; immediate compatibility with Sophia's agent layer
4. **Mature codebase** — 400+ commits, active maintenance (2026 update), battle-tested

**Cons:**
1. **Shell-based CLI** — May require shell wrapper integration in Sophia's multi-agent Rust orchestrator
2. **muapi.ai dependency** — Requires muapi.ai account (Douyin service); not self-hosted
3. **Async polling model** — Media generation jobs can take minutes; state management complexity for RaaS

### Recommended Usage Pattern

```
Sophia Agent Workflow:
1. User requests "Generate hero video for product launch"
2. Sophia orchestrator → Cinema Director skill (motion planning)
3. Output storyboard frames + Kling/Seedance generation jobs
4. Async poll muapi.ai for completion
5. Return video URL + metadata to user
```

---

## Maintenance & Adoption

| Metric | Status |
|--------|--------|
| **Stars** | 3,015 (healthy) |
| **Forks** | 331 (active community) |
| **Last Update** | 2026-04-10 (TODAY) |
| **Language** | Shell (simple, portable) |
| **Topics** | 19 (claude-code, mcp, flux, kling, suno, agent-tools, etc.) |

---

## Unresolved Questions

1. **muapi.ai licensing** — Is there a self-hosted or open-source alternative? Cost structure?
2. **Shell CLI overhead** — What's the latency for agent → shell → API calls? Measure vs direct SDK.
3. **Streaming video jobs** — Does async polling support chunked/streaming responses for large videos?
4. **Credential management** — How does Sophia (BYOK architecture) handle muapi.ai API keys securely?

---

**Recommendation:** Clone repo, test Cinema Director + one video generation job end-to-end on M1 Max. Estimate 4h integration effort if using as library vs 12h if wrapping shell calls.
