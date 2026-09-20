/**
 * Customer Handover & Runbook UI Components Test Suite
 * Tests:
 *   - HandoverAcceptanceClient (Deliverables checklist, certificate viewer, acceptance form)
 *   - HandoverAdminConsoleClient (Stats overview cards, tenant list, trigger verification modal)
 *   - RunbookReaderClient (Runbook list navigation, reading time, code copy, Markdown/HTML export)
 *
 * @vitest
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HandoverAcceptanceClient } from '@/forest/components/handover/handover-acceptance-client';
import { HandoverAdminConsoleClient } from '@/forest/components/handover/handover-admin-console-client';
import { RunbookReaderClient } from '@/forest/components/runbooks/runbook-reader-client';
import type {
  CustomerHandoverRecord,
  HandoverCertificate,
  RunbookContent,
  RunbookMetadata,
} from '@/seed/handover/handover-types';

const translations: Record<string, string> = {
  'milestones.pending': 'Pending Sign-off',
  'milestones.completed': 'Formally Accepted',
  portalTitle: 'Customer Handover Portal',
  portalSubtitle: 'Platform deliverables and acceptance attestation',
  founder30Button: '30-Minute Action Plan',
  readTime: 'min read',
  downloadMaster: 'Download Master Runbook Dossier',
  overview: 'Overview',
  adminTitle: 'Customer Handover Administration',
  adminSubtitle: 'Track tenant sign-offs',
  totalHandovers: 'Total Handovers',
  pendingReview: 'Pending Acceptance',
  acceptedRate: 'Accepted',
  activeTenants: 'Active Tenants',
};

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => translations[key] || key,
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/dashboard/handover',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Customer Handover UI Components (Forest Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRecord: CustomerHandoverRecord = {
    id: 'ho_comp_test_01',
    customer_user_id: 'usr_cust_01',
    agency_name: 'Vanguard Media Group',
    agency_type: 'b2b_saas',
    tier: 'SCALE',
    starter_sops: null,
    magic_link_token: null,
    magic_link_expires_at: null,
    created_by_admin_id: 'usr_admin_01',
    created_at: 1774000000000,
    welcome_email_sent_at: null,
    customer_first_login_at: null,
    customer_first_sop_install_at: null,
    customer_first_run_at: null,
    status: 'active',
    source: 'manual',
    trigger_payment_id: null,
    tenant_id: 'tenant_vanguard',
    signer_name: null,
    signer_email: null,
    signer_role: null,
    certificate_hash: null,
    acceptance_status: 'pending',
    verification_results: null,
    signed_at: null,
    verification_passed_at: null,
    certificate_r2_key: null,
    notes: null,
  };

  const mockCertificate: HandoverCertificate = {
    id: 'cert_comp_test_01',
    handoverId: 'ho_comp_test_01',
    tenantId: 'tenant_vanguard',
    customerName: 'Vanguard Media Group',
    customerEmail: 'ceo@vanguard.io',
    signerName: 'Victoria Sterling',
    signerEmail: 'ceo@vanguard.io',
    signerRole: 'Managing Director',
    tier: 'SCALE',
    deployedSha: 'f1e2d3c4b5a6',
    certificateSha256: '9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef',
    verificationResults: null,
    contentMarkdown: '# Certificate Markdown',
    metadataJson: null,
    createdAt: 1774000100000,
  };

  describe('HandoverAcceptanceClient', () => {
    it('renders customer agency name, tier badge, and pending sign-off status', () => {
      render(
        <HandoverAcceptanceClient
          handover={mockRecord}
          initialCertificate={null}
          locale="en"
        />,
      );

      expect(screen.getAllByText('Vanguard Media Group').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/SCALE TIER/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pending Sign-off').length).toBeGreaterThan(0);
    });

    it('renders verified certificate card when certificate is present', () => {
      const acceptedRecord = {
        ...mockRecord,
        acceptance_status: 'accepted' as const,
        signer_name: 'Victoria Sterling',
      };

      render(
        <HandoverAcceptanceClient
          handover={acceptedRecord}
          initialCertificate={mockCertificate}
          locale="en"
        />,
      );

      expect(screen.getAllByText('Formally Accepted').length).toBeGreaterThan(0);
      expect(screen.getAllByText('cert_comp_test_01').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Victoria Sterling/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef').length).toBeGreaterThan(0);
    });
  });

  describe('HandoverAdminConsoleClient', () => {
    it('renders summary statistics cards and tenant list row', () => {
      const stats = {
        total: 12,
        pending: 4,
        active: 8,
        accepted: 6,
        rejected: 0,
      };

      render(
        <HandoverAdminConsoleClient
          handovers={[mockRecord]}
          initialStats={stats}
        />,
      );

      expect(screen.getByText('12')).toBeTruthy(); // Total Handovers
      expect(screen.getAllByText('Vanguard Media Group').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ho_comp_test/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('SCALE').length).toBeGreaterThan(0);
      expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    });
  });

  describe('RunbookReaderClient', () => {
    const mockMetadataList: RunbookMetadata[] = [
      {
        id: 'sop-01',
        slug: 'quickstart',
        number: '01',
        titleEn: '01. Quickstart & Operator Bootstrap',
        titleVi: '01. Khởi Động Nhanh & Thiết Lập Vận Hành',
        summaryEn: 'Day-1 initial sign-in and basic environment verification.',
        summaryVi: 'Đăng nhập ngày đầu và xác thực môi trường.',
        category: 'Deployment & Setup',
        readTimeMinutes: 10,
        tags: ['quickstart', 'day1'],
      },
      {
        id: 'sop-02',
        slug: 'onboarding',
        number: '02',
        titleEn: '02. Workspace & Brand Setup',
        titleVi: '02. Thiết Lập Studio & Thương Hiệu',
        summaryEn: 'Configuring agency brand identities.',
        summaryVi: 'Cấu hình nhận diện thương hiệu.',
        category: 'Studio Configuration',
        readTimeMinutes: 12,
        tags: ['branding'],
      },
    ];

    const mockActiveContent: RunbookContent = {
      ...mockMetadataList[0],
      author: 'Sophia Platform Engineering',
      lastVerified: '2026-09-20',
      contentEn: '# 01. Quickstart\n\nWelcome to Sophia AI Factory.',
      contentVi: '# 01. Khởi Động Nhanh\n\nChào mừng bạn đến với Sophia AI Factory.',
    };

    it('renders runbook title, category badge, and metadata', () => {
      render(
        <RunbookReaderClient
          runbooks={mockMetadataList}
          activeRunbook={mockActiveContent}
          locale="en"
        />,
      );

      expect(screen.getAllByText('01. Quickstart & Operator Bootstrap').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Deployment & Setup').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/10 min read/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('SOP #01').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2026-09-20').length).toBeGreaterThan(0);
    });

    it('switches between English and Vietnamese content via toggle button', () => {
      render(
        <RunbookReaderClient
          runbooks={mockMetadataList}
          activeRunbook={mockActiveContent}
          locale="en"
        />,
      );

      // Initially English
      expect(screen.getByText('Welcome to Sophia AI Factory.')).toBeTruthy();

      // Click VI toggle button
      const viToggle = screen.getByRole('button', { name: /VI/i });
      fireEvent.click(viToggle);

      expect(screen.getByText('Chào mừng bạn đến với Sophia AI Factory.')).toBeTruthy();
      expect(screen.getAllByText('01. Khởi Động Nhanh & Thiết Lập Vận Hành').length).toBeGreaterThan(0);
    });
  });
});
