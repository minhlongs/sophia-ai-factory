# Research Report: AGI SOPs Local LLM

**Date:** 2026-03-12
**Type:** Research
**Context:** Bootstrap AGI SOPs system với local LLM trên Mac M1 Pro 16GB

---

## 1. AGI SOPs là gì?

**Standard Operating Procedures (SOPs)** cho AGI/LLM systems:

- **Procedural Knowledge:** Các bước thực thi nhiệm vụ có cấu trúc
- **Decision Trees:** Quy tắc ra quyết định theo ngữ cảnh
- **Memory Patterns:** Lưu trữ và retrieve kinh nghiệm thực thi
- **Quality Gates:** Validation checkpoints sau mỗi bước

**Use cases:**
- Agent task execution workflows
- RAG pipelines với procedural retrieval
- Multi-agent coordination protocols
- Self-correction và rollback mechanisms

---

## 2. Local LLM Tech Stack (Mac M1 Pro 16GB)

### Model Serving

| Option | Pros | Cons |
|--------|------|------|
| **Ollama** | Easy setup, GPU accel, API compatible | Limited model customization |
| **MLX** (Apple) | Native M1/M2 optimization | Python-only, newer ecosystem |
| **llama.cpp** | Maximum control, quantization | Complex setup, C++ heavy |
| **LM Studio** | GUI, easy model management | Closed source, resource heavy |

**Recommendation:** Ollama + MLX hybrid
- Ollama cho quick deployment và API
- MLX cho fine-tuning và optimization

### Best Models for SOPs

| Model | Size | VRAM | Strengths |
|-------|------|------|-----------|
| **Llama 3.2** | 3B/7B | 2-6GB | Reasoning, instruction following |
| **Qwen2.5** | 7B | 6GB | Code, multi-step tasks |
| **Mistral** | 7B | 6GB | General purpose, fast |
| **Phi-3** | 3.8B | 3GB | Lightweight, good for SOPs |

**Recommendation:** Qwen2.5-7B (default) + Phi-3-mini (fallback)

---

## 3. Vector Database for SOP Storage

| Option | Pros | Cons |
|--------|------|------|
| **Chroma** | Simple, Python-native, embeddable | Limited scaling |
| **LanceDB** | Disk-based, fast, SQL-like | Newer ecosystem |
| **Qdrant** | Production-ready, filtering | Heavier deployment |
| **SQLite vec** | Lightweight, single-file | Limited features |

**Recommendation:** LanceDB
- Disk-based (tiết kiệm RAM)
- SQL-like queries cho SOP retrieval
- Embeddable (không cần server riêng)

---

## 4. Agent Framework

| Option | Pros | Cons |
|--------|------|------|
| **LangChain** | Mature, large ecosystem | Heavy, complex |
| **LlamaIndex** | RAG-focused, clean API | Less flexible |
| **CrewAI** | Multi-agent, role-based | Newer, less docs |
| **Custom (PEV)** | Lightweight, full control | More dev work |

**Recommendation:** Custom PEV (Plan-Execute-Verify)
- Kế thừa Mekong CLI architecture
- Lightweight, SOP-focused
- Không phụ thuộc heavy frameworks

---

## 5. Architecture Pattern

```
┌─────────────────────────────────────────────────────┐
│  CLI: agi-sops cook/plan/run/sop                   │
│  Web UI: Next.js dashboard (optional)              │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  SOP Parser        │  YAML/Markdown → Structured SOP
         │  src/sops/parser.py│  Validation, versioning
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  RAG Engine        │  LanceDB + embeddings
         │  src/rag/          │  Procedural retrieval
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  LLM Router        │  Ollama/MLX adapter
         │  src/llm/          │  Model switching, fallback
         └─────────┬──────────┘
                   │
    ┌──────────────▼──────────────────┐
    │  PEV Engine   src/core/         │
    │  planner.py   → Plan generation │
    │  executor.py  → Step execution  │
    │  verifier.py  → Quality gates   │
    └─────────────────────────────────┘
```

---

## 6. Implementation Checklist

### Phase 1: Setup
- [ ] Initialize project structure
- [ ] Install Ollama + download models
- [ ] Setup LanceDB + embeddings
- [ ] Configure environment variables

### Phase 2: Core Engine
- [ ] SOP parser (YAML/Markdown)
- [ ] RAG pipeline với procedural retrieval
- [ ] LLM client (Ollama + MLX)
- [ ] PEV orchestrator

### Phase 3: CLI + UI
- [ ] CLI commands (cook, plan, run, sop)
- [ ] Web dashboard (Next.js optional)
- [ ] SOP management UI

### Phase 4: Testing + Docs
- [ ] Unit tests (pytest)
- [ ] Integration tests
- [ ] Documentation

---

## 7. Unresolved Questions

1. Có cần web UI ngay không hay chỉ CLI trước?
2. SOP format: YAML, Markdown, hay JSON?
3. Cần multi-agent coordination không?
