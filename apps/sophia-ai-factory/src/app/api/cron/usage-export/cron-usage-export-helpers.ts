/**
 * Auth and date helpers for usage export cron
 * @module app/api/cron/usage-export/cron-usage-export-helpers
 */

import type { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger-utility'

export function verifyCronAuth(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') {
    logger.info('[Usage Export Cron] Development mode - skipping auth')
    return true
  }
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && request.headers.get('authorization') === `Bearer ${expectedSecret}`) {
    logger.info('[Usage Export Cron] Authenticated via Authorization Bearer')
    return true
  }
  if (expectedSecret && request.headers.get('x-cron-secret') === expectedSecret) {
    logger.info('[Usage Export Cron] Authenticated via X-Cron-Secret')
    return true
  }
  if (request.headers.get('x-cf-cron') === 'true') {
    logger.info('[Usage Export Cron] Authenticated via Cloudflare Cron header')
    return true
  }
  logger.warn('[Usage Export Cron] Unauthorized cron attempt')
  return false
}

export function getPreviousDayRange(): { startTimestamp: number; endTimestamp: number } {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999))
  return { startTimestamp: Math.floor(start.getTime() / 1000), endTimestamp: Math.floor(end.getTime() / 1000) }
}
