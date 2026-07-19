/** @module lottery/analytics-service */
import { TwoDigitRow, TwoDigitStats } from './types'

export function computeTwoDigitStats(rows: TwoDigitRow[]): Map<number, { total: number; lastSeen: string }> {
  const stats = new Map<number, { total: number; lastSeen: string }>()

  for (const row of rows) {
    const prizes = [row.p1, row.p2, row.p3, row.p4, row.p5, row.p6, row.p7, row.p8]
    for (const val of prizes) {
      const current = stats.get(val)
      if (current) {
        current.total += 1
        // lastSeen: earlier rows have newer dates (DESC order)
        // we iterate in order, so last occurrence wins
        current.lastSeen = row.date
      } else {
        stats.set(val, { total: 1, lastSeen: row.date })
      }
    }
  }

  return stats
}

export function computeHotCold(
  stats: Map<number, { total: number; lastSeen: string }>,
  hotCount: number = 10,
): { hot: TwoDigitStats[]; cold: TwoDigitStats[] } {
  const entries: { value: number; total: number; lastSeen: string }[] = []

  for (const [value, data] of stats) {
    entries.push({ value, total: data.total, lastSeen: data.lastSeen })
  }

  // Hot: top N by total descending, then by lastSeen descending (most recent first)
  entries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    return b.lastSeen.localeCompare(a.lastSeen)
  })

  const hot = entries.slice(0, hotCount).map(e => ({
    value: e.value,
    total: e.total,
    lastSeen: e.lastSeen,
  }))

  // Cold: values with zero count
  const cold: TwoDigitStats[] = []
  for (let i = 0; i <= 99; i++) {
    const data = stats.get(i)
    if (!data || data.total === 0) {
      cold.push({ value: i, total: 0, lastSeen: null })
    }
  }

  return { hot, cold }
}
