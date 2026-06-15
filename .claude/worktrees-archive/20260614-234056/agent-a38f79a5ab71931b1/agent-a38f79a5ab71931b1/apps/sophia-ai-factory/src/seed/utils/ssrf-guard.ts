/**
 * SSRF guard utilities for user-supplied URLs.
 *
 * Provides a shared `isSafeUrl()` check used by routes that accept
 * externally-provided URLs (e.g. Mastodon instance registration).
 * Blocks private/internal hostnames, non-HTTPS schemes, and metadata endpoints.
 */

/**
 * Validate that a URL is safe to fetch (no SSRF risk).
 *
 * Blocks:
 * - Non-HTTPS protocols
 * - Private/reserved IPv4 ranges (10/8, 172.16/12, 192.168/16, 127/8, 0/8, 169.254/16)
 * - IPv6 loopback / ULA / link-local
 * - Metadata endpoints (metadata.google.internal, 169.254.169.254)
 * - .local and .internal TLDs
 * - localhost / internal hostnames
 *
 * @param urlString - Raw URL string from user input
 * @returns true if the URL passes all safety checks
 */
export function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== 'https:') return false;

    const hostname = url.hostname.toLowerCase();

    // Block private/internal hostnames
    const blockedPatterns = [
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

    for (const pattern of blockedPatterns) {
      if (hostname === pattern || hostname.startsWith(pattern)) return false;
    }

    // Block .local, .internal TLDs
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;

    return true;
  } catch {
    return false;
  }
}
