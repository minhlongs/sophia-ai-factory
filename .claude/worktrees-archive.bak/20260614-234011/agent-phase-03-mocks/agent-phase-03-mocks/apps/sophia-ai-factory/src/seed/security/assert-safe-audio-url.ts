/**
 * SSRF guard for user-supplied audio URLs.
 *
 * Rejects non-http(s) schemes, private/loopback/link-local IPv4 ranges,
 * IPv6 loopback/ULA/link-local, and anything that parses as a bare IP
 * in a private range. Intended for any land-layer fetch of customer-provided
 * audio sample URLs (e.g. clone-voice).
 *
 * Throws Error on any blocked URL; returns void on safe URLs.
 */

/** Private/reserved IPv4 CIDR prefix checks (string-match only, no DNS). */
const BLOCKED_IPV4_PREFIXES: Array<{ prefix: string; label: string }> = [
  { prefix: '10.', label: '10/8 private' },
  { prefix: '127.', label: '127/8 loopback' },
  { prefix: '169.254.', label: '169.254/16 link-local' },
  { prefix: '192.168.', label: '192.168/16 private' },
  { prefix: '0.', label: '0/8 this-network' },
];

/** 172.16.0.0/12 spans 172.16.x.x – 172.31.x.x */
function isRfc1918_172(hostname: string): boolean {
  const m = hostname.match(/^172\.(\d{1,3})\./);
  if (!m) return false;
  const second = parseInt(m[1], 10);
  return second >= 16 && second <= 31;
}

const BLOCKED_IPV6: RegExp[] = [
  /^\[?::1\]?$/, // loopback
  /^\[?::ffff:/i, // IPv4-mapped
  /^\[?fe80:/i, // link-local
  /^\[?fc[0-9a-f]{2}:/i, // ULA fc00::/7 (fc)
  /^\[?fd[0-9a-f]{2}:/i, // ULA fc00::/7 (fd)
];

/**
 * Assert that `url` is safe to fetch as a user-supplied audio source.
 * Throws with a descriptive message if the URL is blocked.
 */
export function assertSafeAudioUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[assertSafeAudioUrl] Malformed URL: ${url}`);
  }

  const { protocol, hostname } = parsed;

  // Only http(s) — reject file://, ftp://, data://, etc.
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`[assertSafeAudioUrl] Blocked scheme "${protocol}" — only http/https allowed`);
  }

  // IPv6 blocked ranges (hostname may be bracketed [::1])
  for (const re of BLOCKED_IPV6) {
    if (re.test(hostname)) {
      throw new Error(`[assertSafeAudioUrl] Blocked IPv6 address: ${hostname}`);
    }
  }

  // IPv4 private / reserved prefixes
  for (const { prefix, label } of BLOCKED_IPV4_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      throw new Error(`[assertSafeAudioUrl] Blocked ${label} address: ${hostname}`);
    }
  }
  if (isRfc1918_172(hostname)) {
    throw new Error(`[assertSafeAudioUrl] Blocked 172.16/12 private address: ${hostname}`);
  }

  // Bare "localhost" label
  if (hostname === 'localhost' || hostname === 'localhost.') {
    throw new Error(`[assertSafeAudioUrl] Blocked localhost: ${hostname}`);
  }
}
