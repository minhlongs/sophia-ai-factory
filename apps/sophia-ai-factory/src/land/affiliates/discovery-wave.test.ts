/**
 * Tests for Agentic Affiliate Discovery Wave
 *
 * Verifies concurrent multi-network scanning, quality scoring,
 * high-EPC ranking, scam filtering, and Result error handling.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { runAgenticDiscoveryWave } from './discovery-wave'

describe('runAgenticDiscoveryWave', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('scans and ranks offers across ClickBank, Awin, and ShareASale with mock fallbacks', async () => {
    const res = await runAgenticDiscoveryWave({
      niche: 'saas',
      minScore: 0.4,
      limit: 10,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return

    const result = res.value
    expect(result.scannedCount).toBeGreaterThan(0)
    expect(result.topOffers.length).toBeGreaterThan(0)
    expect(result.networkBreakdown.clickbank).toBeGreaterThan(0)
    expect(result.networkBreakdown.awin).toBeGreaterThan(0)
    expect(result.networkBreakdown.shareasale).toBeGreaterThan(0)

    // Verify sorted in descending order of qualityScore
    for (let i = 0; i < result.topOffers.length - 1; i++) {
      expect(result.topOffers[i].qualityScore).toBeGreaterThanOrEqual(
        result.topOffers[i + 1].qualityScore
      )
    }

    // Verify offer shape
    const first = result.topOffers[0]
    expect(first.externalId).toBeTruthy()
    expect(first.network).toMatch(/clickbank|awin|shareasale/)
    expect(first.passesScamGate).toBe(true)
    expect(first.qualityScore).toBeGreaterThanOrEqual(0.4)
    expect(first.scoreBreakdown).toBeDefined()
  })

  it('respects specific network selection', async () => {
    const res = await runAgenticDiscoveryWave({
      networks: ['clickbank'],
      minScore: 0.3,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.value.networkBreakdown.clickbank).toBeGreaterThan(0)
    expect(res.value.networkBreakdown.awin).toBeUndefined()
    expect(res.value.networkBreakdown.shareasale).toBeUndefined()
    expect(res.value.topOffers.every(o => o.network === 'clickbank')).toBe(true)
  })

  it('respects limit parameter', async () => {
    const res = await runAgenticDiscoveryWave({
      limit: 2,
      minScore: 0.1,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.topOffers.length).toBeLessThanOrEqual(2)
  })

  it('filters out offers when minScore is higher than any candidate score', async () => {
    const res = await runAgenticDiscoveryWave({
      minScore: 0.99,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.topOffers.length).toBe(0)
    expect(res.value.qualifiedCount).toBe(0)
  })

  it('returns failure when empty network list is provided', async () => {
    const res = await runAgenticDiscoveryWave({
      networks: [] as unknown as ('clickbank' | 'awin' | 'shareasale')[],
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.message).toContain('No valid affiliate networks selected')
  })
})
