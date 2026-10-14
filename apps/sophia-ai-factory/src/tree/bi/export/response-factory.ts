import type { ExportFormat, StreamingResponseOptions } from './types';
import { streamCsv } from './csv-formatter';
import { streamJsonArray } from './json-formatter';

/**
 * Creates a streaming HTTP Response for Next.js / Cloudflare Workers edge runtime.
 * Automatically injects Content-Type, Content-Disposition, and Cache-Control headers.
 */
export function createStreamingExportResponse(
  dataStream: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>,
  format: ExportFormat,
  filename: string,
  options?: StreamingResponseOptions,
): Response {
  let stream: ReadableStream<Uint8Array>;
  let contentType: string;
  let ext: string;

  if (format === 'csv') {
    contentType = 'text/csv; charset=utf-8';
    ext = '.csv';
    const headers = options?.headers ?? [];
    stream = streamCsv(headers, dataStream, options?.csvOptions);
  } else if (format === 'ndjson' || (format === 'json' && options?.jsonOptions?.ndjson)) {
    contentType = 'application/x-ndjson; charset=utf-8';
    ext = '.ndjson';
    stream = streamJsonArray(dataStream, { ...options?.jsonOptions, ndjson: true });
  } else {
    contentType = 'application/json; charset=utf-8';
    ext = '.json';
    stream = streamJsonArray(dataStream, options?.jsonOptions);
  }

  const cleanFilename = filename.endsWith(ext) ? filename : `${filename}${ext}`;

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${cleanFilename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
