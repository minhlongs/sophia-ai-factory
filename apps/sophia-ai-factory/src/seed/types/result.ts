/** Discriminated union for explicit success/failure — no more silent error swallowing */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function success<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function failure<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Unwrap a Result or throw — use at the boundary where you must have a value */
export function unwrap<T, E>(result: Result<T, E>, message?: string): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error
    ? result.error
    : new Error(message ?? `unwrap failed: ${String(result.error)}`);
}
