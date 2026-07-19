import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreditMeter, DEFAULT_CREDIT_METER_CONFIG } from '../credit-meter'

vi.mock('@/seed/db/repositories/agency-repo', () => ({
  getCreditBalance: vi.fn(),
  reserveCredits: vi.fn(),
  commitCredits: vi.fn(),
  refundCredits: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}))

import {
  getCreditBalance,
  reserveCredits,
  commitCredits,
  refundCredits,
} from '@/seed/db/repositories/agency-repo'

describe('CreditMeter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('reserve', () => {
    it('happy path: reserves credits and returns receipt', async () => {
      vi.mocked(reserveCredits).mockResolvedValue({
        ok: true,
        value: 450,
      })

      const meter = new CreditMeter(DEFAULT_CREDIT_METER_CONFIG)
      const result = await meter.reserve(1, 'job-1')

      expect(result.ok).toBe(true)
      expect(result.value.balanceAfter).toBe(450)
      expect(result.value.amount).toBe(1)
      expect(result.value.agencyId).toBe(1)
      expect(result.value.jobId).toBe('job-1')
    })

    it('returns failure on insufficient credits', async () => {
      vi.mocked(reserveCredits).mockResolvedValue({
        ok: false,
        error: { code: 'INSUFFICIENT_CREDITS', message: 'Need 1, have 0' },
      })

      const meter = new CreditMeter(DEFAULT_CREDIT_METER_CONFIG)
      const result = await meter.reserve(1, 'job-1')

      expect(result.ok).toBe(false)
      expect(result.error.code).toBe('INSUFFICIENT_CREDITS')
    })

    it('retries on transient errors', async () => {
      // Fail twice, then succeed
      vi.mocked(reserveCredits)
        .mockResolvedValueOnce({
          ok: false,
          error: { code: 'DB_TIMEOUT', message: 'timeout' },
        })
        .mockResolvedValueOnce({
          ok: false,
          error: { code: 'DB_TIMEOUT', message: 'timeout' },
        })
        .mockResolvedValueOnce({
          ok: true,
          value: 499,
        })

      const meter = new CreditMeter({ creditsPerJob: 1, maxRetries: 3 })
      const result = await meter.reserve(1, 'job-retry')

      expect(result.ok).toBe(true)
      expect(vi.mocked(reserveCredits)).toHaveBeenCalledTimes(3)
    })

    it('exhausts retries then returns failure', async () => {
      vi.mocked(reserveCredits).mockResolvedValue({
        ok: false,
        error: { code: 'DB_TIMEOUT', message: 'timeout' },
      })

      const meter = new CreditMeter({ creditsPerJob: 1, maxRetries: 1 })
      const result = await meter.reserve(1, 'job-fail')

      expect(result.ok).toBe(false)
      expect(result.error.code).toBe('CREDIT_RESERVE_ERROR')
    })
  })

  describe('commit', () => {
    it('happy path: commits reservation', async () => {
      vi.mocked(commitCredits).mockResolvedValue({ ok: true })

      const meter = new CreditMeter(DEFAULT_CREDIT_METER_CONFIG)
      const result = await meter.commit(1, 'job-1')

      expect(result.ok).toBe(true)
      expect(result.value.jobId).toBe('job-1')
      expect(result.value.amount).toBe(1)
    })

    it('returns failure on commit error', async () => {
      vi.mocked(commitCredits).mockResolvedValue({
        ok: false,
        error: { code: 'RESERVATION_NOT_FOUND', message: 'not found' },
      })

      const meter = new CreditMeter(DEFAULT_CREDIT_METER_CONFIG)
      const result = await meter.commit(1, 'job-missing')

      expect(result.ok).toBe(false)
      expect(result.error.code).toBe('CREDIT_COMMIT_ERROR')
    })
  })

  describe('refund', () => {
    it('happy path: refunds credits', async () => {
      vi.mocked(refundCredits).mockResolvedValue({ ok: true })

      const meter = new CreditMeter(DEFAULT_CREDIT_METER_CONFIG)
      const result = await meter.refund(1, 'job-fail')

      expect(result.ok).toBe(true)
    })

    it('returns failure on refund error', async () => {
      vi.mocked(refundCredits).mockResolvedValue({
        ok: false,
        error: { code: 'RESERVATION_NOT_FOUND', message: 'not found' },
      })

      const meter = new CreditMeter(DEFAULT_CREDIT_METER_CONFIG)
      const result = await meter.refund(1, 'job-missing')

      expect(result.ok).toBe(false)
      expect(result.error.code).toBe('CREDIT_REFUND_ERROR')
    })
  })

  describe('getBalance', () => {
    it('returns balance from agency repo', async () => {
      vi.mocked(getCreditBalance).mockResolvedValue(500)

      const meter = new CreditMeter()
      const balance = await meter.getBalance(1)

      expect(balance).toBe(500)
    })

    it('returns 0 on error', async () => {
      vi.mocked(getCreditBalance).mockRejectedValue(new Error('db error'))

      const meter = new CreditMeter()
      const balance = await meter.getBalance(1)

      expect(balance).toBe(0)
    })
  })
})
