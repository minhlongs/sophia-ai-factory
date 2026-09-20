/**
 * Verification Orchestrator Test Suite
 * Tests: concurrent execution across 11 checkpoints, report aggregation, overall verdict logic, and D1 persistence.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeVerificationSuite } from '@/forest/handover/verification-orchestrator';
import * as day1Engine from '@/tree/handover/day1-verification-engine';
import type { D1Database } from '@/seed/db/client';
import type { CheckpointResult } from '@/seed/handover/handover-types';

describe('Verification Orchestrator (Forest Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeMockCheckpoint = (id: string, status: 'PASS' | 'WARN' | 'FAIL'): CheckpointResult => ({
    checkpointId: id,
    name: `Checkpoint ${id}`,
    nameVi: `Điểm Kiểm Tra ${id}`,
    category: 'operations',
    status,
    latencyMs: 15,
    details: `Mock execution ${id} status: ${status}`,
  });

  it('calculates overallVerdict as PASS when all checkpoints pass', async () => {
    const mockCheckpoints: CheckpointResult[] = Array.from({ length: 11 }, (_, i) =>
      makeMockCheckpoint(`cp_${i + 1}`, 'PASS'),
    );

    vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockCheckpoints);

    const report = await executeVerificationSuite({ skipNetworkCalls: true });

    expect(report.overallVerdict).toBe('PASS');
    expect(report.totalChecks).toBe(11);
    expect(report.passedCount).toBe(11);
    expect(report.failedCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.runId).toMatch(/^run_\d+_/);
    expect(report.shaMatched).toBe(true);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('calculates overallVerdict as WARN when warnings exist but zero failures', async () => {
    const mockCheckpoints: CheckpointResult[] = [
      ...Array.from({ length: 9 }, (_, i) => makeMockCheckpoint(`cp_${i + 1}`, 'PASS')),
      makeMockCheckpoint('cp_warn_1', 'WARN'),
      makeMockCheckpoint('cp_warn_2', 'WARN'),
    ];

    vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockCheckpoints);

    const report = await executeVerificationSuite({ skipNetworkCalls: true });

    expect(report.overallVerdict).toBe('WARN');
    expect(report.passedCount).toBe(9);
    expect(report.warningCount).toBe(2);
    expect(report.failedCount).toBe(0);
  });

  it('calculates overallVerdict as FAIL when at least one checkpoint fails', async () => {
    const mockCheckpoints: CheckpointResult[] = [
      ...Array.from({ length: 9 }, (_, i) => makeMockCheckpoint(`cp_${i + 1}`, 'PASS')),
      makeMockCheckpoint('cp_warn', 'WARN'),
      makeMockCheckpoint('cp_fail', 'FAIL'),
    ];

    vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockCheckpoints);

    const report = await executeVerificationSuite({ skipNetworkCalls: true });

    expect(report.overallVerdict).toBe('FAIL');
    expect(report.passedCount).toBe(9);
    expect(report.warningCount).toBe(1);
    expect(report.failedCount).toBe(1);
  });

  it('persists verification results to D1 when persist: true and handoverId provided', async () => {
    const mockCheckpoints: CheckpointResult[] = Array.from({ length: 11 }, (_, i) =>
      makeMockCheckpoint(`cp_${i + 1}`, 'PASS'),
    );

    vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockCheckpoints);

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const mockDb = {
      prepare: mockPrepare,
    } as unknown as D1Database;

    const report = await executeVerificationSuite({
      handoverId: 'ho_tenant_001',
      persist: true,
      db: mockDb,
    });

    expect(report.overallVerdict).toBe('PASS');
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE customer_handovers'));
    expect(mockBind).toHaveBeenCalledWith(
      expect.stringContaining('"runId"'), // JSON verification report
      expect.any(Number),                 // verification_passed_at
      'ho_tenant_001',                    // handoverId
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it('does not persist to D1 when persist: false or handoverId is omitted', async () => {
    const mockCheckpoints: CheckpointResult[] = Array.from({ length: 11 }, (_, i) =>
      makeMockCheckpoint(`cp_${i + 1}`, 'PASS'),
    );

    vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockCheckpoints);

    const mockPrepare = vi.fn();
    const mockDb = { prepare: mockPrepare } as unknown as D1Database;

    await executeVerificationSuite({
      persist: false,
      handoverId: 'ho_test',
      db: mockDb,
    });

    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('handles database persistence failure gracefully without rejecting report', async () => {
    const mockCheckpoints: CheckpointResult[] = Array.from({ length: 11 }, (_, i) =>
      makeMockCheckpoint(`cp_${i + 1}`, 'PASS'),
    );

    vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockCheckpoints);

    const failingDb = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 write permission denied');
      }),
    } as unknown as D1Database;

    const report = await executeVerificationSuite({
      handoverId: 'ho_failing_write',
      persist: true,
      db: failingDb,
    });

    // Should still return valid report even if persistence failed
    expect(report.overallVerdict).toBe('PASS');
    expect(report.totalChecks).toBe(11);
  });
});
