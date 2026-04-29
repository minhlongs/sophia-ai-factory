/**
 * useCsrfToken — React hook for reading the CSRF cookie and building fetch headers.
 *
 * Usage:
 *   const csrfHeaders = useCsrfToken()
 *   await fetch('/api/some-mutation', { method: 'POST', headers: { ...csrfHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
 */

'use client'

import { useMemo } from 'react'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf'

/**
 * Parse a named cookie from document.cookie string.
 * Returns undefined when running server-side or cookie is absent.
 */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match?.split('=')[1]
}

/**
 * Returns an object containing the x-csrf-token header populated from the
 * csrf-token cookie. Include this in the headers of every mutating fetch call.
 *
 * Returns an empty object if the cookie is not present (e.g. SSR context).
 */
export function useCsrfToken(): Record<string, string> {
  return useMemo((): Record<string, string> => {
    const token = readCookie(CSRF_COOKIE_NAME)
    if (!token) return {}
    return { [CSRF_HEADER_NAME]: token }
  }, [])
}
