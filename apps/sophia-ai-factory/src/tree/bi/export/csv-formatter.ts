import type { CsvFormatOptions } from './types';

/**
 * Escapes a single field according to RFC-4180 rules.
 *
 * - null / undefined -> ''
 * - Numbers and booleans -> string representation
 * - Objects / Arrays -> JSON.stringify
 * - If field contains delimiter, double quote, CR, or LF:
 *     wrap in double quotes and escape internal quotes as ""
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

  const bom = options?.includeBom ? '﻿' : '';
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
          controller.enqueue(encoder.encode('﻿'));
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
