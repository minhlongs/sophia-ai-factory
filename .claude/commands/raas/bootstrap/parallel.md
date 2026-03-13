---
description: ⚡⚡⚡⚡⚡ Bootstrap AGI RaaS với parallel execution — fastest mode
argument-hint: [service-description]
---

**Ultrathink parallel** để bootstrap AGI RaaS: <requirements>$ARGUMENTS</requirements>

**IMPORTANT:** Activate needed skills. YAGNI, KISS, DRY. Tiếng Việt output.
**IMPORTANT:** Maximize parallelization. Mỗi phase có file ownership riêng biệt.
**IMPORTANT:** 🦞 MODEL ROTATION — Each parallel subagent MUST use a DIFFERENT model from pool to distribute API load:
  - All subagents use default model. Do NOT use `/model` command.

## Context

RaaS = Results as a Service. MCU = Mekong Compute Unit ($0.25/task).
Architecture: Cloudflare Gateway → Fastify API → BullMQ Workers → PostgreSQL/TimescaleDB.
Auth: JWT + API Keys. Billing: Polar.sh. Orchestrator: Tôm Hùm.

Existing code:
- `apps/algo-trader/src/api/` — Fastify server + routes (Phase 1 DONE)
- `apps/algo-trader/src/auth/` — JWT + API key + rate limiter (Phase 2 DONE)
- `apps/algo-trader/src/jobs/` — BullMQ queues + workers (Phase 3 code exists, not wired)
- `apps/raas-gateway/` — Cloudflare Worker gateway

## Workflow

### 1. Context Loading (sequential, fast)
- Đọc `./CLAUDE.md`, `apps/algo-trader/CLAUDE.md`
- Đọc active plan: `apps/algo-trader/plans/260302-0137-agi-raas-bootstrap/plan.md`
- Đọc `./docs/system-architecture.md`, `./docs/code-standards.md`
- Identify: phases DONE vs PENDING

### 2. Research Wave (max 3 agents parallel)
- `researcher` 1: API design patterns — REST best practices, OpenAPI, versioning
- `researcher` 2: Infrastructure — BullMQ scaling, Redis clustering, health monitoring
- `researcher` 3: Billing/metering — Polar.sh SDK, MCU tracking, usage webhooks
- Each: max 5 sources, report ≤100 lines
- Save to `plans/reports/`

### 3. Parallel Planning
- Trigger `/plan:parallel <detailed-instruction-from-research>`
- Planner MUST produce:
  - Exclusive file ownership per phase (no file in 2 phases)
  - Dependency matrix with parallelization groups
  - Conflict prevention section per phase
- Read `plan.md` output for dependency graph

### 4. Parallel Implementation
- Launch multiple `fullstack-developer` agents SIMULTANEOUSLY
- Each agent gets:
  - Phase file path
  - File ownership boundaries (CẤM modify files outside boundary)
  - Environment info (Node.js, pnpm, M1 16GB)
  - Existing code references
- Parallel groups based on dependency graph:
  ```
  Group A (independent): Phase 3 (Redis wiring) | Phase 4 (DB schema)
  Group B (depends A):   Phase 5 (Monitoring) | Phase 6 (Billing)
  ```
- Run type checking after each phase: `npx tsc --noEmit`

### 5. Integration Testing
- Use `tester` agent AFTER all parallel phases complete
- Real tests: API endpoints, auth flows, job queues, billing hooks
- NO mocks, NO fake data
- If fail: `debugger` → identify phase → fix → retest

### 6. Code Review
- Use `code-reviewer` agent on ALL changed files
- Security audit: auth bypass, injection, secrets exposure
- Performance: connection pooling, queue backpressure, memory leaks

### 7. Documentation (parallel)
- `docs-manager`: update `./docs/system-architecture.md`
- `project-manager`: update `./docs/project-roadmap.md`
- Both run simultaneously

### 8. Verification Pipeline
```bash
# Build
pnpm run build --filter=algo-trader

# Tests
cd apps/algo-trader && npx vitest run

# Health check (if server running)
curl -s http://localhost:3000/api/v1/health | jq .

# Auth test
curl -s -H "Authorization: Bearer <test-jwt>" http://localhost:3000/api/v1/tenants
```

### 9. Final Report
- Files changed per phase
- Test results summary
- Dependency graph status (DONE/PENDING)
- Performance metrics nếu có
- Next steps
- Ask to commit (use `git-manager`)
