# Phase 01: Global Setup Base
**Priority:** P1 | **Status:** Complete | **Date:** 2026-08-02

## Overview
Create `tests/e2e/global-setup.ts` as the single entry point that runs before all Playwright test suites.

## Requirements
- Create test output directories (screenshots, videos)
- Log test base URL and environment
- Validate environment configuration

## Implementation
File: `tests/e2e/global-setup.ts` (initial version, ~40 lines)

Key code:
```typescript
export default async () => {
  ensureDir(testResultsDir);
  ensureDir(screenshotsDir);
  ensureDir(videosDir);
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
  console.log(`Test base URL: ${baseUrl}`);
};
```

## Success Criteria
- global-setup.ts exists and runs without error
- Directories created at test-results/{screenshots,videos}
