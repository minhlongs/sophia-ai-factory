---
title: "Phase 1: Create ErrorBoundary Component"
priority: P1
status: pending
---

# Phase 1: Create ErrorBoundary Component

## Context
- Parent Plan: [[plan.md]](./plan.md)
- Related: `components/landing/` directory structure

## Overview
Create a React Error Boundary component to catch and gracefully handle runtime rendering errors.

## Requirements
- Must be a Client Component (`"use client"`)
- Use class component (only class components can be error boundaries)
- Implement `componentDidCatch` and `getDerivedStateFromError`
- Tailwind CSS styling matching existing design
- Reset button to recover from errors

## Implementation

### File: `components/error-boundary.tsx`

```typescript
"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-800">
            Something went wrong
          </h2>
          <p className="text-sm text-red-600">
            We're sorry, but there was an error loading this content.
          </p>
          <Button onClick={this.resetErrorBoundary} variant="outline">
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Todo
- [ ] Create `components/error-boundary.tsx`
- [ ] Verify TypeScript compiles without errors

## Success Criteria
- Component compiles without TypeScript errors
- Error boundary catches rendering errors
- Reset button restores normal view
