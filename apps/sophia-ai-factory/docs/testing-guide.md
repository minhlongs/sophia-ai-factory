# Testing Guide

## Overview

Sophia AI Video Factory uses **Vitest** for unit and integration testing. We prioritize testing critical business logic, validation services, and API integrations over UI snapshot testing.

## Running Tests

### Standard Run
Execute the full test suite:
```bash
npm test
```

### Watch Mode
Run tests in interactive watch mode (useful during development):
```bash
npx vitest
```

### Coverage Report
Generate a code coverage report:
```bash
npx vitest run --coverage
```

## Test Structure

Tests are co-located with the source code they test, typically named `{filename}.test.ts`.

### Key Test Areas

1.  **Validation Services** (`src/lib/validation/services.test.ts`)
    *   Verifies that API keys for OpenRouter, ElevenLabs, and D-ID are correctly validated.
    *   Mocks external API calls to ensure tests are deterministic and don't consume credits.

2.  **Utility Functions** (`src/lib/utils.test.ts`)
    *   Tests helper functions like class merging (`cn`), formatting, etc.

3.  **Server Actions** (`src/app/actions/automation.test.ts`)
    *   Tests the backend logic for triggering script generation and video rendering.
    *   Ensures Zod schemas correctly validate input data.

4.  **Webhooks** (`src/app/api/webhooks/polar/route.test.ts`)
    *   Tests integration with payment providers (Polar).
    *   Verifies signature verification and event handling logic.

5.  **End-to-End (E2E) Tests** (`tests/e2e/`)
    *   **Playwright** based tests simulating real user user flows.
    *   Run against **Mock Mode** (`NEXT_PUBLIC_MOCK_AI_SERVICES=true`) for deterministic, zero-cost verification.
    *   Tests the critical path: Setup Wizard -> Dashboard -> Script Gen -> Video Render.

## Running E2E Tests

E2E tests require the application to be running in Mock Mode.

```bash
# 1. Start App in Mock Mode (Terminal 1)
npm run dev:mock

# 2. Run Playwright Tests (Terminal 2)
npx playwright test
```

## Mock Mode Testing

We use a "Mock Mode" strategy to test the full application flow without external dependencies.

- **Enable**: Set `NEXT_PUBLIC_MOCK_AI_SERVICES=true` in `.env.local` or environment.
- **Mechanism**: The `ServiceFactory` injects `MockHeyGenService` instead of `RealHeyGenService`.
- **Behavior**: Mock services return instant, successful responses with fake data (e.g., a placeholder video URL).
- **Benefit**: Allows CI/CD to run full E2E tests on every PR without API costs or flakiness.

## Writing New Tests

### Unit Tests
For pure functions or independent classes, use standard Vitest assertions:

```typescript
import { describe, it, expect } from 'vitest';
import { myUtility } from './my-utility';

describe('myUtility', () => {
  it('should return correct value', () => {
    const result = myUtility('input');
    expect(result).toBe('expected-output');
  });
});
```

### Mocking External Services
When testing code that calls external APIs (like `fetch`), use Vitest's mocking capabilities to avoid real network requests:

```typescript
import { vi, describe, it, expect } from 'vitest';
import { validateOpenRouterKey } from './services';

// Mock global fetch
global.fetch = vi.fn();

describe('validateOpenRouterKey', () => {
  it('should return true for valid key', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const isValid = await validateOpenRouterKey('sk-valid-key');
    expect(isValid).toBe(true);
  });
});
```

## Best Practices

*   **Test Behavior, Not Implementation**: Focus on inputs and outputs.
*   **Keep Tests Fast**: Mock slow I/O operations (DB, Network).
*   **Descriptive Names**: Use `describe` blocks to group tests and `it` strings to explain the scenario.
*   **Clean Up**: Vitest handles cleanup automatically, but be mindful of global state modifications.
