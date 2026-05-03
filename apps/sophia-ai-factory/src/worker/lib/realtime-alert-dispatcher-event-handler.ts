/**
 * Usage event processing and AgencyOS dispatch for realtime alert dispatcher
 * @module worker/realtime-alert-dispatcher-event-handler
 */

import { ExecutionContext } from '@cloudflare/workers-types'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { AlertDispatcherConfig } from './realtime-alert-dispatcher'
import { isDebounced, markAlertSent } from './realtime-alert-dispatcher-kv'

export interface UsageEvent {
  id: string; user_id: string; license_nonce: string; credits_used: number
  endpoint: string; service_name?: string; created_at: string; tenant_id?: string
}

interface AgencyOSAlertPayload {
  eventId: string; type: 'usage_threshold' | 'license_violation' | 'quota_exceeded'
  severity: 'low' | 'medium' | 'high' | 'critical'; tenantId: string; licenseNonce: string
  threshold?: number; percentage: number; limit: number; currentUsage: number
  timestamp: string; metadata: Record<string, unknown>
}

function getQuotaLimits(tier: string): { hourly: number; daily: number; monthly: number } {
  const limits: Record<string, { hourly: number; daily: number; monthly: number }> = {
    BASIC:      { hourly: 100,   daily: 1000,   monthly: 10000 },
    PREMIUM:    { hourly: 500,   daily: 5000,   monthly: 50000 },
    ENTERPRISE: { hourly: 2000,  daily: 20000,  monthly: 200000 },
    MASTER:     { hourly: 10000, daily: 100000, monthly: 1000000 },
  }
  return limits[tier?.toUpperCase()] || limits.BASIC
}

async function dispatchToAgencyos(payload: AgencyOSAlertPayload, config: AlertDispatcherConfig): Promise<boolean> {
  try {
    const response = await fetch(config.agencyosWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.agencyosApiKey}`, 'User-Agent': 'RaaS-Gateway-Worker/1.0' },
      body: JSON.stringify(payload),
    })
    if (response.ok) { logger.info('[Alert Dispatcher] Dispatched to AgencyOS', { eventId: payload.eventId }); return true }
    logger.warn('[Alert Dispatcher] AgencyOS webhook failed', { status: response.status })
    return false
  } catch (error) {
    logger.error('[Alert Dispatcher] Dispatch error', toError(error))
    return false
  }
}

export async function handleUsageEvent(event: UsageEvent, config: AlertDispatcherConfig, kv: KVNamespace | null, ctx: ExecutionContext, db: D1Database): Promise<void> {
  try {
    const now = new Date()
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0)
    const usageResult = await db.prepare(`SELECT SUM(credits_used) as total FROM usage_events WHERE user_id = ? AND license_nonce = ? AND created_at >= ?`)
      .bind(event.user_id, event.license_nonce, hourStart.toISOString()).first<{ total: number | null }>()
    const currentUsage = usageResult?.total ?? 0

    const licenseResult = await db.prepare(`SELECT tier FROM raas_licenses WHERE nonce = ? LIMIT 1`).bind(event.license_nonce).first<{ tier: string }>()
    if (!licenseResult) { logger.warn('[Alert Dispatcher] License not found', { userId: event.user_id }); return }

    const tier = licenseResult.tier
    const limits = getQuotaLimits(tier)
    const percentage = (currentUsage / limits.hourly) * 100
    const thresholds = config.enabledThresholds.sort((a, b) => b - a)
    let breachedThreshold = 0
    for (const threshold of thresholds) { if (percentage >= threshold) { breachedThreshold = threshold; break } }
    if (breachedThreshold === 0) return

    const debounced = await isDebounced(kv, event.user_id, event.license_nonce, breachedThreshold, config.debounceMs)
    if (debounced) return

    const severity = breachedThreshold === 100 ? 'critical' : breachedThreshold >= 90 ? 'high' : breachedThreshold >= 80 ? 'medium' : 'low'
    const payload: AgencyOSAlertPayload = {
      eventId: crypto.randomUUID(), type: 'usage_threshold', severity,
      tenantId: event.tenant_id || event.user_id, licenseNonce: event.license_nonce,
      threshold: breachedThreshold, percentage, limit: limits.hourly, currentUsage,
      timestamp: new Date().toISOString(),
      metadata: { tier, endpoint: event.endpoint, serviceName: event.service_name, creditsUsedInEvent: event.credits_used },
    }
    const dispatched = await dispatchToAgencyos(payload, config)
    if (dispatched) {
      await markAlertSent(kv, event.user_id, event.license_nonce, breachedThreshold)
      ctx.waitUntil(
        db.prepare(`INSERT INTO user_alerts (user_id, license_nonce, type, severity, title, message, metadata, pushed, pushed_at, expires_at) VALUES (?, ?, 'usage_threshold', ?, ?, ?, ?, 1, ?, ?)`)
          .bind(event.user_id, event.license_nonce, severity, `Usage Alert: ${breachedThreshold}% Threshold`, `Your usage has reached ${percentage.toFixed(1)}% of hourly limit.`, JSON.stringify(payload.metadata), new Date().toISOString(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()).run()
      )
    }
  } catch (error) {
    logger.error('[Alert Dispatcher] Event handling error', toError(error))
  }
}
