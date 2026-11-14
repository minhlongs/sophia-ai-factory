/**
 * Dead-letter evidence serialization — allowlist-only, fail-closed.
 *
 * Every value written to `postback_dead_letter.headers_json` passes through
 * `serializeDlqHeaders`, and the endpoint identity passes through
 * `serializeDlqEndpoint`. The header policy is deliberately an allowlist of
 * non-sensitive diagnostic names rather than a denylist of known secret names:
 * providers invent credential headers we have never heard of, and a denylist
 * leaks the first one nobody listed. Anything not named below is dropped, never
 * stored — a request carrying an unexpected credential header stores nothing
 * for it rather than storing it.
 *
 * Signature correlation is preserved without retaining credential material.
 * For each signature header the calling contract declares, only a truncated
 * one-way digest is stored, under a `sigfp:` prefix so no consumer can mistake
 * it for a usable signature. That digest is enough to correlate two captures of
 * the same signature and useless for authenticating a replay.
 *
 * Layer: land/postback (Business Workflow)
 * @module land/postback/postback-dlq-evidence
 */

import { sha256Hex } from '@/seed/security/token-hash'

/**
 * Headers safe to retain verbatim for incident triage. All describe the
 * transport, none describe the caller's authority.
 *
 * Deliberately absent, and therefore dropped: `authorization`,
 * `proxy-authorization`, `cookie`, `set-cookie`, every signature header, and
 * `x-forwarded-for` — the last is client-controllable and is already excluded
 * from `source_ip`; retaining it here would reopen that same trust question.
 * `cf-connecting-ip` is captured as `source_ip` and is not duplicated here.
 */
const ALLOWED_HEADERS: readonly string[] = [
  'user-agent',
  'content-type',
  'content-length',
  'cf-ray',
  'cf-ipcountry',
  'cdn-loop',
]

/** Prefix marking a stored value as a one-way digest, never a credential. */
const FINGERPRINT_PREFIX = 'sigfp:'

/** Hex characters retained from the digest. */
const FINGERPRINT_LENGTH = 16

/** Bound on allowlisted header entries per capture, fingerprint aside. */
const MAX_HEADER_ENTRIES = 12

/** Bound on a retained header value. */
const MAX_HEADER_VALUE_LENGTH = 256

/** Bound on the retained canonical endpoint (`${origin}${pathname}`). */
const MAX_ENDPOINT_LENGTH = 512

/** Bound on the retained edge source IP string. */
const MAX_SOURCE_IP_LENGTH = 64

/** Bound on the retained raw body. */
const MAX_BODY_LENGTH = 8192

const TRUNCATED_SUFFIX = '…[TRUNCATED]'

/** The minimal header surface every supported request shape exposes. */
export interface DlqHeaderSource {
  get(name: string): string | null
}

function clipLength(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}${TRUNCATED_SUFFIX}`
    : value
}

function clipValue(value: string): string {
  return clipLength(value, MAX_HEADER_VALUE_LENGTH)
}

/**
 * Serialize DLQ header evidence as a JSON object string.
 *
 * Fail-closed by construction. The result contains only keys from
 * `ALLOWED_HEADERS` plus one `sigfp:` digest per declared signature header that
 * the request actually carried. A header source that throws yields `{}`: the
 * caller still returns its normal 4xx/5xx and merely loses diagnostics, which
 * is the correct trade when the alternative is dumping the whole header set.
 *
 * @param headers  Request headers (any case-insensitive `get`).
 * @param sigHeaders Header names the calling contract treats as signatures.
 *   Only their digests are retained, never their values.
 */
export async function serializeDlqHeaders(
  headers: DlqHeaderSource,
  sigHeaders: readonly string[] = [],
): Promise<string> {
  const captured: Record<string, string> = Object.create(null) as Record<string, string>

  try {
    for (const rawName of sigHeaders) {
      const name = rawName.toLowerCase()
      const value = headers.get(name)
      if (!value) continue
      const digest = await sha256Hex(value)
      captured[name] = `${FINGERPRINT_PREFIX}${digest.slice(0, FINGERPRINT_LENGTH)}`
    }

    let entries = 0
    for (const name of ALLOWED_HEADERS) {
      if (entries >= MAX_HEADER_ENTRIES) break
      if (Object.hasOwn(captured, name)) continue
      const value = headers.get(name)
      if (!value) continue
      captured[name] = clipValue(value)
      entries += 1
    }
  } catch {
    // A hostile or non-conforming header object must not be able to turn
    // evidence capture into a full header dump, nor fail the request.
    return JSON.stringify({})
  }

  return JSON.stringify(captured)
}

/**
 * Canonical endpoint identity for deduplication and storage: scheme, origin and
 * path — no query string.
 *
 * Query parameters routinely carry session ids, email addresses, tenant hints
 * and provider HMACs (Awin signs with `?signature=`). Retaining them would both
 * write provider credentials into the queue and mint a fresh dedup id for every
 * signed redelivery, defeating the very collapse that bounds storage growth.
 *
 * An unparseable URL yields the empty string rather than the raw input.
 */
export function serializeDlqEndpoint(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }
    return clipLength(`${parsed.origin}${parsed.pathname}`, MAX_ENDPOINT_LENGTH)
  } catch {
    return ''
  }
}

/**
 * Bound the retained edge source IP string so non-Cloudflare or test callers
 * cannot store an oversized value in `source_ip`.
 */
export function serializeDlqSourceIp(sourceIp: string | null | undefined): string | null {
  if (!sourceIp) return null
  return clipLength(sourceIp, MAX_SOURCE_IP_LENGTH)
}

/**
 * Bound the retained raw body. Legitimate postbacks are a few hundred bytes of
 * JSON; the cap exists so a caller cannot grow the queue by sending one large
 * body repeatedly. The truncation marker keeps the loss visible to an operator
 * instead of silently shortening the evidence.
 */
export function serializeDlqBody(rawBody: string): string {
  return clipLength(rawBody, MAX_BODY_LENGTH)
}

/** Test-facing view of the retention policy; not read by production paths. */
export const DLQ_EVIDENCE_POLICY = {
  allowedHeaders: ALLOWED_HEADERS,
  fingerprintPrefix: FINGERPRINT_PREFIX,
  fingerprintLength: FINGERPRINT_LENGTH,
  maxHeaderEntries: MAX_HEADER_ENTRIES,
  maxHeaderValueLength: MAX_HEADER_VALUE_LENGTH,
  maxEndpointLength: MAX_ENDPOINT_LENGTH,
  maxSourceIpLength: MAX_SOURCE_IP_LENGTH,
  maxBodyLength: MAX_BODY_LENGTH,
  truncatedSuffix: TRUNCATED_SUFFIX,
} as const
