# Phase 1: Setup Ollama Local

**Date:** 2026-03-11
**Priority:** HIGH
**Status:** PLANNED

---

## Context

- Parent Plan: [plan.md](./plan.md)
- Dependencies: None (first phase)

---

## Overview

Cài đặt Ollama để chạy LLMs local trên máy development.

---

## Requirements

### Functional
- [ ] Ollama installed và running
- [ ] Model downloaded (llama-3.2-3b)
- [ ] API accessible tại `http://localhost:11434`

### Non-functional
- Startup time < 30s
- Memory usage < 4GB (3B model)

---

## Implementation Steps

1. Install Ollama:
   ```bash
   brew install ollama  # macOS
   ```

2. Pull model:
   ```bash
   ollama pull llama3.2:3b
   ```

3. Verify:
   ```bash
   ollama run llama3.2:3b "Hello"
   ```

4. Test API:
   ```bash
   curl http://localhost:11434/api/generate -d '{"model":"llama3.2:3b","prompt":"Hello"}'
   ```

---

## Todo List

- [ ] Install Ollama
- [ ] Pull llama-3.2-3b model
- [ ] Verify CLI works
- [ ] Verify API works
- [ ] Document in `.env.example`

---

## Success Criteria

```bash
# Test command passes
ollama run llama3.2:3b "test"

# API returns valid response
curl http://localhost:11434/api/generate -d '{"model":"llama3.2:3b","prompt":"test"}'
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Slow download | Medium | Use mirror, resume support |
| RAM insufficient | High | Use smaller model (1B) |
| Port conflict | Low | Change default port |

---

## Security Considerations

- Ollama API chỉ listen trên `localhost`
- Không expose ra public network
- No authentication needed (local only)

---

## Next Steps

→ Phase 2: Add API Routes
