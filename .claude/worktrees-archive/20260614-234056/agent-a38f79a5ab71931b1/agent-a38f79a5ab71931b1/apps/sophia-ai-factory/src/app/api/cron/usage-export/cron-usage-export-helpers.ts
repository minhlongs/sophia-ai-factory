/**
 * Date helpers for usage export cron
 * @module app/api/cron/usage-export/cron-usage-export-helpers
 */

export function getPreviousDayRange(): { startTimestamp: number; endTimestamp: number } {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999))
  return { startTimestamp: Math.floor(start.getTime() / 1000), endTimestamp: Math.floor(end.getTime() / 1000) }
}
