/**
 * Tests for OneTimeBundleCard component.
 * Covers: HeyGen health gate, error toast on checkout failure, success redirect.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { OneTimeBundleCard } from './one-time-bundle-card';

// Mock next-intl
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}));

// Mock FadeInView to render children directly
vi.mock('@/seed/components/ui/fade-in-view', () => ({
  FadeInView: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock SKU config
vi.mock('@/seed/config/one-time-skus', () => ({
  ONE_TIME_SKUS: {
    STARTER_BUNDLE: {
      id: 'starter_bundle',
      label_vi: 'Gói Khởi Động',
      label_en: 'Starter Bundle',
      priceUsd: 99,
      credits: 10,
      ttlMonths: 12,
      invoiceId: 'test-invoice-id',
    },
  },
}));

describe('OneTimeBundleCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // P0.5: clear sessionStorage so pending purchase banner never renders unexpectedly
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  describe('HeyGen health gate', () => {
    it('shows normal CTA when heygenHealthy=true (default)', () => {
      render(<OneTimeBundleCard heygenHealthy={true} />);
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe('Buy now');
    });

    it('disables button and shows maintenance message when heygenHealthy=false', () => {
      render(<OneTimeBundleCard heygenHealthy={false} />);
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('temporarily unavailable');
    });

    it('does not trigger fetch when heygenHealthy=false and button is clicked', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      render(<OneTimeBundleCard heygenHealthy={false} />);
      fireEvent.click(screen.getByRole('button'));
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('error toast on checkout failure', () => {
    it('shows 401 error message and login link', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'not authenticated' }), { status: 401 })
      );
      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('log in');
        expect(screen.getByRole('link', { name: 'Login' })).toBeTruthy();
      });
    });

    it('shows 400 error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
      );
      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Invalid request');
      });
    });

    it('shows 429 error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'too many requests' }), { status: 429 })
      );
      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Too many requests');
      });
    });

    it('shows 500 error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'internal error' }), { status: 500 })
      );
      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('System error');
      });
    });

    it('shows 503 error message same as 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 503 })
      );
      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('System error');
      });
    });

    it('shows network error message when fetch throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Network error');
      });
    });

    it('clears error on retry click', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'fail' }), { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ url: 'https://checkout.example.com' }), { status: 200 })
        );

      // Mock window.location.href setter
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });

      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => screen.getByRole('alert'));

      // Second click — should clear error and navigate
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull();
      });
    });
  });

  describe('successful checkout', () => {
    it('redirects to checkout URL on success', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://nowpayments.io/test' }), { status: 200 })
      );
      render(<OneTimeBundleCard heygenHealthy={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(window.location.href).toBe('https://nowpayments.io/test');
      });
    });
  });
});
