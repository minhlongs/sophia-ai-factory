/**
 * Video completion telemetry tests.
 *
 * Telemetry must never break video completion, and an unknown duration must read
 * as "excluded from percentiles" rather than "instant". Both are pinned here.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/observability/telemetry/wae-client', () => ({
  writeVideoJobToWAE: vi.fn(),
}))
vi.mock('@/seed/observability/telemetry/metrics', () => ({
  getWAEBindingForMetrics: vi.fn().mockReturnValue({}),
}))

import { writeVideoJobToWAE } from '@/seed/observability/telemetry/wae-client'
import { recordVideoCompletionMetric } from './video-metric-emitter'

describe('recordVideoCompletionMetric', () => {
  beforeEach(() => vi.clearAllMocks())

  it('emits the elapsed seconds between accept and completion', () => {
    recordVideoCompletionMetric('job-1', 'tenant-1', 1000, 1300)

    expect(writeVideoJobToWAE).toHaveBeenCalledWith({}, expect.objectContaining({
      outcome: 'completed', jobId: 'job-1', tenantId: 'tenant-1', durationSeconds: 300,
    }))
  })

  it('flags a job that exceeded the render-stage budget', () => {
    recordVideoCompletionMetric('job-2', 'tenant-1', 1000, 1000 + 601)
    const point = vi.mocked(writeVideoJobToWAE).mock.calls[0][1]
    expect(point.slow).toBe(true)
  })

  it('does not flag a job at or under the budget', () => {
    recordVideoCompletionMetric('job-3', 'tenant-1', 1000, 1000 + 600)
    expect(vi.mocked(writeVideoJobToWAE).mock.calls[0][1].slow).toBe(false)
  })

  it('reports zero duration for an unknown start, not a fake instant', () => {
    for (const bad of [null, undefined, 0]) {
      vi.mocked(writeVideoJobToWAE).mockClear()
      recordVideoCompletionMetric('job-4', 'tenant-1', bad, 1300)
      expect(vi.mocked(writeVideoJobToWAE).mock.calls[0][1].durationSeconds).toBe(0)
    }
  })

  it('never throws when telemetry fails', () => {
    vi.mocked(writeVideoJobToWAE).mockImplementation(() => { throw new Error('down') })
    expect(() => recordVideoCompletionMetric('job-5', 'tenant-1', 1000, 1300)).not.toThrow()
  })
})
