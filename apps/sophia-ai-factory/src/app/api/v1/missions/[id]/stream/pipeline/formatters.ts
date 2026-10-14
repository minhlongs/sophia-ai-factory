/**
 * Mission SSE Stream Encoders and Formatters
 *
 * Layer: app/api/v1/missions/[id]/stream/pipeline
 */

export function safeParseResult(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { _parse_error: true, raw: raw.slice(0, 200) };
  }
}

/**
 * Builds a full SSE message block with mandatory `id:` cursor line.
 * The `id:` line is required for browser EventSource to set Last-Event-ID
 * automatically on reconnect (per SSE spec §9.2.6).
 */
export function sseMessage(event: string, data: unknown, cursor: number | null = null): string {
  const idLine = cursor !== null ? `id: ${cursor}\n` : '';
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** SSE keepalive comment line - does NOT set Last-Event-ID (per SSE spec). */
export function sseHeartbeat(ts: number): string {
  return `: ping ${ts}\n\n`;
}
