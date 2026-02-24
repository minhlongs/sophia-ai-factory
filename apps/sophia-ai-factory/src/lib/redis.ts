import { Redis } from '@upstash/redis'
import { logger } from '@/lib/utils/logger-utility'

let _redis: Redis | null = null

function createRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production')
    }
    logger.warn('Redis: env vars missing, using dummy fallback (dev/build only)')
    return new Redis({
      url: 'https://dummy-url.upstash.io',
      token: 'dummy_token',
    })
  }

  return new Redis({ url, token })
}

export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    if (!_redis) {
      _redis = createRedis()
    }
    return Reflect.get(_redis, prop, receiver)
  },
})
