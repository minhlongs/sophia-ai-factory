/**
 * Unit tests for CustomerHealthDashboard component.
 * Verifies rendering of all 7 service status cards and incidents.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerHealthDashboard } from '../customer-health-dashboard';
import type { CustomerSystemHealth } from '@/land/production-monitoring/customer-health-summary';

const healthySystem: CustomerSystemHealth = {
  sophiaCore: 'READY',
  authentication: 'READY',
  aiProvider: 'READY',
  storage: 'READY',
  videoPipeline: 'READY',
  billing: 'READY',
  telegram: 'CONNECTED',
  incidents: [],
  checkedAt: new Date().toISOString(),
};

describe('CustomerHealthDashboard', () => {
  it('renders all 7 service cards in healthy state', () => {
    render(<CustomerHealthDashboard initialHealth={healthySystem} locale="vi" />);

    expect(screen.getByTestId('status-card-core')).toBeDefined();
    expect(screen.getByTestId('status-card-auth')).toBeDefined();
    expect(screen.getByTestId('status-card-ai')).toBeDefined();
    expect(screen.getByTestId('status-card-storage')).toBeDefined();
    expect(screen.getByTestId('status-card-pipeline')).toBeDefined();
    expect(screen.getByTestId('status-card-billing')).toBeDefined();
    expect(screen.getByTestId('status-card-telegram')).toBeDefined();

    expect(screen.getByTestId('all-systems-operational')).toBeDefined();
    expect(screen.getByText('Tất cả hệ thống đang hoạt động tốt')).toBeDefined();
  });

  it('renders action required and degraded badges when unhealthy', () => {
    const degradedSystem: CustomerSystemHealth = {
      ...healthySystem,
      aiProvider: 'ACTION_REQUIRED',
      videoPipeline: 'DEGRADED',
      telegram: 'NOT_CONNECTED',
      incidents: [
        {
          id: 'inc-byok-empty',
          category: 'KEY_EXPIRED_OR_INVALID',
          service: 'AI Provider BYOK',
          whatHappened: 'No AI provider API keys configured.',
          whatHappenedVi: 'Chưa cấu hình khóa API cho nhà cung cấp AI nào.',
          whatItMeans: 'Sophia cannot generate videos.',
          whatItMeansVi: 'Sophia chưa thể tạo video.',
          whatYouCanDo: 'Add keys in Settings.',
          whatYouCanDoVi: 'Thêm khóa API trong Cài đặt.',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    render(<CustomerHealthDashboard initialHealth={degradedSystem} locale="vi" />);

    expect(screen.queryByTestId('all-systems-operational')).toBeNull();
    expect(screen.getByTestId('incidents-list')).toBeDefined();
    expect(screen.getByText('Chưa cấu hình khóa API cho nhà cung cấp AI nào.')).toBeDefined();
  });

  it('renders English headings and status names when locale is en', () => {
    render(<CustomerHealthDashboard initialHealth={healthySystem} locale="en" />);

    expect(screen.getByText('Customer Health Center')).toBeDefined();
    expect(screen.getByText('All Systems Operational')).toBeDefined();
    expect(screen.getByText('Refresh Health')).toBeDefined();
  });
});
