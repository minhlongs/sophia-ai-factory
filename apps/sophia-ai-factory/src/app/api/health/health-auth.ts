/**
 * Health endpoint bearer token verification (constant-time compare).
 * Layer: App Router API Route support.
 */

export function verifyHealthToken(request: Request | undefined, healthToken: string | undefined): boolean {
  if (!request) return false;
  const trimmed = healthToken?.trim();
  if (!trimmed) return false;
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${trimmed}`;
  if (auth.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i += 1) result |= expected.charCodeAt(i) ^ auth.charCodeAt(i);
  return result === 0;
}
