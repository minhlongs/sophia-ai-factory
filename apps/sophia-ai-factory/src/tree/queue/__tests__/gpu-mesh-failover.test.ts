/**
 * GPU Mesh Failover & Circuit Breaker Test Suite
 *
 * Validates:
 * - Multi-provider fallback mesh (fal.ai -> RunPod -> Replicate -> Mekong GPU)
 * - Circuit breaker state machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 * - Cooldown timeouts and probing behavior
 * - Automatic failover upon provider errors or timeouts
 * - Skipping providers whose circuit is OPEN
 * - Handling terminal exhaustion when all providers fail
 *
 * Layer: tree/queue/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreakerRegistry,
  executeWithMeshFailover,
  AllProvidersFailedError,
} from '../gpu-mesh-failover';
import type { VideoRenderJob } from '@/seed/types/video-render-queue';

describe('GPU Mesh Failover & Circuit Breaker', () => {
  let circuitBreaker: CircuitBreakerRegistry;
  let mockJob: VideoRenderJob;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerRegistry({
      failureThreshold: 2,
      successThreshold: 2,
      cooldownPeriodMs: 5000,
      executionTimeoutMs: 1000,
    });

    mockJob = {
      id: 'vrj_test_123',
      orgId: 'org_test_1',
      lane: 'priority',
      priorityScore: 100,
      status: 'leased',
      tier: 'enterprise',
      payload: { prompt: 'Render 3D scene' },
      retryCount: 0,
      maxRetries: 3,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };
  });

  describe('CircuitBreakerRegistry State Machine', () => {
    it('initializes all providers in CLOSED healthy state', () => {
      const status = circuitBreaker.getProviderStatus('fal');
      expect(status.circuitState).toBe('CLOSED');
      expect(status.healthy).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
      expect(circuitBreaker.canAttempt('fal')).toBe(true);
    });

    it('trips circuit from CLOSED to OPEN after failureThreshold is reached', () => {
      const now = 100000;
      circuitBreaker.recordFailure('fal', new Error('500 Internal Server Error'), now);
      expect(circuitBreaker.getProviderStatus('fal', now).circuitState).toBe('CLOSED');
      expect(circuitBreaker.canAttempt('fal', now)).toBe(true);

      // Second failure hits threshold (2) -> trips to OPEN
      circuitBreaker.recordFailure('fal', new Error('503 Service Unavailable'), now);
      const status = circuitBreaker.getProviderStatus('fal', now);
      expect(status.circuitState).toBe('OPEN');
      expect(status.healthy).toBe(false);
      expect(circuitBreaker.canAttempt('fal', now)).toBe(false);
      expect(status.cooldownUntil).toBe(now + 5000);
    });

    it('transitions from OPEN to HALF_OPEN after cooldown period expires', () => {
      const now = 100000;
      circuitBreaker.recordFailure('runpod', new Error('Err 1'), now);
      circuitBreaker.recordFailure('runpod', new Error('Err 2'), now);
      expect(circuitBreaker.canAttempt('runpod', now)).toBe(false);

      // Before cooldown
      expect(circuitBreaker.canAttempt('runpod', now + 4000)).toBe(false);

      // At or after cooldown (5000ms later) -> transitions to HALF_OPEN and allows probe
      expect(circuitBreaker.canAttempt('runpod', now + 5000)).toBe(true);
      expect(circuitBreaker.getProviderStatus('runpod', now + 5000).circuitState).toBe('HALF_OPEN');
    });

    it('resets circuit to CLOSED when HALF_OPEN achieves successThreshold', () => {
      const now = 100000;
      circuitBreaker.recordFailure('replicate', new Error('1'), now);
      circuitBreaker.recordFailure('replicate', new Error('2'), now);

      const probeTime = now + 5000;
      circuitBreaker.canAttempt('replicate', probeTime); // enters HALF_OPEN

      // First success in HALF_OPEN
      circuitBreaker.recordSuccess('replicate', 250, probeTime + 100);
      expect(circuitBreaker.getProviderStatus('replicate', probeTime + 100).circuitState).toBe('HALF_OPEN');

      // Second success in HALF_OPEN hits successThreshold (2) -> resets to CLOSED!
      circuitBreaker.recordSuccess('replicate', 240, probeTime + 200);
      const status = circuitBreaker.getProviderStatus('replicate', probeTime + 200);
      expect(status.circuitState).toBe('CLOSED');
      expect(status.healthy).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
    });

    it('immediately trips back to OPEN if a probe fails during HALF_OPEN', () => {
      const now = 100000;
      circuitBreaker.recordFailure('mekong', new Error('1'), now);
      circuitBreaker.recordFailure('mekong', new Error('2'), now);

      const probeTime = now + 5000;
      circuitBreaker.canAttempt('mekong', probeTime); // enters HALF_OPEN

      // Probe fails!
      circuitBreaker.recordFailure('mekong', new Error('GPU probe timeout'), probeTime + 100);
      const status = circuitBreaker.getProviderStatus('mekong', probeTime + 100);
      expect(status.circuitState).toBe('OPEN');
      expect(circuitBreaker.canAttempt('mekong', probeTime + 100)).toBe(false);
      expect(status.cooldownUntil).toBe(probeTime + 100 + 5000);
    });
  });

  describe('executeWithMeshFailover Execution Loop', () => {
    it('executes successfully with primary provider when healthy', async () => {
      const executors = {
        fal: vi.fn().mockResolvedValue({ videoUrl: 'https://fal.media/v1.mp4' }),
        runpod: vi.fn(),
      };

      const result = await executeWithMeshFailover(mockJob, executors, ['fal', 'runpod'], {
        circuitBreaker,
      });

      expect(result.result).toEqual({ videoUrl: 'https://fal.media/v1.mp4' });
      expect(result.provider).toBe('fal');
      expect(result.attempts.length).toBe(1);
      expect(result.attempts[0].status).toBe('success');
      expect(executors.fal).toHaveBeenCalledTimes(1);
      expect(executors.runpod).not.toHaveBeenCalled();
    });

    it('fails over to secondary provider when primary throws an error', async () => {
      const executors = {
        fal: vi.fn().mockRejectedValue(new Error('500 Internal Server Error: fal.ai cluster busy')),
        runpod: vi.fn().mockResolvedValue({ videoUrl: 'https://runpod.io/storage/rendered.mp4' }),
        replicate: vi.fn(),
      };

      const result = await executeWithMeshFailover(mockJob, executors, ['fal', 'runpod', 'replicate'], {
        circuitBreaker,
      });

      expect(result.result).toEqual({ videoUrl: 'https://runpod.io/storage/rendered.mp4' });
      expect(result.provider).toBe('runpod');
      expect(result.attempts.length).toBe(2);
      expect(result.attempts[0]).toMatchObject({
        provider: 'fal',
        status: 'failed',
        error: '500 Internal Server Error: fal.ai cluster busy',
      });
      expect(result.attempts[1]).toMatchObject({
        provider: 'runpod',
        status: 'success',
      });
      expect(executors.fal).toHaveBeenCalledTimes(1);
      expect(executors.runpod).toHaveBeenCalledTimes(1);
      expect(executors.replicate).not.toHaveBeenCalled();
    });

    it('skips providers whose circuit breaker is OPEN without executing them', async () => {
      // Manually trip fal's circuit
      circuitBreaker.recordFailure('fal', new Error('Err 1'));
      circuitBreaker.recordFailure('fal', new Error('Err 2'));
      expect(circuitBreaker.canAttempt('fal')).toBe(false);

      const executors = {
        fal: vi.fn().mockResolvedValue('should_not_be_called'),
        runpod: vi.fn().mockResolvedValue({ output: 'runpod_success' }),
      };

      const result = await executeWithMeshFailover(mockJob, executors, ['fal', 'runpod'], {
        circuitBreaker,
      });

      expect(result.provider).toBe('runpod');
      expect(result.result).toEqual({ output: 'runpod_success' });
      expect(executors.fal).not.toHaveBeenCalled();
      expect(result.attempts[0]).toMatchObject({
        provider: 'fal',
        status: 'skipped_circuit_open',
      });
    });

    it('throws AllProvidersFailedError when all providers in the chain fail', async () => {
      const executors = {
        fal: vi.fn().mockRejectedValue(new Error('fal down')),
        runpod: vi.fn().mockRejectedValue(new Error('runpod out of memory')),
        replicate: vi.fn().mockRejectedValue(new Error('replicate rate limited')),
        mekong: vi.fn().mockRejectedValue(new Error('mekong node unreachable')),
      };

      await expect(
        executeWithMeshFailover(mockJob, executors, ['fal', 'runpod', 'replicate', 'mekong'], {
          circuitBreaker,
        }),
      ).rejects.toThrow(AllProvidersFailedError);

      try {
        await executeWithMeshFailover(mockJob, executors, ['fal', 'runpod', 'replicate', 'mekong'], {
          circuitBreaker,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(AllProvidersFailedError);
        const err = e as AllProvidersFailedError;
        expect(err.jobId).toBe(mockJob.id);
        expect(err.attempts.length).toBe(4);
        expect(err.attempts.every((a) => a.status === 'failed')).toBe(true);
      }
    });

    it('times out and fails over if a provider hangs', async () => {
      const executors = {
        fal: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
        runpod: vi.fn().mockResolvedValue({ fast: true }),
      };

      // Set timeout to 50ms so fal times out
      const result = await executeWithMeshFailover(mockJob, executors, ['fal', 'runpod'], {
        circuitBreaker,
        timeoutMs: 50,
      });

      expect(result.provider).toBe('runpod');
      expect(result.attempts[0].status).toBe('failed');
      expect(result.attempts[0].error).toContain('timed out');
    });
  });
});
