---
description: 🤖 Bootstrap AGI RaaS service — research → plan → implement → verify
argument-hint: [service-description]
---

**Think harder** để bootstrap AGI RaaS service: <requirements>$ARGUMENTS</requirements>

**IMPORTANT:** Activate needed skills. YAGNI, KISS, DRY. Tiếng Việt output.
**IMPORTANT:** Tất cả RaaS services PHẢI follow Plan-Execute-Verify pattern.
**IMPORTANT:** All subagents use default model (qwen3.5-plus). Do NOT use `/model` command — breaks DashScope subagents.

## Context

RaaS = Results as a Service. Pricing: $0.25/MCU (Mekong Compute Unit).
Stack: Fastify + BullMQ + Redis + PostgreSQL + TimescaleDB + Polar.sh billing.
Gateway: Cloudflare Worker (`apps/raas-gateway/`).
Engine: `apps/algo-trader/` (Fastify on :3000).
Orchestrator: Tôm Hùm daemon (`apps/openclaw-worker/`).

## Workflow

### 1. Đọc Context
- Đọc `./CLAUDE.md` (Hiến Pháp)
- Đọc `apps/algo-trader/CLAUDE.md`
- Đọc `apps/algo-trader/plans/` cho active plans
- Đọc `./docs/system-architecture.md`

### 2. Research (max 2 researcher song song)
- Researcher 1: Technical validation — architecture patterns, API design, security
- Researcher 2: Market/competitive — existing solutions, pricing, differentiation
- Reports ≤150 lines, save to `plans/reports/`

### 3. Planning
- Use `planner` agent với full context từ research
- Đọc existing phases (`apps/algo-trader/plans/`) để không duplicate
- Plan PHẢI có:
  - YAML frontmatter (title, status, priority, effort, branch, tags)
  - Dependency graph
  - File ownership matrix
  - Success criteria + verification commands
- Save plan to `plans/{date}-{slug}/`

### 4. Implementation
- Use `fullstack-developer` agent cho từng phase
- Pass: phase file path, environment info, existing code context
- Run type checking after mỗi phase: `npx tsc --noEmit`
- KHÔNG rewrite existing modules — wrap/extend only

### 5. Testing
- Use `tester` agent — real tests, NO mocks/fakes
- Test files: `apps/algo-trader/tests/`
- If fail: `debugger` → fix → repeat until GREEN

### 6. Code Review
- Use `code-reviewer` agent
- Focus: security (auth, injection), performance (BullMQ, Redis), type safety

### 7. Documentation
- Use `docs-manager` to update `./docs/system-architecture.md`
- Update `apps/algo-trader/README.md` nếu có

### 8. Verification
- Run build: `pnpm run build --filter=algo-trader`
- Run tests: `cd apps/algo-trader && npx vitest run`
- Health check: `curl http://localhost:3000/api/v1/health`

### 9. Final Report
- Summary: what built, files changed, tests passed
- Next steps: remaining phases
- Ask to commit (use `git-manager`)
