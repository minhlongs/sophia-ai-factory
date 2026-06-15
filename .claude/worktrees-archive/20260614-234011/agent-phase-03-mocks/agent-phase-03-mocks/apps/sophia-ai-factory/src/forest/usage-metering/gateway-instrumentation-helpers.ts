/**
 * Helper functions for Gateway Instrumentation (no side effects)
 * @module usage-metering/gateway-instrumentation-helpers
 */

import type { NextRequest } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import type { AiService } from './types'

function parseLicenseKey(key: string): { licenseKey: string; licenseNonce: string | null; tier: string } {
  const tierMatch = key.match(/^raas_(basic|premium|enterprise|master)_/i)
  const tier = tierMatch ? tierMatch[1].toUpperCase() : 'BASIC'
  const nonce = key.split('_')[3] || null
  return { licenseKey: key, licenseNonce: nonce, tier }
}

export function extractLicenseInfo(request: NextRequest): { licenseKey: string | null; licenseNonce: string | null; tier: string } {
  const headerKey = request.headers.get('x-raas-license-key')
  if (headerKey) return parseLicenseKey(headerKey)

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token.startsWith('raas_')) return parseLicenseKey(token)
  }

  const queryKey = request.nextUrl.searchParams.get('license_key')
  if (queryKey) {
    logger.warn('[Gateway Instrumentation] License key from query param - insecure')
    return parseLicenseKey(queryKey)
  }

  return { licenseKey: null, licenseNonce: null, tier: 'BASIC' }
}

export function shouldExcludeTracking(pathname: string): boolean {
  const excluded = process.env.USAGE_METERING_EXCLUDED_ENDPOINTS?.split(',') || [
    '/api/health', '/api/setup', '/api/webhooks', '/api/auth', '/api/discovery', '/api/sophia-index', '/api/cron',
  ]
  return excluded.some(route => pathname.startsWith(route))
}

export function getSamplingRate(pathname: string): number {
  const sampleRateEnv = process.env.USAGE_METERING_SAMPLE_RATE
  if (sampleRateEnv) {
    const rate = parseFloat(sampleRateEnv)
    if (rate >= 0 && rate <= 1) return rate
  }
  const highVolume = ['/api/chat', '/api/completions', '/api/stream']
  return highVolume.some(ep => pathname.startsWith(ep)) ? 0.1 : 1.0
}

export function determineServiceFromPath(pathname: string): AiService {
  const match = pathname.match(/^\/api\/([^/]+)/)
  if (match) {
    const s = match[1]
    if (s === 'heygen') return 'heygen'
    if (s === 'elevenlabs') return 'elevenlabs'
    if (s === 'openrouter') return 'openrouter'
  }
  return 'openrouter'
}

export function determineActionFromPath(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean)
  return parts.length >= 3 ? parts.slice(2).join('/') : (parts[parts.length - 1] || undefined)
}
