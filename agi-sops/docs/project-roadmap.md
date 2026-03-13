# Project Roadmap - AGI SOPs Local LLM

**Version:** 0.1.0 | **Date:** 2026-03-12

---

## Phase 1: Foundation (✅ Complete - 2026-03-12)

**Status:** ✅ Complete | **Progress:** 100%

### Deliverables
- [x] Project structure initialized
- [x] PEV Engine (Plan-Execute-Verify)
- [x] SOP Parser + Storage
- [x] LLM Client (Ollama + MLX)
- [x] CLI Commands (cook, plan, run, sop)
- [x] Test Suite (25 tests passing)
- [x] Documentation (README, Architecture, Standards)

### Metrics
- Tests: 25 passed, 2 skipped
- Coverage: ~80%
- Build: Working
- CLI: Functional

---

## Phase 2: RAG + Enhancement (In Progress)

**Status:** 🔄 In Progress | **Target:** 2026-03-19

### Deliverables
- [ ] LanceDB integration
- [ ] Sentence-transformers embeddings
- [ ] Semantic SOP search
- [ ] SOP indexing pipeline
- [ ] RAG-enhanced plan generation

### Acceptance Criteria
- `agi-sops rag-search <query>` returns relevant SOPs
- Search latency < 500ms
- Indexing automatic on SOP save

---

## Phase 3: Web UI (Optional)

**Status:** ⏳ Pending | **Target:** 2026-03-26

### Deliverables
- [ ] Next.js dashboard
- [ ] SOP management UI
- [ ] Execution history
- [ ] Real-time logs
- [ ] API layer (FastAPI)

### Acceptance Criteria
- Dashboard accessible at localhost:3000
- CRUD operations for SOPs
- Live execution monitoring

---

## Phase 4: Production Ready

**Status:** ⏳ Pending | **Target:** 2026-04-01

### Deliverables
- [ ] Ollama server deployment guide
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Monitoring + logging
- [ ] Performance optimization

### Acceptance Criteria
- One-command deployment
- 99.9% uptime SLA
- < 5s LLM response time

---

## Backlog

### Features
- [ ] Multi-agent coordination (CrewAI)
- [ ] Custom validators plugin system
- [ ] SOP versioning UI
- [ ] Execution analytics
- [ ] Slack/Discord notifications
- [ ] SOP templates library

### Improvements
- [ ] Parallel step execution
- [ ] Conditional branching
- [ ] Loop/retry logic
- [ ] Step dependencies
- [ ] Rollback enhancement

### Documentation
- [ ] API reference
- [ ] Tutorial videos
- [ ] SOP authoring guide
- [ ] Troubleshooting guide

---

## Sprint History

### Sprint 1 (2026-03-12)
**Completed:**
- Project bootstrap
- Core PEV engine
- SOP parser + storage
- CLI implementation
- Test suite
- Initial documentation

**Velocity:** 8 story points
**Retrospective:** Excellent progress, all tests passing

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Tests Passing | 20+ | 25 | ✅ |
| Code Coverage | 80% | ~80% | ✅ |
| CLI Commands | 6+ | 6 | ✅ |
| SOP Templates | 3+ | 3 | ✅ |
| Documentation | Complete | 3 docs | ✅ |
| RAG Search | Working | Pending | ⏳ |
| Web UI | Optional | Not started | ⏳ |

---

## Dependencies

### External
- Ollama (LLM serving)
- LanceDB (vector database)
- sentence-transformers (embeddings)

### Internal
- Mekong CLI (project scaffolding)
- AgencyOS (deployment target)

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Ollama unavailable | High | Low | MLX fallback |
| Vector DB performance | Medium | Medium | Disk-based LanceDB |
| LLM response quality | High | Medium | Prompt engineering |
| Security vulnerabilities | High | Low | Input validation, timeouts |

---

## Next Steps

1. **Immediate (This Week):**
   - Install Ollama + download models
   - Test end-to-end SOP execution
   - Add RAG integration

2. **Short Term (Next Week):**
   - Web UI prototype
   - Additional SOP templates
   - Performance benchmarking

3. **Long Term (This Quarter):**
   - Production deployment
   - Multi-agent support
   - Plugin ecosystem
