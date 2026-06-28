/**
 * SSRF guard for user-supplied URLs.
 *
 * Validates that a URL is safe to fetch externally — blocks internal/private
 * IPs, non-HTTPS, and metadata endpoints. Returns true if safe, false otherwise.
 *
 * Used by: mastodon/connect (prevents SSRF via instanceUrl)
 *          discovery/validate-link (existing consumer)
 */

const BLOCKED_HOSTNAME_PATTERNS: string[] = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // Cloud metadata endpoint
  'metadata.google.internal',
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '[::1]',
  'internal',
];

export function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== 'https:') return false;

    const hostname = url.hostname.toLowerCase();

    // Block private/internal hostnames
    for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
      if (hostname === pattern || hostname.startsWith(pattern)) return false;
    }

    // Block .local, .internal TLDs
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;

    return true;
  } catch {
    return false;
  }
}
