const SECRET_KEY_RE = /(?:^|_)(?:secret|password|passwd|token|api[_-]?key|cron[_-]?secret|auth[_-]?token|access[_-]?key|private[_-]?key|signing[_-]?key)(?:$|_)/i;

export function redactSecretKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSecretKeys);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED-KEY]' : redactSecretKeys(v);
    }
    return out;
  }
  return value;
}
