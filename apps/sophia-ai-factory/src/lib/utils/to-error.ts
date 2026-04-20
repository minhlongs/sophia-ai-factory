/**
 * Normalize any thrown/rejected value to a proper `Error` instance.
 *
 * `catch` blocks receive `unknown`. Most call sites cast blindly with
 * `as Error`, which hides non-Error throws (strings, objects, undefined).
 * `toError()` makes the narrowing explicit and safe in ONE place.
 *
 * Supabase `PostgrestError` is a plain object (`{ message, code?, details?, hint? }`),
 * not an `Error`. When passed through `toError()` it would otherwise collapse to
 * `Error("[object Object]")`. The PostgrestError-like branch below preserves
 * `.message` and attaches `code`/`details`/`hint` as own-properties for logging.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)

  if (
    value !== null &&
    typeof value === 'object' &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  ) {
    const src = value as {
      message: string
      code?: unknown
      details?: unknown
      hint?: unknown
    }
    return Object.assign(new Error(src.message), {
      ...(src.code !== undefined && { code: src.code }),
      ...(src.details !== undefined && { details: src.details }),
      ...(src.hint !== undefined && { hint: src.hint }),
    })
  }

  return new Error(String(value))
}
