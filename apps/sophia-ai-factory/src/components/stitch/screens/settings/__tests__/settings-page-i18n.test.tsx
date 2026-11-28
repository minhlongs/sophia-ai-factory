import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../../../../../messages/vi.json';
import enMessages from '../../../../../../messages/en.json';
import SettingsPage from '../settings-page';

vi.mock('@/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/settings/settings-profile-section', () => ({
  SettingsProfileSection: () => <div data-testid="mock-profile-section" />,
}));
vi.mock('@/components/settings/settings-security-section', () => ({
  SettingsSecuritySection: () => <div data-testid="mock-security-section" />,
}));
vi.mock('@/components/settings/api-keys-manager', () => ({
  ApiKeysManager: () => <div data-testid="mock-api-keys" />,
}));
vi.mock('@/components/settings/storage-settings-form', () => ({
  StorageSettingsForm: () => <div data-testid="mock-storage" />,
}));
vi.mock('@/components/settings/account-ownership-view', () => ({
  AccountOwnershipView: () => <div data-testid="mock-team" />,
}));
vi.mock('@/components/settings/settings-appearance-theme', () => ({
  SettingsAppearanceThemeSection: () => <div data-testid="mock-theme" />,
}));
vi.mock('@/components/settings/settings-locale-danger', () => ({
  SettingsLocaleDangerSection: () => <div data-testid="mock-locale-danger" />,
}));
vi.mock('@/components/settings/settings-jurisdiction-picker', () => ({
  SettingsJurisdictionPicker: () => <div data-testid="mock-jurisdiction" />,
}));
vi.mock('@/components/settings/open-core-portability-panel', () => ({
  OpenCorePortabilityPanel: () => <div data-testid="mock-open-core" />,
}));

describe('SettingsPage VI/EN localization (Wave A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Vietnamese H1, subtitle, tabs, and usage panel with zero hardcoded English shell text', () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <SettingsPage userName="Founder" userEmail="founder@example.test" />
      </NextIntlClientProvider>,
    );

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Cài đặt tài khoản và không gian làm việc');
    expect(screen.queryByText('Account & Workspace Settings')).toBeNull();
    expect(screen.queryByText('View Billing Metering')).toBeNull();
    expect(screen.getByText('Xem đo lường cước phí')).toBeTruthy();
    expect(screen.getByText('Hồ sơ')).toBeTruthy();
    expect(screen.getByText('Khóa API (BYOK)')).toBeTruthy();
    expect(screen.getByText('Đo lường trực tiếp')).toBeTruthy();

    fireEvent.click(screen.getByText('Đo lường trực tiếp'));
    expect(screen.getByText('Sổ cái tiêu thụ minh bạch')).toBeTruthy();
    expect(screen.getByText('Mở cổng đo lường thời gian thực')).toBeTruthy();
    expect(screen.queryByText('Transparent Consumption Ledger')).toBeNull();
  });

  it('renders English H1, tabs, and usage panel when locale is en', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SettingsPage userName="Founder" userEmail="founder@example.test" initialTab="usage" />
      </NextIntlClientProvider>,
    );

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Account & Workspace Settings');
    expect(screen.getByText('View Billing Metering')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('API Keys (BYOK)')).toBeTruthy();
    expect(screen.getByText('Transparent Consumption Ledger')).toBeTruthy();
    expect(screen.getByText('Open Real-Time Metering Portal')).toBeTruthy();
  });
});
