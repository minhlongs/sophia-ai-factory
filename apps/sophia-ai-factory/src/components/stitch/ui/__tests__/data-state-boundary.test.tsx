/**
 * DataStateBoundary Unit Tests
 *
 * Verifies the 6 canonical OPC data truth states (`demo`, `not_connected`,
 * `loading`, `error`, `verified_empty`, `live`) never conflate an error or
 * disconnected provider with zero-valued live telemetry.
 *
 * @module components/stitch/ui/__tests__/data-state-boundary.test
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataStateBoundary, type DataTruthState } from '../data-state-boundary';

vi.mock('@/navigation', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('DataStateBoundary — 6-State Data Truthfulness Contract', () => {
  const allStates: DataTruthState[] = [
    'demo',
    'not_connected',
    'loading',
    'error',
    'verified_empty',
    'live',
  ];

  it('sets distinct data-status attributes for all 6 canonical states', () => {
    for (const state of allStates) {
      const { unmount } = render(
        <DataStateBoundary state={state} testId={`boundary-${state}`}>
          <span>Live child content</span>
        </DataStateBoundary>,
      );
      expect(screen.getByTestId(`boundary-${state}`).getAttribute('data-status')).toBe(state);
      unmount();
    }
  });

  it('links not_connected state to canonical /setup route by default', () => {
    render(<DataStateBoundary state="not_connected" />);
    const setupLink = screen.getByRole('link', { name: /Open Setup Wizard/i });
    expect(setupLink.getAttribute('href')).toBe('/setup');
  });

  it('fires onRetry callback when error state retry button is clicked', () => {
    const handleRetry = vi.fn();
    render(<DataStateBoundary state="error" onRetry={handleRetry} isVi={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
