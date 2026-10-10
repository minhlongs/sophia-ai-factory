/**
 * Webhook URL validation, event matching, and ID/secret generators
 */

/**
 * Validates that a webhook URL is present and strictly uses the HTTPS protocol.
 * Throws an Error with 'INVALID_WEBHOOK_URL' code if validation fails.
 */
export function validateWebhookUrl(url: string | null | undefined): void {
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol');
    }
  } catch {
    throw new Error('INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol');
  }
}

/**
 * Evaluates whether an event name matches any of the subscribed event patterns.
 * Supports:
 * - Exact matching: 'video.rendered' === 'video.rendered'
 * - Global wildcard: '*' matches any event
 * - Namespace wildcard: 'video.*' matches 'video.rendered', 'video.failed', etc.
 */
export function isEventSubscribed(subscribedEvents: string[], event: string): boolean {
  if (!Array.isArray(subscribedEvents) || subscribedEvents.length === 0) {
    return false;
  }

  if (subscribedEvents.includes('*')) {
    return true;
  }

  if (subscribedEvents.includes(event)) {
    return true;
  }

  return subscribedEvents.some((pattern) => {
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1); // e.g. "video."
      return event.startsWith(prefix);
    }
    return false;
  });
}

/**
 * Generates an endpoint ID conforming to the 'wep_' prefix format.
 */
export function generateEndpointId(): string {
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  return `wep_${rand}`;
}

/**
 * Generates a high-entropy webhook signing secret conforming to 'whsec_'.
 */
export function generateEndpointSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `whsec_${hex}`;
}

/**
 * Asserts tenant matching for operations on existing records.
 * Throws an error matching /CROSS_TENANT_VIOLATION/ without importing from forest layer.
 */
export function assertOrgScope(expectedOrgId: string, actualOrgId: string): void {
  const expected = (expectedOrgId || '').trim();
  const actual = (actualOrgId || '').trim();

  if (!expected || !actual || expected !== actual) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: Current org context '${expected || '<EMPTY>'}' is not authorized to access resource in org '${actual || '<EMPTY>'}'`
    );
  }
}
