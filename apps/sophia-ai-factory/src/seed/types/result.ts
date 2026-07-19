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

/** Type guard: narrow Result to success variant */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
	return result.ok === true;
}

/** Type guard: narrow Result to error variant */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
	return result.ok === false;
}

/** Unwrap a Result or throw — use at the boundary where you must have a value */
export function unwrap<T, E>(result: Result<T, E>, message?: string): T {
	if (result.ok) return result.value;
	throw result.error instanceof Error
		? result.error
		: new Error(message ?? `unwrap failed: ${String(result.error)}`);
}
