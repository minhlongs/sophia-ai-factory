/**
 * Redis stub — no-op implementation when real Redis is unavailable.
 * Used to keep bundle size down on Cloudflare Workers.
 */
export class Redis {
  constructor(_opts?: any) {}
  async get(_key: string) { return null }
  async set(_key: string, _value: string, _opts?: any) { return true }
  async del(_key: string) { return 1 }
  async keys(_pattern: string) { return [] }
  async expire(_key: string, _ttl: number) { return 1 }
  async ttl(_key: string) { return -2 }
  async incr(_key: string) { return 1 }
  async decr(_key: string) { return 1 }
  async lpush(_key: string, ..._values: string[]) { return _values.length }
  async rpush(_key: string, ..._values: string[]) { return _values.length }
  async lrange(_key: string, _start: number, _stop: number) { return [] }
  async sadd(_key: string, ..._members: string[]) { return _members.length }
  async smembers(_key: string) { return [] }
}
