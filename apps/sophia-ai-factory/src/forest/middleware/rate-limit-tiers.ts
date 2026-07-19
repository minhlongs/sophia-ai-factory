/**
 * Rate Limit Tier Definitions
 * Static per-category rate limit configs and endpoint pattern rules
 */

import { RateLimitConfig } from './rate-limiter'

export interface EndpointRateLimit {
  pattern: string
  config: RateLimitConfig
  description: string
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  api: { intervalMs: 60 * 1000, maxRequests: 30 },
  apiV1: { intervalMs: 60 * 1000, maxRequests: 60 },
  ingestion: { intervalMs: 60 * 1000, maxRequests: 100 },
  admin: { intervalMs: 60 * 1000, maxRequests: 20 },
  auth: { intervalMs: 15 * 60 * 1000, maxRequests: 10 },
  webhooks: { intervalMs: 60 * 1000, maxRequests: 200 },
  health: { intervalMs: 60 * 1000, maxRequests: 300 },
  usage: { intervalMs: 60 * 1000, maxRequests: 60 },
  analytics: { intervalMs: 60 * 1000, maxRequests: 30 },
  heygen: { intervalMs: 60 * 1000, maxRequests: 20 },
  setup: { intervalMs: 60 * 60 * 1000, maxRequests: 10 },
  checkout: { intervalMs: 60 * 1000, maxRequests: 10 },
  discovery: { intervalMs: 60 * 1000, maxRequests: 30 },
  default: { intervalMs: 60 * 1000, maxRequests: 30 },
}

/** Ordered endpoint rules — first match wins */
export const ENDPOINT_RULES: EndpointRateLimit[] = [
  { pattern: '/api/auth/*', config: RATE_LIMITS.auth, description: 'Authentication endpoints' },
  { pattern: '/api/auth', config: RATE_LIMITS.auth, description: 'Authentication root endpoint' },
  { pattern: '/api/welcome/validate/*', config: RATE_LIMITS.setup, description: 'Magic link validation' },
  { pattern: '/api/welcome/resend', config: RATE_LIMITS.setup, description: 'Magic link resend' },
  { pattern: '/api/v1/*', config: RATE_LIMITS.apiV1, description: 'API v1 endpoints' },
  { pattern: '/api/v1', config: RATE_LIMITS.apiV1, description: 'API v1 root endpoint' },
  { pattern: '/api/ingestion/*', config: RATE_LIMITS.ingestion, description: 'Data ingestion endpoints' },
  { pattern: '/api/admin/*', config: RATE_LIMITS.admin, description: 'Admin endpoints' },
  { pattern: '/api/webhooks/*', config: RATE_LIMITS.webhooks, description: 'Webhook endpoints' },
  { pattern: '/api/health', config: RATE_LIMITS.health, description: 'Health check endpoint' },
  { pattern: '/api/usage/*', config: RATE_LIMITS.usage, description: 'Usage tracking endpoints' },
  { pattern: '/api/analytics/*', config: RATE_LIMITS.analytics, description: 'Analytics endpoints' },
  { pattern: '/api/heygen/*', config: RATE_LIMITS.heygen, description: 'HeyGen integration endpoints' },
  { pattern: '/api/setup/*', config: RATE_LIMITS.setup, description: 'Setup wizard endpoints' },
  { pattern: '/api/checkout', config: RATE_LIMITS.checkout, description: 'Checkout endpoint' },
  { pattern: '/api/user/byok/*', config: RATE_LIMITS.admin, description: 'BYOK key management' },
  { pattern: '/api/discovery/*', config: RATE_LIMITS.discovery, description: 'Discovery/search endpoints' },
  { pattern: '/api/*', config: RATE_LIMITS.api, description: 'General API endpoints' },
]
