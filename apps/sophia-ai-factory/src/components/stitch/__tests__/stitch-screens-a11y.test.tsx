/**
 * Unit & A11y tests for Stitch screens and layout (Milestone 3 & 4).
 *
 * Verifies:
 * 1. WCAG 2.1 AA semantic roles (tablist, tab, dialog, alert)
 * 2. aria-selected, aria-modal, aria-label on interactive controls
 * 3. Keyboard navigation (Escape key dismiss on drawer)
 * 4. Skip-to-content accessibility link
 * 5. Clean rendering of AffiliatesPage, PaymentsPage, SubscribersPage, DashboardLayout
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AffiliatesPage from '../screens/affiliates/affiliates-page';
import PaymentsPage from '../screens/payments/payments-page';
import SubscribersPage from '../screens/subscribers/subscribers-page';
import { DashboardLayout } from '../layouts/dashboard-layout';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${namespace || ''}.${key}:${JSON.stringify(params)}`;
    return `${namespace || ''}.${key}`;
  },
  useLocale: () => 'en',
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock @/navigation Link
vi.mock('@/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('Stitch AffiliatesPage Accessibility & Semantic Roles', () => {
  it('renders tablist and tabs with correct ARIA roles and aria-selected state', () => {
    render(<AffiliatesPage initialAffiliates={[]} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeDefined();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);

    // Initial state: partners tab active
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');

    // Switch to discovery tab
    fireEvent.click(tabs[1]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('renders action buttons with accessible labels', () => {
    render(
      <AffiliatesPage
        initialAffiliates={[
          {
            id: 'aff_1',
            name: 'Partner One',
            email: 'partner@example.com',
            status: 'active',
            totalSales: 12,
            totalCommission: '$1,200',
            pending: '$200',
            avatar: null,
          },
        ]}
      />
    );

    const actionBtn = screen.getByRole('button', { name: /stitch\.affiliates\.affiliateActions/i });
    expect(actionBtn).toBeDefined();
  });
});

describe('Stitch PaymentsPage Accessibility & Data Flow', () => {
  it('renders export and filter controls with accessible roles', () => {
    render(<PaymentsPage initialPayments={[]} />);

    expect(screen.getByText('stitch.payments.title')).toBeDefined();
    expect(screen.getByText('stitch.payments.export')).toBeDefined();
    expect(screen.getByText('stitch.payments.filter')).toBeDefined();
  });

  it('renders empty state when no transactions exist', () => {
    render(<PaymentsPage initialPayments={[]} />);

    expect(screen.getByText('stitch.payments.emptyTitle')).toBeDefined();
    expect(screen.getByText('stitch.payments.emptyDesc')).toBeDefined();
  });

  it('renders transactions table with sticky column and action view buttons', () => {
    render(
      <PaymentsPage
        initialPayments={[
          {
            id: 'pay_1',
            date: '2026-10-06',
            customer: 'Acme Corp',
            email: 'billing@acme.com',
            amount: '$299.00',
            status: 'paid',
            method: 'NOWPayments (USDT)',
          },
        ]}
      />
    );

    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('$299.00')).toBeDefined();
    const viewBtn = screen.getByRole('button', { name: /stitch\.payments\.view/i });
    expect(viewBtn).toBeDefined();
  });
});

describe('Stitch SubscribersPage Accessibility & Controls', () => {
  it('renders subscribers table with actions having accessible labels', () => {
    render(
      <SubscribersPage
        initialSubscribers={[
          {
            id: 'sub_1',
            name: 'Jane Doe',
            email: 'jane@example.com',
            plan: 'Pro Plan',
            status: 'active',
            joined: 'Oct 2026',
            avatar: null,
          },
        ]}
      />
    );

    expect(screen.getByText('Jane Doe')).toBeDefined();
    expect(screen.getByText('jane@example.com')).toBeDefined();
    const actionBtn = screen.getByRole('button', { name: /stitch\.subscribers\.subscriberActions/i });
    expect(actionBtn).toBeDefined();
  });
});

describe('Stitch DashboardLayout Accessibility & Responsive Drawer', () => {
  it('renders skip-to-content bypass link pointing to #main-content', () => {
    render(
      <DashboardLayout title="Dashboard Test">
        <div>Child Content</div>
      </DashboardLayout>
    );

    const skipLink = screen.getByRole('link', { name: /stitch\.navigation\.skipToContent/i });
    expect(skipLink).toBeDefined();
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });

  it('opens mobile drawer with dialog semantics and dismisses with Escape key', () => {
    render(
      <DashboardLayout title="Dashboard Test">
        <div>Child Content</div>
      </DashboardLayout>
    );

    const mobileMenuTrigger = screen.getByRole('button', {
      name: /stitch\.navigation\.openMobileNav/i,
    });
    expect(mobileMenuTrigger).toBeDefined();

    // Drawer is present with dialog semantics
    const drawer = screen.getByRole('dialog');
    expect(drawer.getAttribute('aria-modal')).toBe('true');
    expect(drawer.className).toContain('-translate-x-full');

    // Click trigger to open
    fireEvent.click(mobileMenuTrigger);
    expect(drawer.className).toContain('translate-x-0');

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(drawer.className).toContain('-translate-x-full');
  });
});
