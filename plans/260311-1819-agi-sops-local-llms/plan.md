# Plan: AGI SOPs for Local LLMs - Sophia AI Factory

**Date:** 2026-03-11
**Status:** READY FOR REVIEW
**Priority:** HIGH

---

## Overview

Thêm AGI Standard Operating Procedures (SOPs) để chạy LLMs local trong Sophia AI Factory.

---

## Phases

| Phase | Name | Status | Link |
|-------|------|--------|------|
| 1 | Setup Ollama Local | PLANNED | [phase-01-setup-ollama.md](./phase-01-setup-ollama.md) |
| 2 | Add API Routes | PLANNED | [phase-02-add-api-routes.md](./phase-02-add-api-routes.md) |
| 3 | Create LLM Client | PLANNED | [phase-03-create-llm-client.md](./phase-03-create-llm-client.md) |
| 4 | Build UI Components | PLANNED | [phase-04-build-ui-components.md](./phase-04-build-ui-components.md) |
| 5 | Write SOPs Docs | PLANNED | [phase-05-write-sops-docs.md](./phase-05-write-sops-docs.md) |

---

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                          ↓
                       Phase 5
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Local LLM Runtime | Ollama |
| API | Next.js Edge Functions |
| Client | TypeScript + fetch |
| UI | React 19 + Framer Motion |

---

## Research Reports

- [researcher-01-agi-sops-local-llms.md](./research/researcher-01-agi-sops-local-llms.md)
- [researcher-02-sophia-llm-integration.md](./research/researcher-02-sophia-llm-integration.md)

---

*Chờ phê duyệt trước khi implement.*
