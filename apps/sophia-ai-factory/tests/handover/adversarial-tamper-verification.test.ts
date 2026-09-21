/**
 * Adversarial Tamper Verification & Sign-Off State Machine Stress Suite
 * Specifically challenges:
 * 1. Single-byte tampering across customerName, signerName, signerRole, deployedSha, acceptanceCheckpoints
 * 2. Duplicate sign-off fail-closed with ALREADY_ACCEPTED
 * 3. Unauthorized signer role rejection and RBAC enforcement
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCertificateSha256,
  verifyCertificateSha256,
  canonicalizeCertificatePayload,
} from '@/seed/handover/certificate-hasher';
import type {
  HandoverCertificatePayload,
  CustomerHandoverRecord,
  HandoverCertificate,
} from '@/seed/handover/handover-types';
import type { D1Database } from '@/seed/db/client';

// Server Action imports & mocks
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn().mockResolvedValue(true),
  isUserAdminWithRole: vi.fn().mockResolvedValue({ isAdmin: true, dbRole: 'admin' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { isUserAdmin } from '@/seed/auth/is-user-admin';
import * as authSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import * as handoverService from '@/tree/handover/customer-handover-service';
import * as day1Engine from '@/tree/handover/day1-verification-engine';
import { signHandoverAcceptanceAction } from '@/land/actions/handover-actions';

describe('Adversarial Handover Tamper & State Machine Verification', () => {
  const basePayload: HandoverCertificatePayload = {
    handoverId: 'ho_challenger_001',
    tenantId: 'tenant_omega',
    customerName: 'Sovereign AI Holdings',
    customerEmail: 'founder@sovereignai.com',
    signerName: 'Alexander Vance',
    signerEmail: 'alex@sovereignai.com',
    signerRole: 'CEO',
    tier: 'MASTER',
    deployedSha: '8d5ead1c2345',
    timestamp: 1774050000000,
    acceptanceCheckpoints: [
      'Access to all 10 Customer Runbooks received, reviewed, and archived.',
      'Test video generated and verified through creative mission pipeline.',
      'Sensitive API keys and BYOK credentials verified under exclusive customer control.',
      'Support escalation channels, diagnostic export procedures, and disaster recovery validated.',
    ],
    manifestHash: 'sha256_manifest_deadbeef1234',
  };

  describe('1. Single-Byte and Field-Level Tampering Oracles', () => {
    let canonicalHash: string;

    beforeEach(async () => {
      canonicalHash = await generateCertificateSha256(basePayload);
      expect(canonicalHash).toHaveLength(64);
    });

    it('Oracle: Fails verification when customerName is altered at any single byte position', async () => {
      const orig = basePayload.customerName;
      for (let i = 0; i < orig.length; i++) {
        const charCode = orig.charCodeAt(i);
        const replacement = String.fromCharCode(charCode === 65 ? 66 : 65);
        const tamperedStr = orig.substring(0, i) + replacement + orig.substring(i + 1);

        const tamperedPayload: HandoverCertificatePayload = {
          ...basePayload,
          customerName: tamperedStr,
        };

        const isValid = await verifyCertificateSha256(tamperedPayload, canonicalHash);
        expect(isValid, `customerName byte tampering at index ${i} ('${orig[i]}' -> '${replacement}') must fail`).toBe(false);
      }
    });

    it('Oracle: Fails verification when signerName is altered at any single byte position', async () => {
      const orig = basePayload.signerName;
      for (let i = 0; i < orig.length; i++) {
        const charCode = orig.charCodeAt(i);
        const replacement = String.fromCharCode(charCode === 88 ? 89 : 88);
        const tamperedStr = orig.substring(0, i) + replacement + orig.substring(i + 1);

        const tamperedPayload: HandoverCertificatePayload = {
          ...basePayload,
          signerName: tamperedStr,
        };

        const isValid = await verifyCertificateSha256(tamperedPayload, canonicalHash);
        expect(isValid, `signerName byte tampering at index ${i} must fail`).toBe(false);
      }
    });

    it('Oracle: Fails verification when signerRole is altered at any single byte position or changed', async () => {
      const rolesToTest = [
        'CTO',
        'Founder',
        'CFO',
        'Ceo', // case change
        'CEO!',
        'COO',
        'Tech_Lead',
        'Authorized_Signatory',
        'Developer',
      ];

      for (const alteredRole of rolesToTest) {
        const tamperedPayload: HandoverCertificatePayload = {
          ...basePayload,
          signerRole: alteredRole,
        };

        const isValid = await verifyCertificateSha256(tamperedPayload, canonicalHash);
        expect(isValid, `signerRole tampering to '${alteredRole}' must fail`).toBe(false);
      }
    });

    it('Oracle: Fails verification when deployedSha is altered by even one character', async () => {
      const orig = basePayload.deployedSha;
      for (let i = 0; i < orig.length; i++) {
        const charCode = orig.charCodeAt(i);
        const replacement = charCode === 48 ? '1' : '0';
        const tamperedStr = orig.substring(0, i) + replacement + orig.substring(i + 1);

        const tamperedPayload: HandoverCertificatePayload = {
          ...basePayload,
          deployedSha: tamperedStr,
        };

        const isValid = await verifyCertificateSha256(tamperedPayload, canonicalHash);
        expect(isValid, `deployedSha tampering at index ${i} must fail`).toBe(false);
      }
    });

    it('Oracle: Fails verification when acceptance statements are altered, reordered, added, or removed', async () => {
      // 1. Alter single word in statement 0
      const alteredWord = [
        'Access to all 9 Customer Runbooks received, reviewed, and archived.',
        basePayload.acceptanceCheckpoints[1],
        basePayload.acceptanceCheckpoints[2],
        basePayload.acceptanceCheckpoints[3],
      ];
      expect(await verifyCertificateSha256({ ...basePayload, acceptanceCheckpoints: alteredWord }, canonicalHash)).toBe(false);

      // 2. Remove statement 3
      const removedStatement = basePayload.acceptanceCheckpoints.slice(0, 3);
      expect(await verifyCertificateSha256({ ...basePayload, acceptanceCheckpoints: removedStatement }, canonicalHash)).toBe(false);

      // 3. Add extra statement
      const addedStatement = [...basePayload.acceptanceCheckpoints, 'Extra unverified claim.'];
      expect(await verifyCertificateSha256({ ...basePayload, acceptanceCheckpoints: addedStatement }, canonicalHash)).toBe(false);

      // 4. Alter punctuation (trailing period removed)
      const alteredPunctuation = [
        basePayload.acceptanceCheckpoints[0].slice(0, -1),
        basePayload.acceptanceCheckpoints[1],
        basePayload.acceptanceCheckpoints[2],
        basePayload.acceptanceCheckpoints[3],
      ];
      expect(await verifyCertificateSha256({ ...basePayload, acceptanceCheckpoints: alteredPunctuation }, canonicalHash)).toBe(false);
    });

    it('Oracle: Cryptographic avalanche effect exceeds 40% bit distance for any 1-character difference', async () => {
      const hashA = await generateCertificateSha256(basePayload);
      const hashB = await generateCertificateSha256({
        ...basePayload,
        customerName: basePayload.customerName + 'X',
      });

      // Calculate Hamming distance in hex / bit representation
      let diffBits = 0;
      for (let i = 0; i < 64; i++) {
        const valA = parseInt(hashA[i], 16);
        const valB = parseInt(hashB[i], 16);
        let xor = valA ^ valB;
        while (xor > 0) {
          diffBits += xor & 1;
          xor >>= 1;
        }
      }

      // Total bits in SHA-256 is 256. Avalanche effect expectation: ~128 bits (50%), strictly > 80 bits (>31%)
      const bitFlipPercentage = (diffBits / 256) * 100;
      expect(bitFlipPercentage).toBeGreaterThan(40);
    });
  });

  describe('2. Sign-Off State Machine & Duplicate Sign-Off (ALREADY_ACCEPTED)', () => {
    const mockUser = {
      id: 'usr_owner_001',
      email: 'alex@sovereignai.com',
      name: 'Alexander Vance',
      role: 'user',
    };

    const acceptedRecord: CustomerHandoverRecord = {
      id: 'ho_accepted_123',
      customer_user_id: 'usr_owner_001',
      agency_name: 'Sovereign AI Holdings',
      agency_type: 'b2b_saas',
      tier: 'MASTER',
      starter_sops: '[]',
      magic_link_token: null,
      magic_link_expires_at: null,
      created_by_admin_id: 'usr_admin',
      created_at: 1774000000000,
      welcome_email_sent_at: null,
      customer_first_login_at: null,
      customer_first_sop_install_at: null,
      customer_first_run_at: null,
      status: 'active',
      source: 'manual',
      trigger_payment_id: null,
      tenant_id: 'tenant_omega',
      signer_name: 'Alexander Vance',
      signer_email: 'alex@sovereignai.com',
      signer_role: 'CEO',
      certificate_hash: 'initial_sha256_hash_1234567890abcdef',
      acceptance_status: 'accepted', // ALREADY SIGNED
      verification_results: '{"overallVerdict":"PASS"}',
      signed_at: 1774000100000,
      verification_passed_at: 1774000100000,
      certificate_r2_key: null,
      notes: 'Initial legitimate sign-off',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('Fails closed with code ALREADY_ACCEPTED when re-signing an accepted handover', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue(acceptedRecord);

      const secondAttempt = await signHandoverAcceptanceAction({
        handoverId: 'ho_accepted_123',
        signerName: 'Eve Attacker',
        signerEmail: 'eve@malicious.io',
        signerRole: 'CEO',
        notes: 'Malicious re-sign attempt',
      });

      expect(secondAttempt.ok).toBe(false);
      if (!secondAttempt.ok) {
        expect(secondAttempt.error.code).toBe('ALREADY_ACCEPTED');
        expect(secondAttempt.error.message).toContain('already been accepted and certified');
      }
    });

    it('Preserves original certificate immutability at domain service layer if recordHandoverAcceptance is called directly', async () => {
      let d1HandoverRecord = { ...acceptedRecord };
      const originalCert: HandoverCertificate = {
        id: 'cert_original_123',
        handoverId: 'ho_accepted_123',
        tenantId: 'tenant_omega',
        customerName: 'Sovereign AI Holdings',
        customerEmail: 'alex@sovereignai.com',
        signerName: 'Alexander Vance',
        signerEmail: 'alex@sovereignai.com',
        signerRole: 'CEO',
        tier: 'MASTER',
        deployedSha: '8d5ead1c',
        certificateSha256: acceptedRecord.certificate_hash!,
        verificationResults: '{"overallVerdict":"PASS"}',
        contentMarkdown: '# Original Certificate',
        metadataJson: null,
        createdAt: acceptedRecord.signed_at!,
      };

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: unknown[]) => ({
            first: vi.fn(async () => {
              if (sql.includes('FROM customer_handovers')) return d1HandoverRecord;
              if (sql.includes('FROM handover_certificates')) return originalCert;
              return null;
            }),
            run: vi.fn(async () => {
              if (sql.includes('UPDATE customer_handovers')) {
                d1HandoverRecord.signer_name = String(args[0]);
              }
              return { success: true };
            }),
          })),
        })),
      } as unknown as D1Database;

      const res = await handoverService.recordHandoverAcceptance(mockDb, {
        handoverId: 'ho_accepted_123',
        signerName: 'Attacker Override',
        signerEmail: 'attacker@override.com',
        signerRole: 'CEO',
      });

      // Immutability check: certificate returned must be original, signerName must NOT be overwritten
      expect(res.certificate.signerName).toBe('Alexander Vance');
      expect(res.certificate.certificateSha256).toBe(acceptedRecord.certificate_hash);
      expect(d1HandoverRecord.signer_name).toBe('Alexander Vance');
    });
  });

  describe('3. Signer Role Authorization & Input Validation', () => {
    const mockAdminUser = {
      id: 'usr_admin',
      email: 'admin@sophia.agencyos.network',
      name: 'Admin',
      role: 'admin',
    };

    const pendingRecord: CustomerHandoverRecord = {
      id: 'ho_pending_001',
      customer_user_id: 'usr_pending_cust',
      agency_name: 'Alpha Corp',
      agency_type: 'b2b_saas',
      tier: 'PRO',
      starter_sops: null,
      magic_link_token: null,
      magic_link_expires_at: null,
      created_by_admin_id: 'usr_admin',
      created_at: 1774000000000,
      welcome_email_sent_at: null,
      customer_first_login_at: null,
      customer_first_sop_install_at: null,
      customer_first_run_at: null,
      status: 'active',
      source: 'manual',
      trigger_payment_id: null,
      tenant_id: 'tenant_alpha',
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
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockAdminUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue(pendingRecord);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const unauthorizedRoles = [
      'Hacker',
      'developer',
      'Software_Engineer',
      'Intern',
      'Contractor',
      'Consultant',
      'Guest',
      'Auditor',
      'Security_Specialist',
      'VP_Sales',
      'Product_Manager',
      'Designer',
      'Anonymous',
      'root',
      'admin_impostor',
      'Staff',
      'Assistant',
    ];

    it.each(unauthorizedRoles)('Rejects unauthorized signer role "%s" with INVALID_INPUT', async (unauthRole) => {
      const result = await signHandoverAcceptanceAction({
        handoverId: 'ho_pending_001',
        signerName: 'Unauthorized Person',
        signerEmail: 'person@alpha.com',
        signerRole: unauthRole,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('Invalid signer role');
      }
    });

    const authorizedRoles = [
      'CEO',
      'Founder',
      'Tech_Lead',
      'Authorized_Signatory',
      'CTO',
      'Chief Executive Officer',
      'Chief Executive Officer (CEO)',
      'Chief Technology Officer',
      'Owner',
      'Administrator',
      'Operations_Director',
    ];

    it.each(authorizedRoles)('Permits authorized governance role "%s"', async (authRole) => {
      vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue([]);
      vi.spyOn(handoverService, 'recordHandoverAcceptance').mockResolvedValue({
        certificate: { id: 'cert_test', certificateSha256: 'sha256' } as any,
        record: { ...pendingRecord, acceptance_status: 'accepted' },
      });

      const result = await signHandoverAcceptanceAction({
        handoverId: 'ho_pending_001',
        signerName: 'Legitimate Officer',
        signerEmail: 'officer@alpha.com',
        signerRole: authRole,
      });

      expect(result.ok).toBe(true);
    });
  });
});
