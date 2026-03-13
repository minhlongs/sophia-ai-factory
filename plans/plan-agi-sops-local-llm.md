# AGI SOPs Local LLM - Implementation Plan

**Date:** 2026-03-12
**Status:** Approved
**Priority:** High

---

## Overview

Build AGI SOPs (Standard Operating Procedures) system powered by local LLM (Ollama/MLX) trên Mac M1 Pro 16GB.

**Goals:**
- Procedural knowledge storage và retrieval
- Local LLM execution (không cloud dependency)
- CLI-first với optional web UI
- PEV (Plan-Execute-Verify) architecture

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Language** | Python 3.9+ | System program, ML ecosystem |
| **LLM Serving** | Ollama + MLX | Easy setup + M1 optimization |
| **Model** | Qwen2.5-7B, Phi-3-mini | Balance performance/VRAM |
| **Vector DB** | LanceDB | Disk-based, SQL-like, embeddable |
| **Embeddings** | sentence-transformers | Local, fast, accurate |
| **CLI** | Typer + Rich | Modern Python CLI |
| **Web UI** | Next.js (optional) | Dashboard cho SOP management |
| **Testing** | pytest | Standard Python testing |

---

## Project Structure

```
agi-sops/
├── src/
│   ├── core/
│   │   ├── engine.py          # PEV orchestrator
│   │   ├── planner.py         # Plan generation
│   │   ├── executor.py        # Step execution
│   │   ├── verifier.py        # Quality gates
│   │   └── exceptions.py      # Custom exceptions
│   ├── sops/
│   │   ├── parser.py          # YAML/Markdown parser
│   │   ├── validator.py       # SOP validation
│   │   └── storage.py         # SOP versioning
│   ├── rag/
│   │   ├── retriever.py       # Procedural retrieval
│   │   ├── embeddings.py      # Embedding pipeline
│   │   └── indexer.py         # SOP indexing
│   ├── llm/
│   │   ├── client.py          # Ollama/MLX adapter
│   │   ├── models.py          # Model configs
│   │   └── router.py          # Model switching
│   └── cli/
│       ├── main.py            # CLI entrypoint
│       └── commands.py        # CLI commands
├── sops/                      # SOP library
│   ├── templates/
│   └── procedures/
├── tests/
├── docs/
└── pyproject.toml
```

---

## Phase 1: Infrastructure Setup

**Owner:** fullstack-developer
**Files:** `pyproject.toml`, `.env.example`, `src/core/`, `src/llm/`

### Tasks
1. Initialize Python project với `pyproject.toml`
2. Setup virtual environment
3. Install dependencies: typer, rich, ollama, lancedb, sentence-transformers
4. Create directory structure
5. Configure Ollama (download Qwen2.5-7B, Phi-3-mini)
6. Setup MLX for M1 optimization

### Acceptance Criteria
- `python -m pytest tests/` passes (empty tests)
- `agi-sops --version` works
- Ollama running với models loaded

---

## Phase 2: SOP Parser + Storage

**Owner:** fullstack-developer
**Files:** `src/sops/parser.py`, `src/sops/validator.py`, `src/sops/storage.py`

### Tasks
1. Define SOP YAML schema (name, steps, validation, rollback)
2. Implement parser với validation
3. Create storage layer (filesystem + versioning)
4. Build SOP template system

### SOP Schema Example
```yaml
name: deploy-to-production
version: 1.0.0
description: Deploy application to production

steps:
  - id: build
    command: npm run build
    timeout: 120
    validation: exit_code == 0

  - id: test
    command: npm test
    timeout: 300
    validation: exit_code == 0

  - id: push
    command: git push origin main
    validation: exit_code == 0
    rollback: git push origin main --delete

quality_gates:
  - name: ci_green
    check: gh run list -L 1 | grep success

  - name: production_health
    check: curl -sI $PROD_URL | grep "200 OK"
```

### Acceptance Criteria
- Parse SOP files thành công
- Validate SOP syntax
- Store và retrieve với versioning

---

## Phase 3: RAG Engine

**Owner:** fullstack-developer
**Files:** `src/rag/retriever.py`, `src/rag/embeddings.py`, `src/rag/indexer.py`

### Tasks
1. Setup LanceDB connection
2. Implement embedding pipeline (sentence-transformers)
3. Build indexer cho SOPs
4. Create procedural retrieval logic

### Acceptance Criteria
- Index SOPs vào LanceDB
- Retrieve relevant SOPs by query
- Semantic search working

---

## Phase 4: LLM Client + PEV Engine

**Owner:** fullstack-developer
**Files:** `src/llm/client.py`, `src/core/engine.py`, `src/core/planner.py`, `src/core/executor.py`, `src/core/verifier.py`

### Tasks
1. Implement Ollama client
2. Add MLX adapter for M1 optimization
3. Build model router với fallback
4. Implement PEV orchestrator
5. Add rollback logic

### Acceptance Criteria
- LLM calls successful
- Plan generation working
- Step execution với error handling
- Verifier validates output

---

## Phase 5: CLI Commands

**Owner:** fullstack-developer
**Files:** `src/cli/main.py`, `src/cli/commands.py`

### Tasks
1. Setup Typer CLI framework
2. Implement commands:
   - `agi-sops cook <goal>` - Execute SOP
   - `agi-sops plan <goal>` - Generate plan
   - `agi-sops run <sop-name>` - Run specific SOP
   - `agi-sops sop new <name>` - Create new SOP
   - `agi-sops sop list` - List all SOPs
   - `agi-sops sop show <name>` - Show SOP details

### Acceptance Criteria
- All CLI commands work
- Help text displays correctly
- Error handling proper

---

## Phase 6: Web UI (Optional)

**Owner:** ui-ux-designer + fullstack-developer
**Files:** `web/` directory

### Tasks
1. Design UI wireframes
2. Setup Next.js project
3. Build SOP management dashboard
4. Add chat interface cho LLM
5. Integrate với backend API

### Acceptance Criteria
- Dashboard displays SOPs
- Chat interface works
- API integration successful

---

## Phase 7: Testing + Documentation

**Owner:** tester + docs-manager
**Files:** `tests/`, `docs/`

### Tasks
1. Write unit tests cho tất cả modules
2. Write integration tests
3. Create README.md
4. Create architecture docs
5. Create usage guide

### Acceptance Criteria
- Test coverage > 80%
- All tests pass
- Docs complete và clear

---

## Execution Strategy

### Parallel Execution
- **Phase 1 + 2** có thể chạy song song
- **Phase 3 + 4** có thể chạy song song
- **Phase 5** depends on Phase 4
- **Phase 6** optional, depends on Phase 5
- **Phase 7** sau khi Phase 1-5 complete

### Sequential Dependencies
```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 7
                                          ↓
                                      Phase 6 (optional)
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| CLI commands | 6+ commands |
| SOP parser | 100% valid syntax |
| RAG retrieval | < 500ms latency |
| LLM inference | < 5s response |
| Test coverage | > 80% |
| Docs completeness | All sections |

---

## Next Steps

1. **Start Phase 1:** Setup infrastructure
2. **Configure Ollama:** Download models
3. **Initialize project:** `pyproject.toml`, venv
