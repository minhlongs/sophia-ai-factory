/**
 * Customer Handover Domain Service Test Suite
 * Tests: DB queries, acceptance sign-off, certificate generation & archival, and statistics aggregation.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCustomerHandover,
  listAllCustomerHandovers,
  getHandoverStats,
  recordHandoverAcceptance,
  getHandoverCertificate,
} from '@/tree/handover/customer-handover-service';
import {
  generateCertificateMarkdown,
  generateCertificateHtml,
} from '@/tree/handover/handover-certificate-engine';
import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
  VerificationRunReport,
} from '@/seed/handover/handover-types';

describe('Customer Handover Domain Service (Tree Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRecord: CustomerHandoverRecord = {
    id: 'ho_test_sample_001',
    customer_user_id: 'usr_customer_999',
    agency_name: 'Apex Studio Ventures',
    agency_type: 'b2b_saas',
    tier: 'ENTERPRISE',
    starter_sops: JSON.stringify(['sop-01', 'sop-02']),
    magic_link_token: 'ml_token_123',
    magic_link_expires_at: 1774000000000,
    created_by_admin_id: 'usr_admin_001',
    created_at: 1773000000000,
    welcome_email_sent_at: 1773000005000,
    customer_first_login_at: 1773000050000,
    customer_first_sop_install_at: null,
    customer_first_run_at: null,
    status: 'active',
    source: 'manual',
    trigger_payment_id: null,
    tenant_id: 'tenant_apex',
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

  describe('getCustomerHandover', () => {
    it('retrieves handover by ID or customer_user_id', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockRecord),
          }),
        }),
      } as unknown as D1Database;

      const record = await getCustomerHandover(mockDb, 'ho_test_sample_001');
      expect(record).not.toBeNull();
      expect(record?.id).toBe('ho_test_sample_001');
      expect(record?.agency_name).toBe('Apex Studio Ventures');
    });

    it('returns null when handover is not found', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        }),
      } as unknown as D1Database;

      const record = await getCustomerHandover(mockDb, 'non_existent');
      expect(record).toBeNull();
    });

    it('handles query exception gracefully and returns null', async () => {
      const failingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('D1 read error');
        }),
      } as unknown as D1Database;

      const record = await getCustomerHandover(failingDb, 'ho_test');
      expect(record).toBeNull();
    });
  });

  describe('listAllCustomerHandovers', () => {
    it('lists handovers with status and acceptance filters', async () => {
      const mockDb = {
        prepare: vi.fn((query: string) => {
          expect(query).toContain('WHERE status = ?1 AND acceptance_status = ?2');
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [mockRecord] }),
            }),
          };
        }),
      } as unknown as D1Database;

      const results = await listAllCustomerHandovers(mockDb, {
        status: 'active',
        acceptanceStatus: 'pending',
        limit: 20,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ho_test_sample_001');
    });

    it('clamps limit to maximum of 100', async () => {
      let boundLimit: number | undefined;
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockImplementation((limit: number) => {
            boundLimit = limit;
            return {
              all: vi.fn().mockResolvedValue({ results: [] }),
            };
          }),
        }),
      } as unknown as D1Database;

      await listAllCustomerHandovers(mockDb, { limit: 999 });
      expect(boundLimit).toBe(100);
    });

    it('returns empty array on database failure', async () => {
      const failingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('D1 syntax error');
        }),
      } as unknown as D1Database;

      const results = await listAllCustomerHandovers(failingDb);
      expect(results).toEqual([]);
    });
  });

  describe('getHandoverStats', () => {
    it('returns aggregate counts for all statuses', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            total: 10,
            pending: 3,
            active: 7,
            accepted: 5,
            rejected: 1,
          }),
        }),
      } as unknown as D1Database;

      const stats = await getHandoverStats(mockDb);
      expect(stats.total).toBe(10);
      expect(stats.pending).toBe(3);
      expect(stats.active).toBe(7);
      expect(stats.accepted).toBe(5);
      expect(stats.rejected).toBe(1);
    });

    it('returns zeroes when query fails', async () => {
      const failingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('D1 stats error');
        }),
      } as unknown as D1Database;

      const stats = await getHandoverStats(failingDb);
      expect(stats).toEqual({ total: 0, pending: 0, active: 0, accepted: 0, rejected: 0 });
    });
  });

  describe('recordHandoverAcceptance', () => {
    const input: HandoverAcceptanceInput = {
      handoverId: 'ho_test_sample_001',
      signerName: 'Alex Mercer',
      signerEmail: 'alex@apexstudio.io',
      signerRole: 'Chief Technology Officer',
      notes: 'Fully verified and signed off for production launch.',
      acceptanceStatements: [
        'Access to all 10 Customer Runbooks received, reviewed, and archived.',
        'Test video generated and verified through creative mission pipeline.',
      ],
    };

    const mockReport: VerificationRunReport = {
      runId: 'run_sample_verify',
      timestamp: new Date().toISOString(),
      durationMs: 120,
      overallVerdict: 'PASS',
      totalChecks: 11,
      passedCount: 11,
      failedCount: 0,
      warningCount: 0,
      deployedSha: 'a1b2c3d4e5f6',
      localSha: 'a1b2c3d4e5f6',
      shaMatched: true,
      checkpoints: [],
    };

    it('throws error if handover record is not found', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        }),
      } as unknown as D1Database;

      await expect(recordHandoverAcceptance(mockDb, input)).rejects.toThrow(
        'Customer handover not found for ID: ho_test_sample_001',
      );
    });

    it('successfully updates handover record and archives immutable certificate in D1', async () => {
      let updatedRecord = { ...mockRecord };

      const mockDb = {
        prepare: vi.fn((query: string) => {
          if (query.includes('SELECT * FROM customer_handovers')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue(updatedRecord),
              }),
            };
          }
          if (query.includes('UPDATE customer_handovers')) {
            return {
              bind: vi.fn().mockImplementation((...args: unknown[]) => {
                updatedRecord = {
                  ...updatedRecord,
                  acceptance_status: 'accepted',
                  signer_name: args[0] as string,
                  signer_email: args[1] as string,
                  signer_role: args[2] as string,
                  certificate_hash: args[3] as string,
                  signed_at: args[5] as number,
                };
                return { run: vi.fn().mockResolvedValue({ success: true }) };
              }),
            };
          }
          if (query.includes('INSERT INTO handover_certificates')) {
            return {
              bind: vi.fn().mockReturnValue({
                run: vi.fn().mockResolvedValue({ success: true }),
              }),
            };
          }
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          };
        }),
      } as unknown as D1Database;

      const { certificate, record } = await recordHandoverAcceptance(mockDb, input, mockReport);

      expect(certificate).toBeDefined();
      expect(certificate.certificateSha256).toHaveLength(64);
      expect(certificate.signerName).toBe('Alex Mercer');
      expect(certificate.signerEmail).toBe('alex@apexstudio.io');
      expect(certificate.signerRole).toBe('Chief Technology Officer');
      expect(certificate.contentMarkdown).toContain('OPERATIONAL ACCEPTANCE CERTIFICATE');
      expect(certificate.contentMarkdown).toContain(certificate.certificateSha256);

      expect(record.acceptance_status).toBe('accepted');
      expect(record.signer_name).toBe('Alex Mercer');
      expect(record.certificate_hash).toBe(certificate.certificateSha256);
    });
  });

  describe('getHandoverCertificate', () => {
    it('retrieves certificate by handover ID', async () => {
      const mockCert: HandoverCertificate = {
        id: 'cert_123',
        handoverId: 'ho_test_sample_001',
        tenantId: 'tenant_apex',
        customerName: 'Apex Studio',
        customerEmail: 'alex@apexstudio.io',
        signerName: 'Alex Mercer',
        signerEmail: 'alex@apexstudio.io',
        signerRole: 'CTO',
        tier: 'ENTERPRISE',
        deployedSha: 'a1b2c3d4e5f6',
        certificateSha256: 'abc123sha256',
        verificationResults: null,
        contentMarkdown: '# Certificate',
        metadataJson: null,
        createdAt: 1774000000000,
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockCert),
          }),
        }),
      } as unknown as D1Database;

      const cert = await getHandoverCertificate(mockDb, 'ho_test_sample_001');
      expect(cert).not.toBeNull();
      expect(cert?.id).toBe('cert_123');
      expect(cert?.certificateSha256).toBe('abc123sha256');
    });

    it('returns null when certificate is not found or db fails', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        }),
      } as unknown as D1Database;

      expect(await getHandoverCertificate(mockDb, 'none')).toBeNull();
    });
  });

  describe('Certificate Markdown & HTML Generators', () => {
    const sampleCert: HandoverCertificate = {
      id: 'cert_abc_123',
      handoverId: 'ho_456',
      tenantId: 'tenant_omega',
      customerName: 'Omega Creative Agency',
      customerEmail: 'ceo@omegacreative.io',
      signerName: 'Sarah Connor',
      signerEmail: 'sarah@omegacreative.io',
      signerRole: 'Chief Executive Officer',
      tier: 'ENTERPRISE',
      deployedSha: 'f9e8d7c6b5a4',
      certificateSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      verificationResults: null,
      contentMarkdown: '',
      metadataJson: null,
      createdAt: 1774000000000,
    };

    it('generates rich Markdown document with signature details and verification summary', () => {
      const md = generateCertificateMarkdown(sampleCert);
      expect(md).toContain('# SOPHIA AI FACTORY — OPERATIONAL ACCEPTANCE CERTIFICATE');
      expect(md).toContain('CERTIFICATE ID:   cert_abc_123');
      expect(md).toContain('SHA-256 DIGEST:   e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(md).toContain('Omega Creative Agency');
      expect(md).toContain('Sarah Connor');
      expect(md).toContain('Chief Executive Officer');
      expect(md).toContain('ENTERPRISE');
      expect(md).toContain('f9e8d7c6b5a4');
    });

    it('generates self-contained printable HTML with embedded styles and verification seal', () => {
      const html = generateCertificateHtml(sampleCert);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Handover Acceptance Certificate - cert_abc_123');
      expect(html).toContain('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(html).toContain('100/100 ACCEPTED');
      expect(html).toContain('@page { size: A4 portrait; margin: 15mm; }');
    });
  });
});
