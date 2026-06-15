---
title: "Phase 6: Testing"
status: pending
priority: P2
effort: 1h
---

# Phase 6: Testing

## Context

**Testing Stack:**
- Vitest (unit tests)
- React Testing Library (component tests)
- Playwright (E2E tests)

**Existing Patterns:**
- Usage metering tests: `src/lib/usage-metering/*.test.ts`
- API tests: `src/app/api/**/route.test.ts`

## Requirements

### 6.1 Unit Tests (API Layer)

**File:** `src/app/api/analytics/usage/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockUser, createMockSupabaseClient } from '@/lib/test-utils';

describe('GET /api/analytics/usage', () => {
  beforeEach(async () => {
    // Create test user with license
    await createMockUser({
      id: 'test-user-1',
      tier: 'PREMIUM',
    });
  });

  it('returns usage metrics for valid request', async () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 86400 * 7; // 7 days ago

    const response = await GET(
      new Request(`http://localhost/api/analytics/usage?start=${start}&end=${now}`)
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('totalRequests');
    expect(data.summary).toHaveProperty('totalCredits');
  });

  it('rejects request without authentication', async () => {
    const response = await GET(
      new Request('http://localhost/api/analytics/usage?start=0&end=9999999999')
    );

    expect(response.status).toBe(401);
  });

  it('enforces 90-day max range', async () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 100 * 86400; // 100 days ago

    const response = await GET(
      new Request(`http://localhost/api/analytics/usage?start=${start}&end=${now}`)
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Date range exceeds maximum');
  });

  it('blocks non-admin from accessing other customer data', async () => {
    // Create another user
    await createMockUser({ id: 'other-user', tier: 'BASIC' });

    const response = await GET(
      new Request(
        'http://localhost/api/analytics/usage?license_nonce=other-user-nonce&start=0&end=9999999999'
      )
    );

    expect(response.status).toBe(403);
  });
});
```

### 6.2 Component Tests (UI Layer)

**File:** `src/app/[locale]/dashboard/analytics/components/metrics-cards.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { MetricsCards } from './metrics-cards';

describe('MetricsCards', () => {
  const mockMetrics = {
    requests: 1250,
    tokens: 50000,
    credits: 350,
    responseTime: 245,
    errorRate: 2.5,
  };

  it('renders all metric cards', () => {
    render(<MetricsCards metrics={mockMetrics} period="Last 7 days" />);

    expect(screen.getByText('Total Requests')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('Total Credits')).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<MetricsCards metrics={mockMetrics} period="Last 7 days" loading />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('formats large numbers correctly', () => {
    render(
      <MetricsCards
        metrics={{ ...mockMetrics, requests: 1250000 }}
        period="Last 30 days"
      />
    );

    expect(screen.getByText('1,250,000')).toBeInTheDocument();
  });
});
```

**File:** `src/app/[locale]/dashboard/analytics/components/time-series-chart.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { TimeSeriesChart } from './time-series-chart';

describe('TimeSeriesChart', () => {
  const mockData = [
    { timestamp: 1709251200, requests: 100, credits: 50, tokens: 5000 },
    { timestamp: 1709254800, requests: 150, credits: 75, tokens: 7500 },
    { timestamp: 1709258400, requests: 200, credits: 100, tokens: 10000 },
  ];

  it('renders chart with data', () => {
    render(
      <TimeSeriesChart
        data={mockData}
        metric="requests"
        granularity="hour"
      />
    );

    expect(screen.getByRole('img')).toBeInTheDocument(); // SVG chart
  });

  it('displays correct Y-axis label', () => {
    render(
      <TimeSeriesChart
        data={mockData}
        metric="credits"
        granularity="hour"
      />
    );

    expect(screen.getByText(/credits/i)).toBeInTheDocument();
  });
});
```

### 6.3 Integration Tests

**File:** `src/lib/analytics/analytics-integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, cleanupTestDatabase } from '@/lib/test-db';
import { fetchUsageMetrics } from './queries';

describe('Analytics Integration', () => {
  beforeEach(async () => {
    await createTestDatabase();
    // Seed test data
    await seedUsageEvents();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('aggregates usage events correctly', async () => {
    const supabase = createTestSupabaseClient();

    const metrics = await fetchUsageMetrics(
      supabase,
      'test-user-1',
      'test-license-nonce',
      Date.now() - 86400 * 1000, // 1 day ago
      Date.now()
    );

    expect(metrics.summary.totalRequests).toBeGreaterThan(0);
    expect(metrics.timeSeries.length).toBeGreaterThan(0);
  });

  it('handles empty data gracefully', async () => {
    const supabase = createTestSupabaseClient();

    const metrics = await fetchUsageMetrics(
      supabase,
      'non-existent-user',
      'non-existent-license',
      Date.now() - 86400 * 1000,
      Date.now()
    );

    expect(metrics.summary.totalRequests).toBe(0);
    expect(metrics.timeSeries).toEqual([]);
  });
});
```

### 6.4 E2E Tests (Playwright)

**File:** `e2e/analytics-dashboard.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as premium user
    await page.goto('/login');
    await page.fill('[name="email"]', 'premium@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('loads analytics page', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    await expect(page).toHaveURL('/dashboard/analytics');
    await expect(page.getByText('Analytics Dashboard')).toBeVisible();
  });

  test('displays metrics cards', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    await expect(page.getByText('Total Requests')).toBeVisible();
    await expect(page.getByText('Total Credits')).toBeVisible();
    await expect(page.getByText('Error Rate')).toBeVisible();
  });

  test('renders time-series chart', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Wait for chart to render
    await page.waitForSelector('svg.recharts-surface');

    const chart = page.locator('svg.recharts-surface');
    await expect(chart).toBeVisible();
  });

  test('date range picker works', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    await page.click('[data-testid="date-range-picker"]');
    await page.click('text="Last 30 days"');

    // Verify chart updates
    await page.waitForSelector('svg.recharts-surface');
  });

  test('export button disabled for BASIC tier', async ({ page }) => {
    // Login as BASIC user
    await page.goto('/login');
    await page.fill('[name="email"]', 'basic@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto('/dashboard/analytics');

    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).toBeDisabled();
  });

  test('admin sees customer table', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto('/dashboard/analytics');

    await expect(page.getByText('Customer')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });
});
```

### 6.5 RBAC Tests

**File:** `src/lib/analytics/access-control.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getAnalyticsAccess } from './access-control';

