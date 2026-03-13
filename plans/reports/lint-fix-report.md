# ESLint Fix Report - Test Files

**Date:** 2026-03-13
**Task:** Fix 47 ESLint errors in test files
**Status:** COMPLETED

---

## Summary

Fixed all 47 ESLint errors across 9 test files:
- 45 `@typescript-eslint/no-explicit-any` errors
- 2 `@typescript-eslint/no-unused-vars` errors

---

## Files Modified

| File | Errors Fixed | Changes |
|------|--------------|---------|
| `AnimatedCounter.test.tsx` | 2 | Replaced `any` with proper types |
| `StaggerContainer.test.tsx` | 3 | Replaced `any`, removed 2 unused vars |
| `ROICalculator.test.tsx` | 2 | Replaced `any` with proper types |
| `Footer.test.tsx` | 3 | Replaced `any` with proper types |
| `AffiliateDiscovery.test.tsx` | 4 | Replaced `any` with proper types |
| `Affiliates.test.tsx` | 4 | Replaced `any` with proper types |
| `FAQ.test.tsx` | 6 | Replaced `any` with proper types |
| `MobileNav.test.tsx` | 7 | Replaced `any` with proper types |
| `Hero.test.tsx` | 15 | Replaced `any` with proper types |
| **Total** | **47** | |

---

## Fix Strategy Applied

### 1. Mock Component Props (`any` → Proper Types)

**Pattern for framer-motion mocks:**
```typescript
// Before
vi.fn(({ children, ...props }: any) => ...)

// After
vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => ...)
```

**Pattern for icon mocks:**
```typescript
// Before
vi.fn((props: any) => <svg {...props} />)

// After
vi.fn((props: React.SVGProps<SVGSVGElement>) => <svg {...props} />)
```

**Pattern for UI component mocks:**
```typescript
// Before
({ children, onClick, className }: any) => (...)

// After
({ children, onClick, className }: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) => (...)
```

### 2. Unused Variables

**Pattern:**
```typescript
// Before - unused 'variants' and 'viewport' params
vi.fn(({ children, className, variants, initial, whileInView, viewport, ...props }) => ...)

// After - removed unused params
vi.fn(({ children, className, initial, whileInView, ...props }) => ...)
```

---

## Verification

All lint checks pass:
```bash
npm run lint -- app/components/**/*.test.tsx
# Exit code: 0
```

---

## Tasks Completed

- [x] Fix ESLint errors in AnimatedCounter.test.tsx (2 errors)
- [x] Fix ESLint errors in StaggerContainer.test.tsx (3 errors)
- [x] Fix ESLint errors in ROICalculator.test.tsx (2 errors)
- [x] Fix ESLint errors in Footer.test.tsx (3 errors)
- [x] Fix ESLint errors in AffiliateDiscovery.test.tsx (4 errors)
- [x] Fix ESLint errors in Affiliates.test.tsx (4 errors)
- [x] Fix ESLint errors in FAQ.test.tsx (6 errors)
- [x] Fix ESLint errors in MobileNav.test.tsx (7 errors)
- [x] Fix ESLint errors in Hero.test.tsx (15 errors)

---

## Next Steps

- Run tests to ensure no regressions: `npm test`
- Commit changes with conventional commit message

---

## Unresolved Questions

None - all 47 errors fixed successfully.
