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

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

describe('SettingsPage VI/EN localization & catalog compatibility (Wave A.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves all legacy stitch.settingsPage keys alongside Wave A keys with exact VI/EN parity', () => {
    const viNs = viMessages.stitch.settingsPage as Record<string, unknown>;
    const enNs = enMessages.stitch.settingsPage as Record<string, unknown>;

    const viKeys = flattenKeys(viNs);
    const enKeys = flattenKeys(enNs);
    expect(viKeys).toEqual(enKeys);

    // Legacy base keys must remain present (backward compatibility)
    for (const legacyKey of [
      'pageTitle',
      'topNav.upgradePlan',
      'nav.account',
      'profile.title',
      'apiKeys.title',
      'locale.title',
      'dangerZone.title',
    ]) {
      expect(viKeys).toContain(legacyKey);
      expect(enKeys).toContain(legacyKey);
    }
  });

  it('renders all 8 Vietnamese tabs, H1, billing CTA, and usage panel with zero hardcoded English shell text', () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <SettingsPage userName="Founder" userEmail="founder@example.test" />
      </NextIntlClientProvider>,
    );

    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('Cài đặt tài khoản và không gian làm việc');
    expect(screen.queryByText('Account & Workspace Settings')).toBeNull();
    expect(screen.queryByText('View Billing Metering')).toBeNull();
    expect(screen.getByText('Xem đo lường cước phí')).toBeTruthy();

    for (const tabLabel of [
      'Hồ sơ',
      'Bảo mật (Passkeys & 2FA)',
      'Khóa API (BYOK)',
      'Lưu trữ (R2 BYOS)',
      'Đo lường trực tiếp',
      'Đội ngũ & Quyền sở hữu',
      'Open-Core & Di chuyển dữ liệu',
      'Tùy chọn',
    ]) {
      expect(screen.getByText(tabLabel)).toBeTruthy();
    }

    fireEvent.click(screen.getByText('Đo lường trực tiếp'));
    expect(screen.getByText('Sổ cái tiêu thụ minh bạch')).toBeTruthy();
    expect(screen.getByText('Mở cổng đo lường thời gian thực')).toBeTruthy();
    expect(screen.queryByText('Transparent Consumption Ledger')).toBeNull();
  });

  it('renders all 8 English tabs, H1, and usage panel when locale is en', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SettingsPage userName="Founder" userEmail="founder@example.test" initialTab="usage" />
      </NextIntlClientProvider>,
    );

    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('Account & Workspace Settings');
    expect(screen.getByText('View Billing Metering')).toBeTruthy();

    for (const tabLabel of [
      'Profile',
      'Security (Passkeys & 2FA)',
      'API Keys (BYOK)',
      'Storage (R2 BYOS)',
      'Live Metering',
      'Team & Ownership',
      'Open-Core & Portability',
      'Preferences',
    ]) {
      expect(screen.getByText(tabLabel)).toBeTruthy();
    }

    expect(screen.getByText('Transparent Consumption Ledger')).toBeTruthy();
    expect(screen.getByText('Open Real-Time Metering Portal')).toBeTruthy();
  });
});
