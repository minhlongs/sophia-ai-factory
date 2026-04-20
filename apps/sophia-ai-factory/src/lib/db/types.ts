/**
 * Shared generic types for the D1 query layer.
 *
 * Keep this file free of runtime code — interfaces and type aliases only.
 */

/** Generic D1 query response shape for `.single()` / raw-chain awaits. */
export type D1Response<T> = {
  data: T | null
  error: unknown
}
