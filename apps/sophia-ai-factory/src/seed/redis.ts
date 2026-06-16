// Dynamic import to avoid bundling @upstash/redis in SSR bundle
let Redis: unknown = null

async function loadRedis() {
  if (Redis) return Redis
  try {
    const mod = await import('@upstash/redis')
    Redis = mod.Redis
    return Redis
  } catch (e) {
    console.warn('Redis module not available:', e)
    return null
  }
}

import { logger } from '@/seed/utils/logger-utility'

function createRedis(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Redis: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not set — Redis features disabled')
      return null
    }
    logger.warn('Redis: env vars missing, using dummy fallback (dev/build only)')
    // In dev, we still want to load the module if available
    return { url: '', token: '' }
  }

  return { url, token }
}

let _redis: unknown = null

export const redis = new Proxy({} as object, {
  async get(_target, prop, receiver) {
    if (_redis === null || _redis === undefined) {
      const RedisCls = await loadRedis()
      if (!RedisCls) {
        // No-op for disabled Redis
        const noop = () => undefined
        return noop
      }
      _redis = new (RedisCls as { new (config: { url: string; token: string }): unknown })(createRedis() || { url: '', token: '' })
    }
    return Reflect.get(_redis as Record<string, unknown>, prop, receiver)
  },
})

export function getKvClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return redis
}
