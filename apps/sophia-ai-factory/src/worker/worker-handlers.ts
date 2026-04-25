/**
 * HTTP request handlers for the RaaS Gateway Worker
 * @module worker/worker-handlers
 */

/// <reference types="@cloudflare/workers-types" />

import { checkQuota, incrementUsage, getCurrentUsage } from './lib/quota-counter'
import { calculateOverage } from './lib/overage-calculator'
import { createUsageEvent, UsageEvent as WorkerUsageEvent } from './lib/usage-emitter'
import { buildQuotaExceededResponse, buildQuotaInfoHeaders } from './lib/quota-response'
import { raasAuthMiddleware, checkFeatureAccess, type AuthContext } from './middleware/raas-auth-middleware'
import { isTierEligibleForOverage } from './middleware/feature-entitlement'
import { getRequiredFeature } from './middleware/feature-entitlement-logic'
import type { Env } from './index'

interface QuotaResponse {
  allowed: boolean
  remaining: number
  limit: number
  resetDate: string
  overage?: { count: number; fee: number; isOverHardLimit: boolean }
}

export async function handleQuotaCheck(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const body = await request.json() as { apiKey?: string; service?: string }
    const { apiKey, service = 'default' } = body
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    const currentUsage = await getCurrentUsage(apiKey, service, env.KV_KV)
    const tier = await env.KV_KV.get(`tier:${apiKey}`) || 'BASIC'
    const overage = calculateOverage(currentUsage, tier)
    const response: QuotaResponse = { allowed: !overage.isOverHardLimit, remaining: overage.remaining, limit: overage.baseLimit, resetDate: new Date(Date.now() + 2592000000).toISOString() }
    if (overage.overageCount > 0) response.overage = { count: overage.overageCount, fee: overage.overageFee, isOverHardLimit: overage.isOverHardLimit }
    return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function handleProxyRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const authResponse = await raasAuthMiddleware(request, env, ctx)
  if (authResponse) return authResponse

  const authContext = (env as Record<string, unknown>).__authContext as AuthContext | undefined
  if (!authContext) {
    return new Response(JSON.stringify({ error: 'Authentication context missing' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const url = new URL(request.url)
  const service = url.pathname.replace('/api/proxy/', '')
  const requiredFeature = getRequiredFeature(`/api/proxy/${service}`)

  if (requiredFeature) {
    const featureResult = await checkFeatureAccess(requiredFeature, authContext)
    if (!featureResult.allowed) {
      return new Response(JSON.stringify({ error: 'Feature access denied', reason: featureResult.reason, feature: requiredFeature, tier: authContext.tier }), {
        status: 403, headers: { 'Content-Type': 'application/json', 'X-Feature-Required': requiredFeature },
      })
    }
  }

  const apiKey = authContext.userId
  const tier = authContext.tier || 'BASIC'
  const currentUsage = await getCurrentUsage(apiKey, service, env.KV_KV)
  const overage = calculateOverage(currentUsage, tier)

  if (overage.isOverHardLimit) return buildQuotaExceededResponse(overage)

  if (overage.overageCount > 0 && !isTierEligibleForOverage(tier)) {
    return new Response(JSON.stringify({ error: 'Quota exceeded', message: `You have exceeded your ${tier} tier quota. Please upgrade to continue.`, remaining: 0, limit: overage.baseLimit }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const newUsage = await incrementUsage(apiKey, service, 1, env.KV_KV)
  const updatedOverage = calculateOverage(newUsage, tier)

  if (updatedOverage.overageCount > 0 && !updatedOverage.isOverHardLimit) {
    ctx.waitUntil(env.USAGE_QUEUE.send(createUsageEvent(apiKey, authContext.userId, tier, newUsage, service)))
  }

  const originUrl = new URL(url.pathname.replace('/api/proxy', ''), 'https://origin.example.com')
  const response = await fetch(new Request(originUrl, { method: request.method, headers: request.headers, body: request.body }))

  const responseHeaders = new Headers(response.headers)
  buildQuotaInfoHeaders(updatedOverage).forEach((v, k) => responseHeaders.set(k, v))
  if (requiredFeature) responseHeaders.set('X-Feature-Granted', requiredFeature)

  return new Response(response.body, { status: response.status, headers: responseHeaders })
}

export async function handleOverageWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const event: WorkerUsageEvent = JSON.parse(await request.text())
    if (!event.licenseNonce || !event.userId || !event.idempotencyKey) {
      return new Response(JSON.stringify({ error: 'Invalid event format' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    await env.USAGE_QUEUE.send(event)
    return new Response(JSON.stringify({ received: true, eventId: event.idempotencyKey }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
