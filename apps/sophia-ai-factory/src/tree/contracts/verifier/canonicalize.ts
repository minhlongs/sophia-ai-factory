/**
 * Deterministic RFC-8785 JSON Canonicalization Scheme (JCS).
 * - Sorts object keys lexicographically by UTF-16 code units
 * - Omit undefined values and functions
 * - Serializes primitives without non-significant whitespace
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
      return '';
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const elements = value.map((el) => {
      const canonical = canonicalizeJson(el);
      return canonical === '' ? 'null' : canonical;
    });
    return `[${elements.join(',')}]`;
  }

  // Value is an object (non-null, non-array)
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const val = record[key];
    if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
      continue;
    }
    const serializedVal = canonicalizeJson(val);
    entries.push(`${JSON.stringify(key)}:${serializedVal}`);
  }

  return `{${entries.join(',')}}`;
}
