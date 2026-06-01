/**
 * Custom error types for ServiceFactory.
 * @module lib/services/errors
 */

/**
 * Thrown when a required API credential is absent in production.
 * Message includes only the key NAME — never the value — to prevent log leaks.
 */
export class MissingCredentialsError extends Error {
  constructor(public readonly key: string) {
    super(`Missing required credential: ${key}`)
    this.name = 'MissingCredentialsError'
    // Maintain proper prototype chain in transpiled environments
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
