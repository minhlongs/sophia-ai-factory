# Sophia Q1 2026 Completion — Parallel Plan

**Created:** 2026-03-11 20:07
**Goal:** Complete Q1 2026 roadmap — Tests 50%+, Error Boundaries, Loading States

---

## Dependency Graph

```
Phase 1: Test Setup ──┬──> Phase 2A: Component Tests
                      ├──> Phase 2B: Error Boundaries
                      └──> Phase 2C: Loading States

Phase 2A/B/C (Parallel) ──> Phase 3: Integration + Deploy
```

---

## Phases (Parallel Execution)

### Phase 1: Test Framework Setup
**File ownership:** `fullstack-developer` (test config)
**Dependencies:** None
**Tasks:**
- Install Vitest + @testing-library/react + @testing-library/jest-dom
- Create vitest.config.ts
- Create src/test-setup.ts
- Add test scripts to package.json

### Phase 2A: Component Tests (50% Coverage)
**File ownership:** `fullstack-developer` (test files)
**Dependencies:** Phase 1 complete
**Tasks:**
- Test Hero.tsx
- Test Workflow.tsx
- Test Pricing.tsx
- Test Features.tsx
- Test FAQ.tsx
- Achieve 50%+ coverage

### Phase 2B: Error Boundaries
**File ownership:** `fullstack-developer` (error-boundary components)
**Dependencies:** Phase 1 complete
**Tasks:**
- Create ErrorBoundary.tsx
- Create GlobalError.tsx
- Wrap app/layout.tsx
- Add fallback UIs

### Phase 2C: Loading States
**File ownership:** `fullstack-developer` (loading components)
**Dependencies:** Phase 1 complete
**Tasks:**
- Create LoadingSpinner.tsx
- Create Suspense wrappers
- Add skeleton loaders for sections
- Lazy load heavy components

### Phase 3: Integration + Deploy
**File ownership:** `fullstack-developer` (integration)
**Dependencies:** Phase 2A + 2B + 2C complete
**Tasks:**
- Run full test suite
- Verify coverage 50%+
- Build production
- Deploy to Cloudflare Pages
- Verify GREEN

---

## File Ownership Matrix

| Phase | Agent | Files | No Overlap |
|-------|-------|-------|------------|
| 1 | fullstack-developer | vitest.config.ts, test-setup.ts, package.json | ✅ |
| 2A | fullstack-developer | app/components/**/*.test.tsx | ✅ |
| 2B | fullstack-developer | app/components/ErrorBoundary.tsx, app/global-error.tsx | ✅ |
| 2C | fullstack-developer | app/components/Loading*.tsx, app/**/suspense | ✅ |
| 3 | fullstack-developer | Integration + deploy | ✅ |

---

## Execution Strategy

1. **Sequential:** Phase 1 → (Phase 2A + 2B + 2C parallel) → Phase 3
2. **Parallel:** Phases 2A, 2B, 2C run concurrently after Phase 1

---

## Success Criteria

- [ ] Vitest configured and running
- [ ] 20+ component tests written
- [ ] Code coverage ≥50%
- [ ] Error boundaries catch all errors
- [ ] Loading states on all async operations
- [ ] Build pass, deploy GREEN

---

## Next Steps

1. Execute Phase 1 (Test Setup)
2. Execute Phase 2A, 2B, 2C in parallel
3. Execute Phase 3 (Integration + Deploy)
4. Generate final report
