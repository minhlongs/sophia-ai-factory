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
