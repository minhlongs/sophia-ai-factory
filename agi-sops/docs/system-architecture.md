# AGI SOPs Local LLM - System Architecture

**Version:** 0.1.0 | **Date:** 2026-03-12

---

## Overview

AGI SOPs là hệ thống thực thi Standard Operating Procedures (SOPs) sử dụng local LLM (Ollama/MLX) cho Mac M1/M2.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  CLI Layer (src/cli/)                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ cook     │ │ plan     │ │ run      │ │ sop (CRUD)     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Core Engine (src/core/)                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ PEV Engine (Plan-Execute-Verify)                     │    │
│  │  • Planner: Generate plans using LLM                 │    │
│  │  • Executor: Execute shell commands                  │    │
│  │  • Verifier: Validate outputs + quality gates        │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌────────────────────────────────┐
│ LLM Layer (src/llm/)    │    │ SOP Layer (src/sops/)          │
│ ┌────────────────────┐  │    │ ┌───────────┐ ┌────────────┐  │
│ │ OllamaClient       │  │    │ │ Parser    │ │ Storage    │  │
│ │ MLXProvider        │  │    │ │ Validator │ │ Versioning │  │
│ │ LLMRouter          │  │    │ └───────────┘ └────────────┘  │
│ └────────────────────┘  │    └────────────────────────────────┘
└─────────────────────────┘                     │
              │                                 ▼
              │                   ┌────────────────────────────────┐
              │                   │ RAG Layer (src/rag/)           │
              │                   │ ┌────────────────────────────┐ │
              └──────────────────►│ │ LanceDB + Embeddings       │ │
                                  │ │ Semantic SOP retrieval     │ │
                                  │ └────────────────────────────┘ │
                                  └────────────────────────────────┘
```

---

## Component Details

### 1. CLI Layer (`src/cli/`)

**Files:** `main.py`, `commands.py`

**Commands:**
- `cook <goal>` - Execute SOP với PEV engine
- `plan <goal>` - Generate execution plan
- `run <sop>` - Run specific SOP
- `sop new/list/show` - SOP management
- `rag-search <query>` - Semantic search

### 2. PEV Engine (`src/core/`)

**Files:** `engine.py`, `models.py`, `exceptions.py`

**Components:**
- **Planner:** Dùng LLM generate step-by-step plans
- **Executor:** Execute shell commands với timeout handling
- **Verifier:** Validate outputs và quality gates
- **PEVEngine:** Orchestrator cho Plan-Execute-Verify loop

**Data Models:**
- `SOP`: Standard Operating Procedure definition
- `SOPStep`: Single step với command, timeout, validation, rollback
- `QualityGate`: Validation checkpoint
- `ExecutionResult`: Result của SOP execution

### 3. LLM Layer (`src/llm/`)

**Files:** `client.py`

**Providers:**
- **OllamaClient:** Primary provider (qwen2.5:7b, phi3:mini fallback)
- **MLXProvider:** Apple Silicon optimization
- **LLMRouter:** Route requests với automatic fallback

### 4. SOP Layer (`src/sops/`)

**Files:** `parser.py`, `storage.py`

**Features:**
- YAML parser cho SOP definitions
- Filesystem storage với versioning
- Symlink-based "latest" version tracking
- Validation và error handling

### 5. RAG Layer (`src/rag/`)

**Files:** `retriever.py`

**Features:**
- LanceDB vector database
- Sentence-transformers embeddings
- Semantic search cho SOPs
- Procedural retrieval patterns

---

## Data Flow

### SOP Execution Flow

```
User → CLI (cook/run) → Load SOP → PEV Engine
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              For each step:    Execute Step    Validate Output
                    │                 │                 │
                    ▼                 ▼                 ▼
              Update Status    Capture Output    Check Validation
                    │                                 │
                    ▼                                 ▼
              On Failure → Rollback           Quality Gates
                    │                                 │
                    ▼                                 ▼
              Execution Result ←──────────────────────┘
```

### Plan Generation Flow

```
User → CLI (plan) → Planner → LLM Router → Ollama/MLX
                                               │
                                               ▼
                                        Generate Plan
                                               │
                                               ▼
                                        Return Steps
```

---

## File Structure

```
agi-sops/
├── src/
│   ├── cli/
│   │   ├── main.py           # CLI entrypoint
│   │   └── commands.py       # CLI commands
│   ├── core/
│   │   ├── engine.py         # PEV engine
│   │   ├── models.py         # Data models
│   │   └── exceptions.py     # Custom exceptions
│   ├── sops/
│   │   ├── parser.py         # YAML parser
│   │   └── storage.py        # Filesystem storage
│   ├── llm/
│   │   └── client.py         # Ollama/MLX client
│   ├── rag/
│   │   └── retriever.py      # RAG engine
│   └── __init__.py
├── sops/
│   └── templates/            # SOP templates
├── tests/
│   ├── test_cli.py
│   ├── test_pev_engine.py
│   ├── test_sop_parser.py
│   └── test_llm_client.py
├── pyproject.toml
└── README.md
```

---

## Dependencies

### Core
- `typer` - CLI framework
- `rich` - Terminal UI
- `pyyaml` - YAML parsing
- `pydantic` - Data validation

### LLM
- `ollama` - Ollama Python client
- `mlx-lm` - Apple MLX (optional)

### RAG
- `lancedb` - Vector database
- `sentence-transformers` - Embeddings

### Dev
- `pytest` - Testing
- `black`, `ruff` - Code formatting
- `mypy` - Type checking

---

## Deployment

### Local Development

```bash
# Install Ollama
brew install ollama
ollama pull qwen2.5:7b
ollama pull phi3:mini

# Setup project
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Run CLI
agi-sops --help
```

### Production

1. Deploy Ollama server
2. Configure environment variables
3. Install package: `pip install agi-sops`
4. Run: `agi-sops cook "<goal>"`

---

## Security Considerations

1. **Command Execution:** SOP commands chạy với user permissions
2. **Timeout:** Mỗi step có timeout để prevent hangs
3. **Rollback:** Automatic rollback khi failure
4. **Validation:** Quality gates validate trước khi complete

---

## Performance

| Metric | Target | Notes |
|--------|--------|-------|
| LLM Response | < 5s | Depends on model size |
| Step Execution | < 120s | Configurable timeout |
| RAG Search | < 500ms | LanceDB + embeddings |
| Build Time | < 10s | pip install |

---

## Future Enhancements

1. **Web UI:** Next.js dashboard cho SOP management
2. **Multi-agent:** CrewAI integration cho complex workflows
3. **Cloud Sync:** Sync SOPs across machines
4. **Plugin System:** Custom providers và validators
5. **Monitoring:** Metrics và logging dashboard
