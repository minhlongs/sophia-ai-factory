export type ExportFormat = 'csv' | 'json' | 'ndjson';

export interface CsvFormatOptions {
  /** Column delimiter character. Default: ',' */
  delimiter?: string;
  /** Record line ending. Default: '\r\n' (CRLF per RFC-4180) */
  lineEnding?: '\r\n' | '\n';
  /** Explicit list of column headers. If omitted, keys of the first row are used. */
  headers?: string[];
  /** Prefix with UTF-8 BOM (﻿) for Excel compatibility. Default: false */
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
