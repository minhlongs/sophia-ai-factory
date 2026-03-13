# AGI SOPs Local LLM

> **Standard Operating Procedures system powered by local LLM**

Local-first AGI SOPs execution engine cho Mac M1/M2. Sử dụng Ollama + MLX cho LLM inference, LanceDB cho RAG storage.

## Features

- 📋 **SOP Parser:** YAML/Markdown SOP definitions với validation
- 🧠 **RAG Engine:** Procedural retrieval từ vector database
- 🤖 **Local LLM:** Ollama + MLX (không cloud dependency)
- ⚡ **PEV Engine:** Plan-Execute-Verify với rollback
- 🎯 **CLI-first:** `agi-sops cook/plan/run/sop` commands

## Quick Start

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Start Ollama server
ollama serve

# Download models
ollama pull qwen2.5:7b
ollama pull phi3:mini
```

### 2. Setup Project

```bash
cd agi-sops

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Copy environment
cp .env.example .env
```

### 3. Run CLI

```bash
# Check version
agi-sops --version

# List SOPs
agi-sops sop list

# Run SOP
agi-sops cook "Deploy to production"

# Generate plan
agi-sops plan "Build and test application"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `agi-sops cook <goal>` | Execute SOP với PEV engine |
| `agi-sops plan <goal>` | Generate execution plan |
| `agi-sops run <sop>` | Run specific SOP by name |
| `agi-sops sop new <name>` | Create new SOP template |
| `agi-sops sop list` | List all SOPs |
| `agi-sops sop show <name>` | Show SOP details |
| `agi-sops rag search <query>` | Search SOPs với semantic search |
| `agi-sops --help` | Show help |

## SOP Format

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
    rollback: git push origin HEAD~1 --delete

quality_gates:
  - name: ci_green
    check: gh run list -L 1 | grep success

  - name: production_health
    check: curl -sI $PROD_URL | grep "200 OK"
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  CLI: agi-sops cook/plan/run/sop                   │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  SOP Parser        │  YAML → Structured
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  RAG Engine        │  LanceDB + embeddings
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  LLM Router        │  Ollama/MLX
         └─────────┬──────────┘
                   │
    ┌──────────────▼──────────────────┐
    │  PEV Engine                     │
    │  planner.py → Plan generation   │
    │  executor.py → Step execution   │
    │  verifier.py → Quality gates    │
    └─────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Python 3.9+ |
| LLM Serving | Ollama + MLX |
| Models | Qwen2.5-7B, Phi-3-mini |
| Vector DB | LanceDB |
| Embeddings | sentence-transformers |
| CLI | Typer + Rich |
| Testing | pytest |

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
python -m pytest tests/ -v

# Run linting
ruff check src/
mypy src/

# Format code
black src/ tests/
```

## License

MIT License - AgencyOS Network
