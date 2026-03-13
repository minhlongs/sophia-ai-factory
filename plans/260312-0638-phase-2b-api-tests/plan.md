# Sophia Phase 2B — API Route Tests

**Created:** 2026-03-12 06:38
**Goal:** Test API route + Increase coverage to ~20%

---

## Tasks

### 1. route.test.ts (8 tests)
- [ ] Validation: Empty prompt → 400
- [ ] Validation: Prompt too long → 400
- [ ] Success: Valid request → 200 + response
- [ ] Error: Ollama API fails → 500
- [ ] Error: Network error → 500
- [ ] Uses env vars (OLLAMA_BASE_URL, LLM_MODEL)
- [ ] Sends correct options to Ollama
- [ ] Handles stream: true (future)

### 2. Mock Setup
- [ ] Mock global fetch for Ollama API
- [ ] Mock NextResponse

### 3. Run + Verify
- [ ] All tests pass
- [ ] Coverage ~20%
- [ ] Build passes

---

## Files
- Create: `app/api/generate/route.test.ts`

---

## Success Criteria
- ✅ 45+ total tests
- ✅ Coverage ≥20%
- ✅ Build passes
