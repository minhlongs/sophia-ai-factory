---
title: "Phase 2: Create ErrorBoundary Tests"
priority: P2
status: pending
---

# Phase 2: Create ErrorBoundary Tests

## Context
- Parent Plan: [[plan.md]](./plan.md)
- Depends On: Phase 1 (ErrorBoundary Component)

## Overview
Write comprehensive tests for the ErrorBoundary component using React Testing Library and Vitest.

## Requirements
- Test error catching behavior
- Test reset functionality
- Test fallback rendering
- Test onError callback

## Implementation

### File: `components/error-boundary.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./error-boundary";

// Test component that throws
function ThrowError({ message }: { message: string }) {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("catches and displays error", () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="fallback">Custom Error</div>}>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });

  it("calls onError callback", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalled();
  });

  it("resets after clicking try again button", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    );

    // Force error
    rerender(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    );

    // Click reset
    fireEvent.click(screen.getByText("Try again"));

    // Re-render with valid content
    rerender(
      <ErrorBoundary>
        <div data-testid="child">Hello After Reset</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
```

## Todo
- [ ] Create `components/error-boundary.test.tsx`
- [ ] Run `npm test` and verify all tests pass

## Success Criteria
- All 5 tests pass
- Code coverage includes ErrorBoundary component
- No console errors from tests themselves
