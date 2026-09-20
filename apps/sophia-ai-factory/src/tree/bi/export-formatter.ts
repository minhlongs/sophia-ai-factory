/**
 * RFC-4180 Compliant CSV Serializer & Streaming JSON Generator
 *
 * Provides pure domain logic for formatting executive BI and analytics exports:
 * - RFC-4180 CSV serialization (double-quote escaping, CRLF line breaks, custom delimiters).
 * - Web Streams API integration (ReadableStream<Uint8Array>) for memory-efficient streaming on edge.
 * - Deterministic JSON array and NDJSON generators with empty-set handling.
 * - HTTP Streaming Response factory for Next.js / Cloudflare Workers.
 *
 * Layer: tree/bi (Pure domain - imports only seed and standard Web APIs)
 *
 * @module tree/bi/export-formatter
 */

export type ExportFormat = 'csv' | 'json' | 'ndjson';

export interface CsvFormatOptions {
  /** Column delimiter character. Default: ',' */
  delimiter?: string;
  /** Record line ending. Default: '\r\n' (CRLF per RFC-4180) */
  lineEnding?: '\r\n' | '\n';
  /** Explicit list of column headers. If omitted, keys of the first row are used. */
  headers?: string[];
  /** Prefix with UTF-8 BOM (\uFEFF) for Excel compatibility. Default: false */
  includeBom?: boolean;
  /** Sanitize leading formula characters (=, +, -, @) to prevent CSV injection. Default: false */
  sanitizeFormulas?: boolean;
}

export interface JsonFormatOptions {
  /** Indentation spaces. Default: 2. Set to 0 for compact JSON. */
  indent?: number;
  /** Format as Newline-Delimited JSON (NDJSON). Default: false */
  ndjson?: boolean;
}

export interface StreamingResponseOptions {
  headers?: string[];
  csvOptions?: CsvFormatOptions;
  jsonOptions?: JsonFormatOptions;
}

/**
 * Escapes a single field according to RFC-4180 rules.
 *
 * - null / undefined -> ''
 * - Numbers and booleans -> string representation
 * - Objects / Arrays -> JSON.stringify
 * - If field contains delimiter, double quote, CR, or LF:
 *     wrap in double quotes and escape internal quotes as ""
 *
 * @param val - The raw field value
 * @param delimiter - Delimiter character (default: ',')
 * @param sanitizeFormulas - If true, prefixes leading formula chars with single quote
 */
export function escapeCsvField(
  val: unknown,
  delimiter = ',',
  sanitizeFormulas = false,
): string {
  if (val === null || val === undefined) return '';

  let str = typeof val === 'object' && !(val instanceof Date)
    ? JSON.stringify(val)
    : String(val);

  if (sanitizeFormulas && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC-4180 §2.5, §2.6: Quote if field contains delimiter, quote, CR, or LF
  const needsQuotes =
    str.includes('"') ||
    str.includes(delimiter) ||
    str.includes('\n') ||
    str.includes('\r');

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * In-memory synchronous CSV formatter matching test harness contract.
 *
 * @param headers - Array of column header names
 * @param rows - Array of row objects
 * @param options - CSV formatting options
 */
export function formatStreamingCsv(
  headers: string[],
  rows: Record<string, unknown>[],
  options?: CsvFormatOptions,
): string {
  const delimiter = options?.delimiter ?? ',';
  const lineEnding = options?.lineEnding ?? '\r\n';
  const sanitize = options?.sanitizeFormulas ?? false;

  const headerLine = headers.map((h) => escapeCsvField(h, delimiter, false)).join(delimiter);
  const rowLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h], delimiter, sanitize)).join(delimiter)
  );

  const bom = options?.includeBom ? '\uFEFF' : '';
  return bom + [headerLine, ...rowLines].join(lineEnding);
}

/**
 * Streams CSV rows from an AsyncIterable into a Web ReadableStream of Uint8Array chunks.
 * Memory complexity: O(1) buffer per record.
 */
export function streamCsv(
  headers: string[],
  rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>,
  options?: CsvFormatOptions,
): ReadableStream<Uint8Array> {
  const delimiter = options?.delimiter ?? ',';
  const lineEnding = options?.lineEnding ?? '\r\n';
  const sanitize = options?.sanitizeFormulas ?? false;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (options?.includeBom) {
          controller.enqueue(encoder.encode('\uFEFF'));
        }

        // Emit header line
        const headerLine = headers.map((h) => escapeCsvField(h, delimiter, false)).join(delimiter);
        controller.enqueue(encoder.encode(headerLine + lineEnding));

        // Stream each row
        for await (const row of rows) {
          const rowLine = headers.map((h) => escapeCsvField(row[h], delimiter, sanitize)).join(delimiter);
          controller.enqueue(encoder.encode(rowLine + lineEnding));
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Streams a JSON array or NDJSON from an AsyncIterable.
 * Handles empty sets correctly: outputs "[]" when 0 records are present (RFC/Test F5-2).
 */
export function streamJsonArray<T = unknown>(
  items: AsyncIterable<T> | Iterable<T>,
  options?: JsonFormatOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const isNdjson = options?.ndjson ?? false;
  const indent = options?.indent ?? 2;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (isNdjson) {
          for await (const item of items) {
            controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'));
          }
          controller.close();
          return;
        }

        let count = 0;
        const prefixSpaces = ' '.repeat(indent);

        for await (const item of items) {
          count++;
          const formattedItem = indent > 0
            ? JSON.stringify(item, null, indent).replace(/\n/g, `\n${prefixSpaces}`)
            : JSON.stringify(item);

          if (count === 1) {
            controller.enqueue(encoder.encode(`[\n${prefixSpaces}${formattedItem}`));
          } else {
            controller.enqueue(encoder.encode(`,\n${prefixSpaces}${formattedItem}`));
          }
        }

        if (count === 0) {
          // Empty dataset contract: F5-2
          controller.enqueue(encoder.encode('[]'));
        } else {
          controller.enqueue(encoder.encode('\n]'));
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

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
