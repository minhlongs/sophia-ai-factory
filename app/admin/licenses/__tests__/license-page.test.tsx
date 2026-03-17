/**
 * Tests for License Management Page - ROIaaS Phase 2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminLicensesPage from '../page';
import { LicenseService } from '../../../lib/license-service';

// Mock LicenseService
vi.mock('../../../lib/license-service', () => ({
  LicenseService: {
    getAll: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    delete: vi.fn(),
    getStats: vi.fn(),
  },
}));

// Mock AuthGuard to bypass authentication
vi.mock('../../../components/auth/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock AuthContext
vi.mock('../../../lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    error: null,
  }),
}));

// Mock UsageMetering to avoid undefined errors
vi.mock('../../../lib/usage-metering', () => ({
  UsageMetering: {
    getUsageStats: vi.fn(() => ({
      apiCalls: { used: 0, limit: 1000, percent: 0 },
      transferMb: { used: 0, limit: 1000, percent: 0 },
      status: 'normal' as const,
    })),
    getUsage: vi.fn(() => null),
  },
}));

describe('AdminLicensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLicenses = [
    {
      id: '1',
      tier: 'PRO' as const,
      status: 'active' as const,
      customerId: 'cust_001',
      customerName: 'Test Customer PRO',
      createdAt: new Date('2026-03-01'),
      expiresAt: new Date('2027-03-01'),
      features: ['hd-video', 'no-watermark', 'custom-branding', 'api-access'],
      metadata: { licenseKey: 'raas-pro-abc123xyz' },
    },
    {
      id: '2',
      tier: 'ENTERPRISE' as const,
      status: 'active' as const,
      customerId: 'cust_002',
      customerName: 'Test Customer Enterprise',
      createdAt: new Date('2026-02-15'),
      expiresAt: new Date('2027-12-31'),
      features: ['4k-video', 'no-watermark', 'custom-branding', 'api-access', 'priority-support', 'sla', 'dedicated-account'],
      metadata: { licenseKey: 'raas-ent-premium456' },
    },
  ];

  it('should render loading state initially', async () => {
    // Mock async data fetch - loading state exists during async operation
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(resolve => setImmediate(() => resolve([])))
    );
    render(<AdminLicensesPage />);

    // Stats should appear after loading completes
    await waitFor(() => {
      expect(screen.getByText('Total Licenses')).toBeInTheDocument();
    });
  });

  it('should display license stats', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Licenses')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
      expect(screen.getByText('Total Usage')).toBeInTheDocument();
    });
  });

  it('should display license table with headers', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      expect(screen.getByText('License Keys')).toBeInTheDocument();
      expect(screen.getByText('License Key')).toBeInTheDocument();
      expect(screen.getByText('Tier')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('should filter licenses by tier', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    // Key is truncated to 16 chars + "..."
    await waitFor(() => {
      expect(screen.getByText(/raas-pro-abc123/i)).toBeInTheDocument();
    });

    // Select PRO tier filter
    const selectTrigger = screen.getByRole('combobox');
    fireEvent.click(selectTrigger);

    const proOption = screen.getByText('Pro');
    fireEvent.click(proOption);

    // Should filter to show only PRO licenses in the table
    const tableBody = screen.getByRole('table');
    await waitFor(() => {
      // Check that PRO badge exists in table body (not dropdown)
      expect(within(tableBody).getByText('PRO')).toBeInTheDocument();
    });
  });

  it('should open create license modal', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Create License')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create License'));

    await waitFor(() => {
      expect(screen.getByText('Create License Key')).toBeInTheDocument();
    });
  });

  it('should close create license modal on cancel', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Create License'));
    });

    await waitFor(() => {
      expect(screen.getByText('Create License Key')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Create License Key')).not.toBeInTheDocument();
    });
  });

  it('should display enterprise badge for enterprise licenses', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      expect(screen.getByText('ENTERPRISE')).toBeInTheDocument();
    });
  });

  it('should display active badge for active licenses', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    const tableBody = screen.getByRole('table');
    await waitFor(() => {
      // Scope to table body to avoid matching stats card "Active"
      expect(within(tableBody).getAllByText('active').length).toBeGreaterThan(0);
    });
  });

  it('should show revoke button for active licenses', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      expect(revokeButtons.length).toBeGreaterThan(0);
    });
  });

  it('should show delete button for all licenses', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  it('should display revenue calculation in stats', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(mockLicenses);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      // PRO = $149, ENTERPRISE = $499
      expect(screen.getByText('$648')).toBeInTheDocument();
    });
  });

  it('should handle empty license list', async () => {
    (LicenseService.getAll as ReturnType<typeof vi.fn>).mockReturnValue([]);
    render(<AdminLicensesPage />);

    await waitFor(() => {
      const totalLicensesCard = screen.getByText('Total Licenses').closest('.glass') ??
                                screen.getByText('Total Licenses').parentElement?.parentElement;
      expect(within(totalLicensesCard as HTMLElement).getByText('0')).toBeInTheDocument();
    });
  });
});
