/**
 * Unit & Integration tests for Admin BYOK Master Key Rotation Page & Client Component.
 *
 * Verifies:
 * 1. MASTER tier access control (RBAC gating via requireMasterTier)
 * 2. Non-MASTER redirection (fail-closed guard)
 * 3. Rendering current key version, history table, and audit trail
 * 4. "Rotate Now" confirmation dialog and POST /api/admin/keys/rotate execution
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { D1Database } from '@/seed/db/client';
import type { User } from '@/seed/db/client';

// ── Hoisted Mocks ──────────────────────────────────────────────────────────

const {
  redirectMock,
  requireMasterTierMock,
  mockToastSuccess,
  mockToastError,
  mockD1,
} = vi.hoisted(() => {
  const redirect = vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  });

  return {
    redirectMock: redirect,
    requireMasterTierMock: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockD1: {
      prepare: vi.fn(),
    } as unknown as D1Database,
  };
});

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/seed/auth/require-master-tier', () => ({
  requireMasterTier: requireMasterTierMock,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(async () => {
    return (key: string) => {
      const messages: Record<string, string> = {
        title: 'BYOK Master Key Rotation',
        subtitle: 'Manage cryptographic master key versions',
        dbUnavailable: 'Database unavailable',
      };
      return messages[key] ?? key;
    };
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { days?: number }) => {
    const translations: Record<string, string> = {
      title: 'BYOK Master Key Rotation',
      subtitle: 'Manage cryptographic master key versions and monitor automated credential re-encryption',
      currentVersion: 'Current Master Key',
      version: 'Version',
      keyType: 'Key Type',
      createdAt: 'Created At',
      age: 'Key Age',
      activeStatus: 'Active',
      inactiveStatus: 'Inactive',
      noActiveKey: 'No active master key found',
      dualDecryptNotice: '7-day backward compatibility for in-flight requests',
      rotateNow: 'Rotate Now',
      rotating: 'Rotating...',
      dialogTitle: 'Confirm Master Key Rotation',
      dialogDescription: 'Rotating the master key generates a new version',
      reasonLabel: 'Rotation Reason (optional)',
      reasonPlaceholder: 'e.g. Scheduled quarterly rotation',
      cancel: 'Cancel',
      confirm: 'Confirm Rotation',
      successToast: 'Master key rotation initiated successfully. Re-encryption job queued.',
      errorToast: 'Failed to initiate key rotation. Please try again.',
      historyTitle: 'Version History',
      historySubtitle: 'Recent master key versions and lifecycle metadata',
      emptyHistory: 'No key version history found',
      auditTitle: 'Rotation Audit Trail',
      auditSubtitle: 'Immutable log of key rotation events and actor actions',
      emptyAudit: 'No rotation audit logs found',
      'columns.version': 'Version',
      'columns.keyType': 'Type',
      'columns.status': 'Status',
      'columns.createdAt': 'Created',
      'columns.rotatedAt': 'Rotated',
      'columns.rotatedBy': 'Rotated By',
      'columns.action': 'Action',
      'columns.timestamp': 'Timestamp',
      'columns.actor': 'Actor',
      'columns.details': 'Details',
    };
    if (key === 'daysAgo' && values?.days !== undefined) {
      return `${values.days} days`;
    }
    return translations[key] || key;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => Promise.resolve(mockD1)),
}));

import AdminByokRotationPage from '../page';
import { ByokRotationClient } from '../byok-rotation-client';
import { getD1 } from '@/seed/db/client';

const SAMPLE_MASTER_USER: User = {
  id: 'usr_master_001',
  email: 'operator@agencyos.network',
  role: 'admin',
} as unknown as User;

describe('Admin BYOK Rotation Page (Server Component)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MASTER tier access -> renders page with D1 data', async () => {
    requireMasterTierMock.mockResolvedValueOnce(SAMPLE_MASTER_USER);

    vi.mocked(mockD1.prepare).mockImplementation(((sql: string) => {
      if (sql.includes('WHERE is_active = 1')) {
        return {
          first: vi.fn().mockResolvedValue({
            id: 'kv_1',
            key_type: 'master',
            version: 2,
            created_at: '2026-09-01T00:00:00Z',
            rotated_at: null,
            rotated_by: 'usr_master_001',
            is_active: 1,
          }),
        };
      }
      if (sql.includes('FROM key_versions')) {
        return {
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'kv_1',
                key_type: 'master',
                version: 2,
                created_at: '2026-09-01T00:00:00Z',
                rotated_at: null,
                rotated_by: 'usr_master_001',
                is_active: 1,
              },
            ],
          }),
        };
      }
      if (sql.includes('FROM raas_audit_logs')) {
        return {
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'log_1',
                action: 'key_rotation.requested',
                user_id: 'usr_master_001',
                details: '{"keyVersion":2}',
                created_at: 1788220800,
              },
            ],
          }),
        };
      }
      return {
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
    }) as unknown as typeof mockD1.prepare);

    const jsx = await AdminByokRotationPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(jsx).toBeDefined();
    expect(requireMasterTierMock).toHaveBeenCalledWith({
      denyRedirect: '/dashboard?error=admin_required',
    });
  });

  it('Non-MASTER tier -> redirects to /dashboard?error=admin_required', async () => {
    requireMasterTierMock.mockImplementationOnce(() => {
      redirectMock('/dashboard?error=admin_required');
    });

    await expect(
      AdminByokRotationPage({ params: Promise.resolve({ locale: 'en' }) }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/dashboard\?error=admin_required/);

    expect(redirectMock).toHaveBeenCalledWith('/dashboard?error=admin_required');
  });

  it('Database unavailable -> renders fallback notice', async () => {
    requireMasterTierMock.mockResolvedValueOnce(SAMPLE_MASTER_USER);
    vi.mocked(getD1).mockResolvedValueOnce(null);

    const jsx = await AdminByokRotationPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    render(jsx as React.ReactElement);
    expect(screen.getByText('Database unavailable')).toBeDefined();
  });
});

describe('ByokRotationClient (Client Component)', () => {
  const sampleCurrentVersion = {
    id: 'kv_current',
    key_type: 'master',
    version: 3,
    created_at: '2026-09-10T12:00:00Z',
    rotated_at: null,
    rotated_by: 'usr_admin',
    is_active: 1,
  };

  const sampleHistory = [
    sampleCurrentVersion,
    {
      id: 'kv_old_2',
      key_type: 'master',
      version: 2,
      created_at: '2026-06-01T10:00:00Z',
      rotated_at: '2026-09-10T12:00:00Z',
      rotated_by: 'usr_admin',
      is_active: 0,
    },
  ];

  const sampleAuditLogs = [
    {
      id: 'aud_1',
      action: 'key_rotation.requested',
      user_id: 'usr_admin',
      details: '{"keyVersion":3,"reason":"Scheduled quarterly"}',
      created_at: 1788220800,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders current master key version card and dual-decrypt notice', () => {
    render(
      <ByokRotationClient
        locale="en"
        currentVersion={sampleCurrentVersion}
        versionHistory={sampleHistory}
        auditLogs={sampleAuditLogs}
      />,
    );

    expect(screen.getByText('BYOK Master Key Rotation')).toBeDefined();
    expect(screen.getByText('Current Master Key')).toBeDefined();
    // v3 appears in both the current version card and the history table
    expect(screen.getAllByText('v3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('7-day backward compatibility for in-flight requests')).toBeDefined();
  });

  it('renders fallback card when currentVersion is null', () => {
    render(
      <ByokRotationClient
        locale="en"
        currentVersion={null}
        versionHistory={[]}
        auditLogs={[]}
      />,
    );

    expect(screen.getByText('No active master key found')).toBeDefined();
    expect(screen.getByText('No key version history found')).toBeDefined();
    expect(screen.getByText('No rotation audit logs found')).toBeDefined();
  });

  it('renders version history table and audit logs', () => {
    render(
      <ByokRotationClient
        locale="en"
        currentVersion={sampleCurrentVersion}
        versionHistory={sampleHistory}
        auditLogs={sampleAuditLogs}
      />,
    );

    expect(screen.getAllByText('v3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText('key_rotation.requested')).toBeDefined();
  });

  it('"Rotate Now" button opens dialog and triggers POST /api/admin/keys/rotate on confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          keyVersion: 4,
          oldVersion: 3,
          message: 'Key rotation queued. Re-encryption will run asynchronously.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <ByokRotationClient
        locale="en"
        currentVersion={sampleCurrentVersion}
        versionHistory={sampleHistory}
        auditLogs={sampleAuditLogs}
      />,
    );

    // Click "Rotate Now" button
    const rotateButton = screen.getByRole('button', { name: /rotate now/i });
    fireEvent.click(rotateButton);

    // Dialog should be open
    expect(screen.getByText('Confirm Master Key Rotation')).toBeDefined();

    // Fill optional reason
    const reasonInput = screen.getByPlaceholderText(/e\.g\. Scheduled quarterly rotation/i);
    fireEvent.change(reasonInput, { target: { value: 'Annual compliance check' } });

    // Click "Confirm Rotation"
    const confirmButton = screen.getByRole('button', { name: /confirm rotation/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/keys/rotate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Annual compliance check' }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Key rotation queued. Re-encryption will run asynchronously.',
      );
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  it('shows error toast when POST /api/admin/keys/rotate fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Failed to request key rotation' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <ByokRotationClient
        locale="en"
        currentVersion={sampleCurrentVersion}
        versionHistory={sampleHistory}
        auditLogs={sampleAuditLogs}
      />,
    );

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /rotate now/i }));

    // Confirm rotation
    fireEvent.click(screen.getByRole('button', { name: /confirm rotation/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to request key rotation');
    });
  });
});