describe('getAnalyticsAccess', () => {
  it('returns full access for MASTER tier', () => {
    const access = getAnalyticsAccess('MASTER', false);

    expect(access.canViewCustomDateRange).toBe(true);
    expect(access.canViewRevenue).toBe(true);
    expect(access.canExport).toBe(true);
    expect(access.canAutoRefresh).toBe(true);
  });

  it('returns customer table access for admin', () => {
    const access = getAnalyticsAccess('PREMIUM', true);

    expect(access.canViewCustomerTable).toBe(true);
  });

  it('restricts BASIC tier', () => {
    const access = getAnalyticsAccess('BASIC', false);

    expect(access.canViewCustomDateRange).toBe(false);
    expect(access.canExport).toBe(false);
    expect(access.canAutoRefresh).toBe(false);
  });

  it('enables export for PREMIUM+', () => {
    expect(getAnalyticsAccess('PREMIUM', false).canExport).toBe(true);
    expect(getAnalyticsAccess('ENTERPRISE', false).canExport).toBe(true);
    expect(getAnalyticsAccess('MASTER', false).canExport).toBe(true);
  });
});
```

## Files to Create

**Create:**
```
src/app/api/analytics/usage/route.test.ts
src/app/api/analytics/revenue/route.test.ts
src/app/api/analytics/licenses/route.test.ts
src/app/[locale]/dashboard/analytics/components/metrics-cards.test.tsx
src/app/[locale]/dashboard/analytics/components/time-series-chart.test.tsx
src/app/[locale]/dashboard/analytics/components/tier-breakdown-chart.test.tsx
src/lib/analytics/access-control.test.ts
src/lib/analytics/analytics-integration.test.ts
e2e/analytics-dashboard.spec.ts
```

## Test Commands

```bash
# Unit tests
npx vitest run src/lib/analytics/
npx vitest run src/app/api/analytics/

# Component tests
npx vitest run src/app/[locale]/dashboard/analytics/components/

# E2E tests
npx playwright test e2e/analytics-dashboard.spec.ts

# All tests
npm test
```

## Success Criteria

- [ ] All unit tests pass (100%)
- [ ] All component tests pass
- [ ] E2E tests pass (happy path + edge cases)
- [ ] Code coverage >80% for analytics module
- [ ] No TypeScript errors in test files

## Related Files

**Read:**
- `src/lib/usage-metering/aggregator.test.ts`
- `src/app/api/internal/usage/query/internal-usage-query.test.ts`

**Create:**
- 9 test files (unit, component, integration, E2E)
