import { redactSecrets } from '@/seed/security/secret-redactor';

const SECRET_KEY_RE = /(?:^|[_-])(?:secret|password|passwd|token|authorization|apikey|api[_-]?key|cron[_-]?secret|auth[_-]?token|access[_-]?key|private[_-]?key|signing[_-]?key)(?:$|[_-])/i;

export function redactSecretKeys(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactSecrets(value);
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => redactSecretKeys(item, seen));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED-KEY]' : redactSecretKeys(v, seen);
    }
    return out;
  }
  return value;
}

export { redactSecrets, redactObjectSecrets, REDACTED_MARKER } from '@/seed/security/secret-redactor';

