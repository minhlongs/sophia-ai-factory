'use client'

/**
 * UTM parameter capture utility.
 *
 * Parses utm_source, utm_medium, utm_campaign, utm_content, utm_term from the
 * current URL and persists them in sessionStorage so they survive redirects
 * within a single checkout session.
 *
 * Storage key: 'sophia_utm' (JSON-encoded UtmParams object)
 * Strategy: write on first load if params present; read-through on checkout.
 *
 * @module seed/utils/utm-capture
 */

export interface UtmParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  niche?: string
}

const STORAGE_KEY = 'sophia_utm'

/**
 * Parse UTM params from a URLSearchParams instance.
 * Returns only non-empty values.
 */
function parseUtmFromSearch(search: URLSearchParams): UtmParams {
  const result: UtmParams = {}
  const keys: (keyof UtmParams)[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'niche',
  ]
  for (const key of keys) {
    const val = search.get(key)
    if (val) result[key] = val
  }
  return result
}

/**
 * Check if a UtmParams object has any values.
 */
function hasAnyParam(params: UtmParams): boolean {
  return Object.values(params).some((v) => Boolean(v))
}

/**
 * Read stored UTM params from sessionStorage.
 * Returns null if nothing stored or sessionStorage is unavailable.
 */
function readStored(): UtmParams | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UtmParams
  } catch {
    return null
  }
}

/**
 * Write UTM params to sessionStorage.
 * Silently swallows write errors (e.g. private mode quota).
 */
function writeStored(params: UtmParams): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params))
  } catch {
    // Non-fatal — sessionStorage may be blocked in some private modes
  }
}

/**
 * Capture UTM params from current URL and persist to sessionStorage.
 * Should be called once on page load (e.g. in a useEffect).
 *
 * If UTM params are present in the URL, they OVERWRITE any previously stored
 * values — the most recent campaign attribution wins.
 *
 * Safe to call server-side (window check guards execution).
 */
export function captureUtmFromUrl(): void {
  if (typeof window === 'undefined') return
  const search = new URLSearchParams(window.location.search)
  const params = parseUtmFromSearch(search)
  if (hasAnyParam(params)) {
    writeStored(params)
  }
}

/**
 * Retrieve stored UTM params.
 * Returns empty object if nothing was captured.
 * Safe to call server-side (returns empty object).
 */
export function getUtmParams(): UtmParams {
  if (typeof window === 'undefined') return {}
  return readStored() ?? {}
}

/**
 * Clear stored UTM params (e.g. after payment_success to avoid double-attribution).
 */
export function clearUtmParams(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently ignore
  }
}
