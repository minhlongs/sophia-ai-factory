import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardTopBar } from '../dashboard-topbar';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dashboard',
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('DashboardTopBar — Obsidian Cyber-Glass TopBar', () => {
  it('renders fixed header with backdrop-blur-xl and obsidian border', () => {
    render(<DashboardTopBar />);

    const header = screen.getByTestId('dashboard-topbar');
    expect(header.className).toContain('fixed');
    expect(header.className).toContain('backdrop-blur-xl');
    expect(header.className).toContain('bg-[#08090D]/80');
    expect(header.className).toContain('border-[#222536]');
  });

  it('renders clean search input with magnifying glass icon', () => {
    render(<DashboardTopBar searchPlaceholder="Search missions..." />);

    const searchInput = screen.getByTestId('dashboard-search-input');
    expect(searchInput).toBeDefined();
    expect(searchInput.getAttribute('placeholder')).toBe('Search missions...');
  });

  it('renders notification bell with unread badge when count > 0', () => {
    const { rerender } = render(<DashboardTopBar unreadNotificationCount={5} />);
    const badge = screen.getByTestId('unread-notification-badge');
    expect(badge.textContent).toBe('5');

    rerender(<DashboardTopBar unreadNotificationCount={0} />);
    expect(screen.queryByTestId('unread-notification-badge')).toBeNull();
  });

  it('renders bilingual locale switcher and routes on toggle click', () => {
    render(<DashboardTopBar />);

    const localeBtn = screen.getByTestId('locale-switcher');
    expect(localeBtn.textContent).toContain('EN');

    fireEvent.click(localeBtn);
    expect(mockPush).toHaveBeenCalledWith('/vi/dashboard');
  });

  it('renders high-contrast user profile and mobile drawer trigger', () => {
    const onOpenMobile = vi.fn();
    render(
      <DashboardTopBar
        onOpenMobileDrawer={onOpenMobile}
        user={{
          name: 'Sarah Connor',
          role: 'Admin / Owner',
        }}
      />
    );

    expect(screen.getByText('Sarah Connor')).toBeDefined();
    expect(screen.getByText('Admin / Owner')).toBeDefined();

    const mobileBtn = screen.getByTestId('mobile-drawer-trigger');
    fireEvent.click(mobileBtn);
    expect(onOpenMobile).toHaveBeenCalledTimes(1);
  });
});
