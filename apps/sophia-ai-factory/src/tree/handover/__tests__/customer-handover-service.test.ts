import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCustomerHandover,
  listAllCustomerHandovers,
  getHandoverStats,
  recordHandoverAcceptance,
  getHandoverCertificate,
} from '../customer-handover-service';
import type { D1Database } from '@/seed/db/client';
import type { CustomerHandoverRecord } from '@/seed/handover/handover-types';

describe('customer-handover-service (and submodules)', () => {
  let mockDb: D1Database;

  const mockRecord: CustomerHandoverRecord = {
    id: 'hov_123',
    customer_user_id: 'usr_xyz',
    agency_name: 'Alpha Agency',
    agency_type: 'b2b_saas',
    tier: 'ENTERPRISE',
    starter_sops: null,
    magic_link_token: null,
    magic_link_expires_at: null,
    created_by_admin_id: 'adm_1',
    created_at: 1000000,
    welcome_email_sent_at: null,
    customer_first_login_at: null,
    customer_first_sop_install_at: null,
    customer_first_run_at: null,
    status: 'pending',
    source: 'manual',
    trigger_payment_id: null,
    tenant_id: 'ten_abc',
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

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
      dump: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
    } as unknown as D1Database;
  });

  it('retrieves customer handover by identifier', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(mockRecord),
    };
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStmt);

    const result = await getCustomerHandover(mockDb, 'hov_123');
    expect(result).toEqual(mockRecord);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM customer_handovers')
    );
  });

  it('lists handovers with filters', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [mockRecord] }),
    };
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStmt);

    const results = await listAllCustomerHandovers(mockDb, {
      limit: 10,
      offset: 0,
      status: 'pending',
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('hov_123');
  });

  it('computes handover statistics', async () => {
    const mockStmt = {
      first: vi.fn().mockResolvedValue({
        total: 10,
        pending: 3,
        active: 4,
        accepted: 2,
        rejected: 1,
      }),
    };
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStmt);

    const stats = await getHandoverStats(mockDb);
    expect(stats).toEqual({
      total: 10,
      pending: 3,
      active: 4,
      accepted: 2,
      rejected: 1,
    });
  });

  it('returns existing certificate if handover already accepted (idempotency guard)', async () => {
    const acceptedRecord: CustomerHandoverRecord = {
      ...mockRecord,
      acceptance_status: 'accepted',
      signed_at: 1200000,
    };

    const mockStmtGetHandover = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(acceptedRecord),
    };

    const mockCert = {
      id: 'cert_123',
      handoverId: 'hov_123',
      tenantId: 'ten_abc',
      certificateSha256: 'sha256_mock_hash',
    };

    const mockStmtGetCert = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(mockCert),
    };

    (mockDb.prepare as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockStmtGetHandover)
      .mockReturnValueOnce(mockStmtGetCert);

    const result = await recordHandoverAcceptance(mockDb, {
      handoverId: 'hov_123',
      signerName: 'Jane Doe',
      signerEmail: 'jane@example.com',
      signerRole: 'CEO',
    });

    expect(result.certificate).toEqual(mockCert);
    expect(result.record).toEqual(acceptedRecord);
  });

  it('retrieves handover certificate correctly', async () => {
    const mockCert = {
      id: 'cert_123',
      handoverId: 'hov_123',
      tenantId: 'ten_abc',
      customerName: 'Alpha Agency',
    };
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(mockCert),
    };
    (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStmt);

    const cert = await getHandoverCertificate(mockDb, 'hov_123');
    expect(cert).toEqual(mockCert);
  });
});
