/**
 * Redis client — foundational utility (seed layer).
 *
 * All layers (seed, tree, forest, land) can import from here.
 * Previously lived in land/redis.ts, moved to seed to resolve
 * forest→land layer violations.
 */

import { Redis } from '@upstash/redis'
import { logger } from '@/seed/utils/logger-utility'

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

/**
 * Returns the Redis client or null if env vars are missing (non-production)
 */
export function getKvClient(): Redis | null {
const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
if (!url || !token) return null
return redis
}
