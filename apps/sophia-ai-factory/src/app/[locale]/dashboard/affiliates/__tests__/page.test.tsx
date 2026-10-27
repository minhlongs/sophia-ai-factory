import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AffiliatesDashboardPage from '../page';

/**
 * Component-level checks (no browser). The dashboard must describe its own
 * load state honestly: a failed/unauthenticated read is never rendered as
 * "$0.00 earned", and a queued job is never called rendered media.
 */
describe('AffiliatesDashboardPage', () => {
  it('renders the VI workspace results view with an explicit load state', async () => {
    const Component = await AffiliatesDashboardPage({
      params: Promise.resolve({ locale: 'vi' }),
    });

    render(Component);

    expect(screen.getByText('Kết Quả Affiliate')).toBeDefined();
    expect(
      screen.getByText(
        'Chỉ số liệu hoa hồng affiliate bên ngoài của workspace — tách biệt với thanh toán gói dịch vụ và Refer Sophia.',
      ),
    ).toBeDefined();

    const loadState = screen.getByTestId('affiliate-load-state');
    expect(
      ['unauthenticated', 'unconnected', 'empty', 'ready', 'error'].includes(
        loadState.getAttribute('data-state') ?? '',
      ),
    ).toBe(true);
    expect(loadState.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByText('Hoa Hồng Hiệu Lực')).toBeDefined();
    expect(screen.getByText('Trạng Thái Sản Xuất')).toBeDefined();
    expect(screen.getByText('Queue chưa phải là media đã render')).toBeDefined();
  });

  it('renders the EN workspace results view with an explicit load state', async () => {
    const Component = await AffiliatesDashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    render(Component);

    expect(screen.getByText('Affiliate Results')).toBeDefined();
    expect(
      screen.getByText(
        'External affiliate commission only — separate from subscription billing and Refer Sophia.',
      ),
    ).toBeDefined();

    const loadState = screen.getByTestId('affiliate-load-state');
    expect(
      ['unauthenticated', 'unconnected', 'empty', 'ready', 'error'].includes(
        loadState.getAttribute('data-state') ?? '',
      ),
    ).toBe(true);
    expect(loadState.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByText('Effective Commission')).toBeDefined();
    expect(screen.getByText('Production State')).toBeDefined();
    expect(screen.getByText('A queued job is not rendered media')).toBeDefined();
  });
});
