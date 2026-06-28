/**
 * Write, read, and admin operations for Overage Event Logger
 * @module quota/overage-logger-ops
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { getBuffer } from './overage-logger-buffer'
import type { OverageEventInput } from './overage-logger-types'

export async function logOverageEventImmediate(event: OverageEventInput): Promise<string | null> {
  try {
    const { data, error } = await createServerClient()
      .from('overage_events')
      .insert({ user_id: event.userId, license_nonce: event.licenseNonce, exceeded_type: event.exceededType, exceeded_limit: event.exceededLimit, exceeded_current: event.exceededCurrent, exceeded_by: event.exceededBy, requested_credits: event.requestedCredits, endpoint: event.endpoint, service_name: event.service, action: event.action, tier_at_exceeded: event.tier, ip_address: event.ipAddress, user_agent: event.userAgent, external_customer_id: event.externalCustomerId, billable: false })
      .select('id').single() as { data: { id: string } | null; error: unknown }
    if (error) throw error
    logger.warn('[Overage Logger] Event logged', { eventId: data?.id, userId: event.userId, exceededType: event.exceededType, exceededBy: event.exceededBy })
    return data?.id ?? null
  } catch (error) {
    logger.error('[Overage Logger] Failed to log event', toError(error))
    return null
  }
}

export async function logOverageEvent(event: OverageEventInput, options: { buffered?: boolean } = { buffered: true }): Promise<string | null> {
  if (!options.buffered) return logOverageEventImmediate(event)
  getBuffer().add(event).catch(err => logger.error('[Overage Logger] Buffer add error', err))
  return null
}

interface OverageEventRow { id: string; exceeded_type: string; exceeded_limit: number; exceeded_current: number; exceeded_by: number; tier_at_exceeded: string; created_at: string; billable: boolean }

export async function getUserOverageEvents(userId: string, options: { limit?: number; startDate?: number; endDate?: number } = {}): Promise<Array<{ id: string; exceededType: string; exceededLimit: number; exceededCurrent: number; exceededBy: number; tierAtExceeded: string; createdAt: number; billable: boolean }>> {
  const db = createServerClient()
  const limit = options.limit ?? 10
  let query = db.from('overage_events').select('id, exceeded_type, exceeded_limit, exceeded_current, exceeded_by, tier_at_exceeded, created_at, billable').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit) as unknown as { gte: (k: string, v: number) => typeof query; lte: (k: string, v: number) => typeof query; then: Promise<{ data: OverageEventRow[] | null; error: unknown }>['then'] }
  if (options.startDate) query = query.gte('created_at', options.startDate)
  if (options.endDate) query = query.lte('created_at', options.endDate)
  const { data, error } = await (query as unknown as Promise<{ data: OverageEventRow[] | null; error: { message: string } | null }>)
  if (error) { logger.error('[Overage Logger] Failed to fetch events', error); return [] }
  return (data || []).map(row => ({ id: row.id, exceededType: row.exceeded_type, exceededLimit: row.exceeded_limit, exceededCurrent: row.exceeded_current, exceededBy: row.exceeded_by, tierAtExceeded: row.tier_at_exceeded, createdAt: Number(row.created_at), billable: row.billable }))
}

export async function getOverageSummary(licenseNonce: string, periodStart: number, periodEnd: number): Promise<{ totalOverageEvents: number; totalOverageCredits: number; byType: Record<string, number>; billableEvents: number }> {
  interface OverageSummaryRow { exceeded_by: number; exceeded_type: string; billable: boolean }
  const db = createServerClient()
  const { data, error } = await db.from('overage_events').select('exceeded_by, exceeded_type, billable').eq('license_nonce', licenseNonce).gte('created_at', periodStart).lte('created_at', periodEnd) as { data: OverageSummaryRow[] | null; error: { message: string } | null }
  if (error) { logger.error('[Overage Logger] Failed to fetch summary', error); return { totalOverageEvents: 0, totalOverageCredits: 0, byType: {}, billableEvents: 0 } }
  const byType: Record<string, number> = {}
  data?.forEach((e: OverageSummaryRow) => { byType[e.exceeded_type] = (byType[e.exceeded_type] || 0) + 1 })
  return { totalOverageEvents: data?.length || 0, totalOverageCredits: data?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0, byType, billableEvents: data?.filter(e => e.billable).length || 0 }
}

export async function markEventsAsBillable(eventIds: string[], pricePerCredit: number): Promise<number> {
  if (eventIds.length === 0) return 0
  try {
    const { error } = await createServerClient()
      .from('overage_events').update({ billable: true }).in('id', eventIds)
    if (error) { logger.error('[Overage Logger] Failed to mark events as billable', toError(error)); return 0 }
    logger.info('[Overage Logger] Marked events as billable', { count: eventIds.length, pricePerCredit })
    return eventIds.length
  } catch (error) {
    logger.error('[Overage Logger] Error marking events as billable', error instanceof Error ? error : new Error(String(error)))
    return 0
  }
}
