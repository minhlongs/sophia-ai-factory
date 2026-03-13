# Sophia Phase 2A — Utility Tests Plan

**Created:** 2026-03-12 01:42
**Goal:** Increase test coverage from 3.64% → ~15%

---

## Tasks

### 1. llm-client.test.ts (6 tests)
- [ ] `generate()` function — 3 tests (success, error, validation)
- [ ] `generateStream()` function — 3 tests (streaming, error handling)

### 2. affiliate-data.test.ts (4 tests)
- [ ] Exported data structure — 2 tests
- [ ] Data validation — 2 tests

### 3. Update Test Config
- [ ] Add llm-client.ts to coverage include
- [ ] Run coverage report

---

## Execution Order
1. Create llm-client.test.ts
2. Create affiliate-data.test.ts
3. Run tests + coverage
4. Verify coverage ~15%

---

## Files to Create
- `app/lib/llm-client.test.ts`
- `app/lib/affiliate-data.test.ts`

---

## Success Criteria
- ✅ 30+ total tests
- ✅ Coverage ≥15%
- ✅ Build passes
- ✅ All tests pass
