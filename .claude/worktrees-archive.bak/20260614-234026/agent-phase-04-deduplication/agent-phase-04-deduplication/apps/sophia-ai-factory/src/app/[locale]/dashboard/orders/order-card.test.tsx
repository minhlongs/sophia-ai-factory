/**
 * Tests for OrderCard component.
 * Covers: failed_permanent state UI, completed state, queued/processing state.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OrderCard } from './order-card';
import type { OrderTimelineRow } from '@/land/orders/order-types';

// Mock SWR to return initial data without polling
vi.mock('swr', () => ({
  default: vi.fn((_key: unknown, _fetcher: unknown, _opts: unknown) => ({
    data: undefined,
  })),
}));

// Mock OrderTimeline to isolate OrderCard rendering
vi.mock('./order-timeline', () => ({
  OrderTimeline: ({ order, locale }: { order: OrderTimelineRow; locale: string }) => (
    <div data-testid="order-timeline" data-status={order.videoStatus} data-locale={locale} />
  ),
}));

function makeOrder(overrides: Partial<OrderTimelineRow> = {}): OrderTimelineRow {
  return {
    purchaseId: 'purchase-abc-123',
    sku: 'starter_bundle',
    status: 'paid',
    paidAt: 1714000000,
    creditsRemaining: 10,
    videoId: null,
    videoStatus: null,
    attemptCount: 0,
    lastAttemptAt: null,
    videoUrl: null,
    estimatedReadyAt: null,
    accessRevoked: 0,
    ...overrides,
  };
}

describe('OrderCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('failed_permanent state (G feature)', () => {
    const failedOrder = makeOrder({ videoStatus: 'failed_permanent', attemptCount: 5 });

    it('shows failure title in English', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="en" />);
      expect(screen.getByText('Video generation failed')).toBeTruthy();
    });

    it('shows failure title in Vietnamese', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="vi" />);
      expect(screen.getByText('Tạo video không thành công')).toBeTruthy();
    });

    it('shows support notification + free credit message in English', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="en" />);
      expect(screen.getByText(/support team has been notified/i)).toBeTruthy();
      expect(screen.getByText(/1 free credit/i)).toBeTruthy();
    });

    it('shows support notification + free credit message in Vietnamese', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="vi" />);
      expect(screen.getByText(/Đội hỗ trợ đã được thông báo/i)).toBeTruthy();
      expect(screen.getByText(/1 credit miễn phí/i)).toBeTruthy();
    });

    it('shows red failure icon (❌)', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="en" />);
      // The ❌ emoji is in a span[aria-hidden=true] in the failed notice
      const notice = screen.getByText('Video generation failed').closest('div');
      expect(notice?.textContent).toContain('❌');
    });

    it('shows contact support mailto link with purchaseId in subject', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="en" />);
      const link = screen.getByRole('link', { name: /contact support/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toContain('purchase-abc-123');
      expect(link.getAttribute('href')).toContain('support@mekongmind.com');
    });

    it('does NOT show Watch video button', () => {
      render(
        <OrderCard
          purchaseId="purchase-abc-123"
          initialOrder={{ ...failedOrder, videoId: 'some-video-id' }}
          locale="en"
        />
      );
      expect(screen.queryByRole('link', { name: /watch video/i })).toBeNull();
    });

    it('does NOT show retry notice', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="en" />);
      expect(screen.queryByText(/Attempt 5 of 5/i)).toBeNull();
    });
  });

  describe('completed state', () => {
    const completedOrder = makeOrder({
      videoStatus: 'completed',
      videoId: 'vid-xyz',
    });

    it('does NOT show failure notice', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={completedOrder} locale="en" />);
      expect(screen.queryByText('Video generation failed')).toBeNull();
    });

    it('does NOT show contact support button', () => {
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={completedOrder} locale="en" />);
      expect(screen.queryByRole('link', { name: /contact support/i })).toBeNull();
    });
  });

  describe('queued/processing state', () => {
    it('shows retry notice when attemptCount > 0 and not completed', () => {
      const queuedOrder = makeOrder({ videoStatus: 'queued', attemptCount: 2 });
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={queuedOrder} locale="en" />);
      expect(screen.getByText('Attempt 2 of 5')).toBeTruthy();
    });

    it('does NOT show retry notice when failed_permanent', () => {
      const failedOrder = makeOrder({ videoStatus: 'failed_permanent', attemptCount: 5 });
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={failedOrder} locale="en" />);
      expect(screen.queryByText('Attempt 5 of 5')).toBeNull();
    });
  });

  describe('access revoked state', () => {
    it('shows revoked banner and hides support button', () => {
      const revokedFailedOrder = makeOrder({
        videoStatus: 'failed_permanent',
        accessRevoked: 1,
      });
      render(<OrderCard purchaseId="purchase-abc-123" initialOrder={revokedFailedOrder} locale="en" />);
      expect(screen.getByText(/Video access revoked due to refund/i)).toBeTruthy();
      expect(screen.queryByRole('link', { name: /contact support/i })).toBeNull();
    });
  });
});
