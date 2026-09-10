/**
 * Unit tests for QuotaWarningWidget.
 *
 * Verifies:
 * 1. Returns null when percentage < 80% (suppressed / hidden)
 * 2. Returns null when totalMcu <= 0 (invalid quota defense)
 * 3. Renders warning alert when percentage is 80% to 99% (warning threshold)
 * 4. Renders critical alert when percentage >= 100% (limit reached)
 * 5. Supports English (en) and Vietnamese (vi) localization
 *
 * @module components/billing/__tests__/quota-warning-widget.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuotaWarningWidget } from '../quota-warning-widget';

describe('QuotaWarningWidget', () => {
  // 1. Under 80% threshold -> Hidden
  it('returns null when usage is below 80% threshold', () => {
    const { container } = render(
      <QuotaWarningWidget usedMcu={79} totalMcu={100} locale="en" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when totalMcu is zero or negative', () => {
    const { container: zeroContainer } = render(
      <QuotaWarningWidget usedMcu={50} totalMcu={0} locale="en" />
    );
    expect(zeroContainer.firstChild).toBeNull();

    const { container: negativeContainer } = render(
      <QuotaWarningWidget usedMcu={50} totalMcu={-10} locale="en" />
    );
    expect(negativeContainer.firstChild).toBeNull();
  });

  // 2. Warning Threshold (80% <= percent < 100%)
  it('renders warning alert in English when usage is between 80% and 99%', () => {
    render(
      <QuotaWarningWidget usedMcu={85} totalMcu={100} locale="en" />
    );

    const alert = screen.getByTestId('quota-warning-alert');
    expect(alert).toBeDefined();
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
    expect(alert.textContent).toContain(
      '⚠️ Warning: You have used 85% of your monthly MCU quota. Consider upgrading your plan to prevent mission interruptions.'
    );
    expect(alert.textContent).toContain('85%');
  });

  it('renders warning alert in Vietnamese when locale is vi', () => {
    render(
      <QuotaWarningWidget usedMcu={90} totalMcu={100} locale="vi" />
    );

    const alert = screen.getByTestId('quota-warning-alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain(
      '⚠️ Cảnh báo: Bạn đã sử dụng 90% hạn mức MCU hàng tháng. Vui lòng nâng cấp gói để tránh gián đoạn mission.'
    );
    expect(alert.textContent).toContain('90%');
  });

  // 3. Critical Threshold (percent >= 100%)
  it('renders critical alert in English when usage is at or above 100%', () => {
    render(
      <QuotaWarningWidget usedMcu={100} totalMcu={100} locale="en" />
    );

    const alert = screen.getByTestId('quota-critical-alert');
    expect(alert).toBeDefined();
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain(
      '🚨 Limit Reached: 100% of MCU quota used. New missions will be paused until renewal or top-up.'
    );
    expect(alert.textContent).toContain('100%+');
  });

  it('renders critical alert in Vietnamese when locale is vi and usage exceeds 100%', () => {
    render(
      <QuotaWarningWidget usedMcu={120} totalMcu={100} locale="vi" />
    );

    const alert = screen.getByTestId('quota-critical-alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain(
      '🚨 Hết hạn mức: Đã dùng 100% MCU. Các mission mới sẽ tạm dừng cho đến kỳ gia hạn hoặc nạp thêm.'
    );
    expect(alert.textContent).toContain('100%+');
  });
});
