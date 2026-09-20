/**
 * Handover Admin API Routes Test Suite
 * Tests:
 *   - GET & POST /api/admin/handover/verify (Auth, query params, body params, diagnostics headers)
 *   - GET /api/admin/handover/export-env (Auth, format=env attachment, format=json, headers)
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET as getVerify, POST as postVerify } from '@/app/api/admin/handover/verify/route';
import { GET as getExportEnv } from '@/app/api/admin/handover/export-env/route';
import * as requireAdminModule from '@/seed/auth/require-admin';
import * as orchestratorModule from '@/forest/handover/verification-orchestrator';
import type { VerificationRunReport } from '@/seed/handover/handover-types';

describe('Handover Admin API Routes (Land Layer)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = 'test_cron_secret_12345';
    process.env.INTERNAL_API_SECRET = 'test_internal_secret_67890';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const mockReport: VerificationRunReport = {
    runId: 'run_api_test_01',
    timestamp: new Date().toISOString(),
    durationMs: 45,
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

  describe('/api/admin/handover/verify', () => {
    describe('Authentication Gate', () => {
      it('returns 401/403 when unauthenticated (no session, no token)', async () => {
        vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue(
          NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        );

        const req = new NextRequest('http://localhost:3000/api/admin/handover/verify');
        const res = await getVerify(req);

        expect(res.status).toBe(401);
      });

      it('authenticates via Bearer CRON_SECRET header', async () => {
        vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

        const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
          headers: {
            Authorization: 'Bearer test_cron_secret_12345',
          },
        });

        const res = await getVerify(req);
        expect(res.status).toBe(200);
        const data = (await res.json()) as VerificationRunReport;
        expect(data.runId).toBe('run_api_test_01');
      });

      it('authenticates via Bearer INTERNAL_API_SECRET header', async () => {
        vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

        const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
          headers: {
            Authorization: 'Bearer test_internal_secret_67890',
          },
        });

        const res = await getVerify(req);
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/admin/handover/verify', () => {
      it('executes verification and returns diagnostic report with custom response headers', async () => {
        vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue({
          userId: 'usr_admin_1',
          isDeployToken: false,
        });

        const execSpy = vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

        const req = new NextRequest(
          'http://localhost:3000/api/admin/handover/verify?handoverId=ho_123&persist=true&timeoutMs=5000',
        );

        const res = await getVerify(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('X-Handover-Verdict')).toBe('PASS');
        expect(res.headers.get('X-Checks-Passed')).toBe('11/11');
        expect(res.headers.get('Cache-Control')).toContain('no-store');

        expect(execSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            handoverId: 'ho_123',
            persist: true,
            timeoutMs: 5000,
          }),
        );
      });
    });

    describe('POST /api/admin/handover/verify', () => {
      it('executes verification parsing JSON body payload', async () => {
        vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue({
          userId: 'usr_admin_1',
          isDeployToken: false,
        });

        const execSpy = vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

        const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handoverId: 'ho_post_999',
            persist: true,
            timeoutMs: 6000,
          }),
        });

        const res = await postVerify(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('X-Handover-Verdict')).toBe('PASS');
        expect(execSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            handoverId: 'ho_post_999',
            persist: true,
            timeoutMs: 6000,
          }),
        );
      });
    });
  });

  describe('GET /api/admin/handover/export-env', () => {
    it('returns 401 when unauthorized', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const req = new NextRequest('http://localhost:3000/api/admin/handover/export-env');
      const res = await getExportEnv(req);

      expect(res.status).toBe(401);
    });

    it('returns downloadable .env.production file attachment by default', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue({
        userId: 'usr_admin_1',
        isDeployToken: false,
      });

      process.env.BETTER_AUTH_SECRET = 'sample_secret_key_32_characters_here';

      const req = new NextRequest('http://localhost:3000/api/admin/handover/export-env?format=env');
      const res = await getExportEnv(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/plain');
      expect(res.headers.get('Content-Disposition')).toContain('attachment; filename=".env.production"');
      expect(res.headers.get('X-Total-Keys')).toBeDefined();

      const text = await res.text();
      expect(text).toContain('SOPHIA AI FACTORY — SANITIZED CUSTOMER PRODUCTION ENVIRONMENT EXPORT');
      expect(text).toContain('BETTER_AUTH_SECRET=[REDACTED_SECRET:len=36]');
    });

    it('returns JSON summary when format=json is specified', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue({
        userId: 'usr_admin_1',
        isDeployToken: false,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/handover/export-env?format=json');
      const res = await getExportEnv(req);

      expect(res.status).toBe(200);
      const json = await res.json() as Record<string, unknown>;
      expect(json.sanitizedContent).toBeDefined();
      expect(Array.isArray(json.missingKeys)).toBe(true);
      expect(typeof json.totalKeys).toBe('number');
    });
  });
});
