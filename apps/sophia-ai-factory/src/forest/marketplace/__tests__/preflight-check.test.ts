/**
 * Unit Tests for Preflight MCU & Tier Verification
 *
 * @module forest/marketplace/__tests__/preflight-check.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyUserPreflightMcu } from '../preflight-check';
import * as tierModule from '@/seed/db/get-user-tier';
import * as creditsModule from '@/tree/mcu/credits-repo';

describe('Preflight Check Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects preflight when single mission cost exceeds $5.00 ceiling', async () => {
    const res = await verifyUserPreflightMcu('user_123', {
      scenes: 100,
      durationSeconds: 600,
      trackCount: 4,
    });

    expect(res.allowed).toBe(false);
    expect(res.isCeilingExceeded).toBe(true);
    expect(res.error).toBe('COST_SPIKE_CEILING_EXCEEDED');
  });

  it('allows MASTER tier users unlimited allowance bypassing balance limits', async () => {
    vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('MASTER');
    vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({ credits_remaining: 0 } as any);

    const res = await verifyUserPreflightMcu('user_master', {
      scenes: 5,
      durationSeconds: 30,
      trackCount: 3,
    });

    expect(res.allowed).toBe(true);
    expect(res.userTier).toBe('MASTER');
    expect(res.isCeilingExceeded).toBe(false);
    expect(res.error).toBeUndefined();
  });

  it('allows user when current MCU balance is sufficient', async () => {
    vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('PREMIUM');
    // 5 scenes, 30s, 3 tracks = 525 MCU
    vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({ credits_remaining: 1000 } as any);

    const res = await verifyUserPreflightMcu('user_premium', {
      scenes: 6,
      durationSeconds: 30,
      trackCount: 3,
    });

    expect(res.allowed).toBe(true);
    expect(res.currentMcu).toBe(1000);
    expect(res.requiredMcu).toBe(525);
    expect(res.missingMcu).toBeUndefined();
    expect(res.error).toBeUndefined();
  });

  it('blocks user when current MCU balance is insufficient and calculates missingMcu', async () => {
    vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('BASIC');
    // 6 scenes, 30s, 3 tracks = 525 MCU
    vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({ credits_remaining: 200 } as any);

    const res = await verifyUserPreflightMcu('user_basic', {
      scenes: 6,
      durationSeconds: 30,
      trackCount: 3,
    });

    expect(res.allowed).toBe(false);
    expect(res.currentMcu).toBe(200);
    expect(res.requiredMcu).toBe(525);
    expect(res.missingMcu).toBe(325); // 525 - 200
    expect(res.error).toBe('INSUFFICIENT_MCU_BALANCE');
  });
});
