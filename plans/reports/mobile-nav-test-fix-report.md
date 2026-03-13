# MobileNav Test Fix Report

**Date:** 2026-03-13
**File:** `app/components/layout/MobileNav.test.tsx`
**Status:** RESOLVED

## Root Cause

Test failing at line 109: `expect(mockScrollIntoView).toHaveBeenCalled()`

**Issue:** The CTA button's onClick handler in `MobileNav.tsx` calls:
```js
document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' })
```

The test DOM had no element with `id="footer"`, so `getElementById` returned `undefined`, and the optional chaining (`?.`) prevented `scrollIntoView` from ever being called.

## Fix Applied

Added footer element creation to the failing test case:

```js
// Add footer element to DOM for scrollIntoView to work
const footer = document.createElement('footer')
footer.id = 'footer'
document.body.appendChild(footer)

// ... test logic ...

// Cleanup
document.body.removeChild(footer)
```

## Test Results

```
✓ app/components/layout/MobileNav.test.tsx (11 tests) 261ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

## Files Modified

- `app/components/layout/MobileNav.test.tsx` (+5 lines)

## Unresolved Questions

None
