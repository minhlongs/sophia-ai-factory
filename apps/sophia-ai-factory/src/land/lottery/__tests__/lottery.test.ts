/** @module lottery/lottery.test */
import { describe, it, expect } from 'vitest'
import { extractTwoDigits, extractAllTwoDigits, createLotteryRow } from '../lottery-db'
import { computeTwoDigitStats, computeHotCold } from '../analytics-service'

describe('lottery-db', () => {
  describe('extractTwoDigits', () => {
    it('extracts last 2 digits from each prize column', () => {
      const row = createLotteryRow('2025-01-01', {
        prize_1: '12',
        prize_2: '345',
        prize_3: '6',
        prize_4: '78',
        prize_5: '901',
        prize_6: '12300',
        prize_7: '1',
        prize_8: '55',
      })
      const result = extractTwoDigits(row)
      expect(result.p1).toBe(12)
      expect(result.p2).toBe(45)   // '345'.slice(-2) = '45'
      expect(result.p3).toBe(6)    // '6'.slice(-2) = '6'
      expect(result.p4).toBe(78)
      expect(result.p5).toBe(1)    // '901'.slice(-2) = '01' → 1
      expect(result.p6).toBe(0)    // '12300'.slice(-2) = '00' → 0
      expect(result.p7).toBe(1)    // '1'.slice(-2) = '1'
      expect(result.p8).toBe(55)
    })

    it('handles single-digit values', () => {
      const row = createLotteryRow('2025-01-01', {
        prize_1: '5',
        prize_2: '50',
        prize_3: '0',
        prize_4: '99',
        prize_5: '10',
        prize_6: '1',
        prize_7: '25',
        prize_8: '7',
      })
      const result = extractTwoDigits(row)
      expect(result.p1).toBe(5)
      expect(result.p2).toBe(50)
      expect(result.p3).toBe(0)
      expect(result.p4).toBe(99)
      expect(result.p5).toBe(10)
      expect(result.p6).toBe(1)    // '1'.slice(-2) = '1'
      expect(result.p7).toBe(25)
      expect(result.p8).toBe(7)
    })
  })

  describe('extractAllTwoDigits', () => {
    it('maps multiple rows', () => {
      const rows = [
        createLotteryRow('2025-01-01', { prize_1: '12', prize_2: '34', prize_3: '56', prize_4: '78', prize_5: '90', prize_6: '12', prize_7: '34', prize_8: '56' }),
        createLotteryRow('2025-01-02', { prize_1: '99', prize_2: '88', prize_3: '77', prize_4: '66', prize_5: '55', prize_6: '44', prize_7: '33', prize_8: '22' }),
      ]
      const result = extractAllTwoDigits(rows)
      expect(result).toHaveLength(2)
      expect(result[0].date).toBe('2025-01-01')
      expect(result[1].date).toBe('2025-01-02')
      expect(result[0].p1).toBe(12)
      expect(result[0].p8).toBe(56)
      expect(result[1].p1).toBe(99)
      expect(result[1].p8).toBe(22)
    })

    it('returns empty array for empty input', () => {
      expect(extractAllTwoDigits([])).toEqual([])
    })
  })

  describe('createLotteryRow', () => {
    it('creates row structure with correct date and prizes', () => {
      const prizes = {
        prize_1: '1',
        prize_2: '2',
        prize_3: '3',
        prize_4: '4',
        prize_5: '5',
        prize_6: '6',
        prize_7: '7',
        prize_8: '8',
      }
      const row = createLotteryRow('2025-06-15', prizes)
      expect(row.id).toBe(0)
      expect(row.date).toBe('2025-06-15')
      expect(row.prize_1).toBe('1')
      expect(row.prize_8).toBe('8')
    })
  })
})

describe('analytics-service', () => {
  describe('computeTwoDigitStats', () => {
    it('counts occurrences across all prizes', () => {
      const rows = [
        { date: '2025-01-01', p1: 12, p2: 34, p3: 56, p4: 78, p5: 90, p6: 12, p7: 34, p8: 56 },
        { date: '2025-01-02', p1: 12, p2: 50, p3: 50, p4: 10, p5: 1, p6: 50, p7: 0, p8: 7 },
      ]
      const stats = computeTwoDigitStats(rows)
      // 12 appears 2 times in row 1 (p1,p6) + 1 in row 2 = 3
      expect(stats.get(12)?.total).toBe(3)
      // 50 appears at p1,p2,p3,p6 = 4 times in row 2
      expect(stats.get(50)?.total).toBe(3) // p2,p3,p6 in row 2
      // a value that appears once
      expect(stats.get(78)?.total).toBe(1)
      // value not present
      expect(stats.get(99)).toBeUndefined()
    })

    it('tracks lastSeen date', () => {
      const rows = [
        { date: '2025-01-01', p1: 12, p2: 34, p3: 56, p4: 78, p5: 90, p6: 12, p7: 34, p8: 56 },
        { date: '2025-01-02', p1: 50, p2: 50, p3: 50, p4: 10, p5: 1, p6: 50, p7: 0, p8: 7 },
      ]
      const stats = computeTwoDigitStats(rows)
      // lastSeen should be 2025-01-02 since that row is later in iteration order
      // (the function updates lastSeen to the current row's date when iterating)
      expect(stats.get(50)?.lastSeen).toBe('2025-01-02')
    })

    it('returns empty map for empty input', () => {
      expect(computeTwoDigitStats([]).size).toBe(0)
    })
  })

  describe('computeHotCold', () => {
    it('returns top hot numbers and cold zeros', () => {
      const stats = new Map([
        [12, { total: 10, lastSeen: '2025-01-02' }],
        [50, { total: 5, lastSeen: '2025-01-02' }],
        [3, { total: 3, lastSeen: '2025-01-01' }],
        [99, { total: 0, lastSeen: '2025-01-01' }],
      ])
      const { hot, cold } = computeHotCold(stats, 2)
      // Top 2 hot: 12 (10), 50 (5)
      expect(hot).toHaveLength(2)
      expect(hot[0].value).toBe(12)
      expect(hot[0].total).toBe(10)
      expect(hot[1].value).toBe(50)
      expect(hot[1].total).toBe(5)
      // 99 has total=0 so should be in cold
      expect(cold.some(c => c.value === 99)).toBe(true)
    })

    it('cold includes all 0-99 values not in stats', () => {
      const stats = new Map([[12, { total: 5, lastSeen: '2025-01-01' }]])
      const { cold } = computeHotCold(stats, 5)
      expect(cold.length).toBe(99) // all except 12
    })
  })
})
