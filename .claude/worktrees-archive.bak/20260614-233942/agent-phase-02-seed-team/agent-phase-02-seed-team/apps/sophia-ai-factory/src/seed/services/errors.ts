/**
 * Shared service error types.
 *
 * Keep these in seed so adapters in forest/land/tree can depend on them
 * without violating the one-way layer boundary.
 */

export class MissingCredentialsError extends Error {
  constructor(public readonly key: string) {
    super(`Missing required credential: ${key}`)
    this.name = 'MissingCredentialsError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ProviderQuotaExceededError extends Error {
  constructor(public readonly service: string, message: string) {
    super(`[${service}] Quota exceeded or out of credits: ${message}`)
    this.name = 'ProviderQuotaExceededError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ProviderInvalidKeyError extends Error {
  constructor(public readonly service: string, message: string) {
    super(`[${service}] Invalid API key or unauthorized: ${message}`)
    this.name = 'ProviderInvalidKeyError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ProviderNetworkError extends Error {
  constructor(public readonly service: string, message: string) {
    super(`[${service}] Network error or timeout: ${message}`)
    this.name = 'ProviderNetworkError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
