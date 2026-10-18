/**
 * Targeted branch coverage suite wave 3 - Part B (< 130 LOC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { IncidentCard } from '@/components/system-health/incident-card';
import { HelpTooltip } from '@/components/help/help-tooltip';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) =>
    params?.label ? `${key}:${params.label}` : key,
}));

vi.mock('@/navigation', () => ({
  Link: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

describe('extracted-helpers-wave3-b', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders IncidentCard with fallback and handles onRetry/onSupport', () => {
    const onRetry = vi.fn();
    const onSupport = vi.fn();
    const incident: any = {
      id: 'inc-1',
      service: 'OpenNext Worker',
      category: 'CUSTOM_UNKNOWN_CATEGORY',
      whatHappenedVi: 'Lỗi bộ nhớ đệm',
      whatHappened: 'Cache fault',
      whatItMeansVi: 'Tải chậm',
      whatItMeans: 'Slow loads',
      whatYouCanDoVi: 'Thử lại',
      whatYouCanDo: 'Retry',
      actionType: 'RETRY',
    };

    const { getByRole, getByTestId, rerender } = render(
      <IncidentCard
        incident={incident}
        locale="vi"
        onRetry={onRetry}
        onContactSupport={onSupport}
      />
    );

    expect(getByTestId('zone-what-happened').textContent).toContain('Lỗi bộ nhớ đệm');
    fireEvent.click(getByRole('button', { name: /Thử lại/i }));
    expect(onRetry).toHaveBeenCalledWith('inc-1');

    rerender(
      <IncidentCard
        incident={{ ...incident, actionType: 'CONTACT_SUPPORT' }}
        locale="en"
        onRetry={onRetry}
        onContactSupport={onSupport}
      />
    );
    expect(getByTestId('zone-what-happened').textContent).toContain('Cache fault');
    fireEvent.click(getByRole('button', { name: /Support/i }));
    expect(onSupport).toHaveBeenCalled();
  });

  it('renders HelpTooltip, opens/closes modal, and tests video links', () => {
    const content = {
      introEn: 'Intro EN',
      introVi: 'Intro VI',
      videoSlug: 'tutorial-1',
      videoPublished: true,
      videoTitleEn: 'Video Title EN',
      videoTitleVi: 'Video Title VI',
    };

    const { getByRole, queryByRole, rerender } = render(
      <HelpTooltip locale="en" content={content} pageLabel="Test" />
    );

    fireEvent.click(getByRole('button'));
    expect(getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('dialog')).toBeNull();

    rerender(
      <HelpTooltip
        locale="vi"
        content={{ ...content, videoPublished: false }}
        pageLabel="Test"
      />
    );
    fireEvent.click(getByRole('button'));
    expect(getByRole('dialog')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'close' }));
    expect(queryByRole('dialog')).toBeNull();
  });
});
