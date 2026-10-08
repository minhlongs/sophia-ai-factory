import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireCasLock, releaseCasLock } from '../atomic-cas-lock';
import * as clientModule from '@/seed/db/client';

describe('Seed DB: Atomic CAS Distributed Lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquires lock when database returns 1 change', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const result = await acquireCasLock('lock:test:1', 'worker-a', { now: 1000, ttlMs: 5000 });

    expect(result.acquired).toBe(true);
    expect(result.lockKey).toBe('lock:test:1');
    expect(result.ownerId).toBe('worker-a');
    expect(result.expiresAt).toBe(6000);
    expect(mockPrepare).toHaveBeenCalled();
  });

  it('fails to acquire lock when database returns 0 changes (already held and unexpired)', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const result = await acquireCasLock('lock:test:1', 'worker-b', { now: 1000, ttlMs: 5000 });

    expect(result.acquired).toBe(false);
    expect(result.expiresAt).toBe(0);
  });

  it('handles null D1 database gracefully', async () => {
    vi.spyOn(clientModule, 'getD1').mockResolvedValue(null);

    const result = await acquireCasLock('lock:test:1', 'worker-c');
    expect(result.acquired).toBe(false);

    const released = await releaseCasLock('lock:test:1', 'worker-c');
    expect(released).toBe(false);
  });

  it('releases lock when owner matches and row is deleted', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const released = await releaseCasLock('lock:test:1', 'worker-a');
    expect(released).toBe(true);
    expect(mockBind).toHaveBeenCalledWith('lock:test:1', 'worker-a');
  });

  it('fails release if owner does not match or row was already expired/cleared', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const released = await releaseCasLock('lock:test:1', 'intruder');
    expect(released).toBe(false);
  });
});
