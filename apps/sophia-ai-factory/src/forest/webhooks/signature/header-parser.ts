/** Parse `t=<ts>,v1=<hex>` header. Returns null on malformed input. */
export function parseHeader(header: string): { ts: number; v1: string } | null {
  let ts: number | undefined;
  let v1: string | undefined;

  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === 't') ts = parseInt(v, 10);
    if (k === 'v1') v1 = v;
  }

  if (ts === undefined || isNaN(ts) || !v1) return null;
  return { ts, v1 };
}
