import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AffiliatesDashboardPage from '../page';

describe('AffiliatesDashboardPage', () => {
  it('renders affiliate cockpit and metrics correctly for vi locale', async () => {
    const Component = await AffiliatesDashboardPage({
      params: Promise.resolve({ locale: 'vi' }),
    });

    render(Component);

    expect(screen.getByText('Bảng Điều Khiển Tiếp Thị Liên Kết')).toBeDefined();
    expect(screen.getByText('Bảng Điều Khiển Doanh Thu & Rủi Ro Affiliate')).toBeDefined();
    expect(screen.getByText('Tổng Doanh Thu (Gross)')).toBeDefined();
    expect(screen.getByText('Ký Quỹ Rủi Ro (10% Holdback)')).toBeDefined();
    expect(screen.getByText('Hoa Hồng Thực Nhận (Net)')).toBeDefined();
  });

  it('renders affiliate cockpit and metrics correctly for en locale', async () => {
    const Component = await AffiliatesDashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    render(Component);

    expect(screen.getByText('Affiliate Flywheel Dashboard')).toBeDefined();
    expect(screen.getByText('Affiliate Revenue & Risk Cockpit')).toBeDefined();
    expect(screen.getByText('Gross Revenue')).toBeDefined();
    expect(screen.getByText('Risk Reserve (10% Holdback)')).toBeDefined();
    expect(screen.getByText('Net Payable Commission')).toBeDefined();
  });
});
