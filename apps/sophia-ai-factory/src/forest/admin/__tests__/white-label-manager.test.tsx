import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { WhiteLabelManager } from '../white-label-manager';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';

// Mock next-intl useTranslations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (params?.hostname) return `${key} ${params.hostname}`;
    return key;
  },
}));

// Mock server actions
vi.mock('@/land/admin/custom-domain-actions', () => ({
  registerCustomDomainAction: vi.fn(),
  verifyCustomDomainStatusAction: vi.fn(),
  deleteCustomDomainAction: vi.fn(),
}));

vi.mock('@/land/admin/white-label-actions', () => ({
  saveWhiteLabelBrandingSettingsAction: vi.fn(),
}));

import {
  registerCustomDomainAction,
  verifyCustomDomainStatusAction,
  deleteCustomDomainAction,
} from '@/land/admin/custom-domain-actions';
import { saveWhiteLabelBrandingSettingsAction } from '@/land/admin/white-label-actions';

describe('WhiteLabelManager component', () => {
  const mockOrgId = 'org_enterprise_1';

  const mockDomains: CustomDomainRecord[] = [
    {
      id: 'domain_1',
      org_id: mockOrgId,
      hostname: 'portal.myagency.com',
      cf_custom_hostname_id: 'cf_123',
      ssl_status: 'active',
      verification_status: 'verified',
      verification_errors: [],
      ownership_verification: {
        type: 'txt',
        name: '_cf-custom-hostname.portal.myagency.com',
        value: 'cf-token-abc-123',
      },
      ssl_verification: null,
      cname_target: 'cname.sophia.agencyos.network',
      cname_verified: true,
      active: true,
      created_at: 1000,
      updated_at: 1000,
    },
  ];

  const mockBranding = {
    agencyName: 'Alpha Video Agency',
    logoUrl: 'https://example.com/logo.png',
    faviconUrl: 'https://example.com/favicon.ico',
    primaryColor: '#6366F1',
    accentColor: '#F59E0B',
    pageTitle: 'Alpha Studio Portal',
    footerText: '© 2026 Alpha Studio',
  };

  const defaultActions = {
    registerCustomDomain: registerCustomDomainAction,
    verifyCustomDomainStatus: verifyCustomDomainStatusAction,
    deleteCustomDomain: deleteCustomDomainAction,
    saveWhiteLabelBrandingSettings: saveWhiteLabelBrandingSettingsAction,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, tabs, and initial registered domain with DNS details', () => {
    render(
      <WhiteLabelManager
        orgId={mockOrgId}
        initialDomains={mockDomains}
        initialBranding={mockBranding}
        actions={defaultActions}
      />,
    );

    // Verify title and navigation tabs
    expect(screen.getByText('title')).toBeDefined();
    expect(screen.getByText('tabs.domains')).toBeDefined();
    expect(screen.getByText('tabs.branding')).toBeDefined();
    expect(screen.getByText('tabs.preview')).toBeDefined();

    // Verify registered domain is rendered
    expect(screen.getAllByText('portal.myagency.com').length).toBeGreaterThan(0);
    expect(screen.getByText('domains.status.active')).toBeDefined();
    expect(screen.getByText('domains.status.verified')).toBeDefined();
    expect(screen.getByText('cname.sophia.agencyos.network')).toBeDefined();
    expect(screen.getByText('cf-token-abc-123')).toBeDefined();
  });

  it('allows registering a new domain and calls registerCustomDomainAction', async () => {
    const newDomain: CustomDomainRecord = {
      id: 'domain_2',
      org_id: mockOrgId,
      hostname: 'video.clienthub.com',
      cf_custom_hostname_id: 'cf_456',
      ssl_status: 'pending_validation',
      verification_status: 'pending',
      verification_errors: [],
      ownership_verification: null,
      ssl_verification: null,
      cname_target: 'cname.sophia.agencyos.network',
      cname_verified: false,
      active: false,
      created_at: 2000,
      updated_at: 2000,
    };

    vi.mocked(registerCustomDomainAction).mockResolvedValue({
      ok: true,
      value: newDomain,
    });

    render(
      <WhiteLabelManager
        orgId={mockOrgId}
        initialDomains={[]}
        initialBranding={mockBranding}
        actions={defaultActions}
      />,
    );

    const input = screen.getByPlaceholderText('domains.inputPlaceholder');
    fireEvent.change(input, { target: { value: 'video.clienthub.com' } });

    const submitBtn = screen.getByRole('button', { name: /domains\.addButton/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerCustomDomainAction).toHaveBeenCalledWith(mockOrgId, 'video.clienthub.com');
      expect(screen.getAllByText('video.clienthub.com').length).toBeGreaterThan(0);
    });
  });

  it('switches to Brand Styling tab and renders inputs with initial values', () => {
    render(
      <WhiteLabelManager
        orgId={mockOrgId}
        initialDomains={mockDomains}
        initialBranding={mockBranding}
        actions={defaultActions}
      />,
    );

    // Switch to branding tab
    const brandingTabBtn = screen.getByText('tabs.branding');
    fireEvent.click(brandingTabBtn);

    expect(screen.getByText('branding.title')).toBeDefined();
    expect(screen.getByDisplayValue('Alpha Video Agency')).toBeDefined();
    expect(screen.getByDisplayValue('https://example.com/logo.png')).toBeDefined();
    expect(screen.getByDisplayValue('https://example.com/favicon.ico')).toBeDefined();
    expect(screen.getByDisplayValue('Alpha Studio Portal')).toBeDefined();
    expect(screen.getByDisplayValue('© 2026 Alpha Studio')).toBeDefined();
  });

  it('calls saveWhiteLabelBrandingSettingsAction when form is submitted', async () => {
    vi.mocked(saveWhiteLabelBrandingSettingsAction).mockResolvedValue({
      ok: true,
      value: {
        orgId: mockOrgId,
        agencyName: 'Updated Agency',
        logoUrl: 'https://example.com/new-logo.png',
        faviconUrl: 'https://example.com/new-favicon.ico',
        primaryColor: '#7C3AED',
        accentColor: '#10B981',
        pageTitle: 'Updated Portal',
        footerText: '© 2026 Updated',
        welcomeMessage: null,
      },
    });

    render(
      <WhiteLabelManager
        orgId={mockOrgId}
        initialDomains={mockDomains}
        initialBranding={mockBranding}
        actions={defaultActions}
      />,
    );

    // Switch to branding tab
    fireEvent.click(screen.getByText('tabs.branding'));

    const agencyInput = screen.getByDisplayValue('Alpha Video Agency');
    fireEvent.change(agencyInput, { target: { value: 'Updated Agency' } });

    const saveBtn = screen.getByRole('button', { name: /branding\.actions\.save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveWhiteLabelBrandingSettingsAction).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({
          agencyName: 'Updated Agency',
        }),
      );
      expect(screen.getByText('branding.actions.saved')).toBeDefined();
    });
  });

  it('switches to Live Preview tab and renders simulated portal', () => {
    render(
      <WhiteLabelManager
        orgId={mockOrgId}
        initialDomains={mockDomains}
        initialBranding={mockBranding}
        actions={defaultActions}
      />,
    );

    // Switch to preview tab
    fireEvent.click(screen.getByText('tabs.preview'));

    expect(screen.getByText('preview.title')).toBeDefined();
    expect(screen.getByText('preview.badge')).toBeDefined();
    expect(screen.getByText('Alpha Studio Portal')).toBeDefined();
    expect(screen.getAllByText('preview.primaryCta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('preview.secondaryCta').length).toBeGreaterThan(0);
  });
});
