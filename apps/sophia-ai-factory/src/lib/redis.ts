import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL || 'https://dummy-url.upstash.io'
const token = process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy_token'

if (!process.env.UPSTASH_REDIS_REST_URL && process.env.NODE_ENV !== 'production') {
  console.warn('UPSTASH_REDIS_REST_URL is not defined. Redis functionality will be disabled or mock.')
}

export const redis = new Redis({
  url: url,
  token: token,
})
