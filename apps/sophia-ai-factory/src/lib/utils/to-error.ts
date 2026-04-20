/**
 * Normalize any thrown/rejected value to a proper `Error` instance.
 *
 * `catch` blocks receive `unknown`. Most call sites cast blindly with
 * `as Error`, which hides non-Error throws (strings, objects, undefined).
 * `toError()` makes the narrowing explicit and safe in ONE place.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  return new Error(String(value))
}
