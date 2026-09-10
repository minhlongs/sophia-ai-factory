/**
 * Unit tests for IncidentCard component.
 * Verifies rendering of all 5 categories and 4 standardized action zones.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentCard } from '../incident-card';
import type { CustomerIncident } from '@/land/production-monitoring/customer-health-summary';

const sampleIncident: CustomerIncident = {
  id: 'inc-test-1',
  category: 'KEY_EXPIRED_OR_INVALID',
  service: 'ElevenLabs Voice',
  whatHappened: 'API key is expired or invalid.',
  whatHappenedVi: 'Khóa API đã hết hạn hoặc không hợp lệ.',
  whatItMeans: 'Sophia cannot authenticate with the voice engine.',
  whatItMeansVi: 'Sophia không thể xác thực với hệ thống giọng đọc.',
  whatYouCanDo: 'Update your key in Settings.',
  whatYouCanDoVi: 'Cập nhật khóa của bạn trong phần Cài đặt.',
  timestamp: new Date().toISOString(),
  retryActionUrl: '/setup',
  supportUrl: '/operations',
};

describe('IncidentCard', () => {
  it('renders all 4 standardized action zones in Vietnamese', () => {
    render(<IncidentCard incident={sampleIncident} locale="vi" />);

    // Zone 1: What happened
    expect(screen.getByTestId('zone-what-happened')).toBeDefined();
    expect(screen.getByText(/Chuyện gì đã xảy ra/i)).toBeDefined();
    expect(screen.getByText('Khóa API đã hết hạn hoặc không hợp lệ.')).toBeDefined();

    // Zone 2: What you can do
    expect(screen.getByTestId('zone-what-you-can-do')).toBeDefined();
    expect(screen.getByText(/Bạn có thể làm gì/i)).toBeDefined();
    expect(screen.getByText('Cập nhật khóa của bạn trong phần Cài đặt.')).toBeDefined();

    // Zone 3: Try again
    const retryBtn = screen.getByTestId('button-try-again');
    expect(retryBtn).toBeDefined();
    expect(screen.getByText('Thử lại')).toBeDefined();

    // Zone 4: Contact support
    const supportBtn = screen.getByTestId('button-contact-support');
    expect(supportBtn).toBeDefined();
    expect(screen.getByText('Liên hệ hỗ trợ')).toBeDefined();
  });

  it('renders all 4 standardized action zones in English', () => {
    render(<IncidentCard incident={sampleIncident} locale="en" />);

    expect(screen.getByText(/What Happened/i)).toBeDefined();
    expect(screen.getByText('API key is expired or invalid.')).toBeDefined();
    expect(screen.getByText(/What You Can Do/i)).toBeDefined();
    expect(screen.getByText('Update your key in Settings.')).toBeDefined();
    expect(screen.getByText('Try Again')).toBeDefined();
    expect(screen.getByText('Contact Support')).toBeDefined();
  });

  it('fires onRetry with incident id when Try Again button is clicked', () => {
    const onRetry = vi.fn();
    render(<IncidentCard incident={sampleIncident} onRetry={onRetry} />);

    const retryBtn = screen.getByTestId('button-try-again');
    fireEvent.click(retryBtn);

    expect(onRetry).toHaveBeenCalledWith('inc-test-1');
  });

  it('fires onContactSupport with incident when Contact Support button is clicked', () => {
    const onContactSupport = vi.fn();
    render(<IncidentCard incident={sampleIncident} onContactSupport={onContactSupport} />);

    const supportBtn = screen.getByTestId('button-contact-support');
    fireEvent.click(supportBtn);

    expect(onContactSupport).toHaveBeenCalledWith(sampleIncident);
  });

  it('disables Try Again button when isRetrying is true', () => {
    render(<IncidentCard incident={sampleIncident} isRetrying={true} />);

    const retryBtn = screen.getByTestId('button-try-again') as HTMLButtonElement;
    expect(retryBtn.disabled).toBe(true);
  });

  it('renders category badge for rate limit, quota, timeout, and validation', () => {
    const categories: Array<CustomerIncident['category']> = [
      'PROVIDER_RATE_LIMIT',
      'QUOTA_EXHAUSTED',
      'NETWORK_TIMEOUT',
      'ASSET_VALIDATION_FAILED',
    ];

    for (const cat of categories) {
      const inc: CustomerIncident = { ...sampleIncident, id: `inc-${cat}`, category: cat };
      const { unmount } = render(<IncidentCard incident={inc} locale="en" />);
      expect(screen.getByTestId(`incident-card-${inc.id}`)).toBeDefined();
      unmount();
    }
  });
});
