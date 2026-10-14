/**
 * Null-stripping and summary/download JSON helpers for Usage Export.
 * @module land/usage-export/json-formatter-helpers
 */

import type {
  UsageExportRecord,
  UsageExportSummary,
  UsageExportResponse,
} from './types';

export interface JSONFormatOptions {
  /** Indentation spaces (default: 2) */
  indent?: number;
  /** Include null fields (default: false) */
  includeNulls?: boolean;
  /** Custom field filter */
  fieldFilter?: (key: string, value: unknown) => boolean;
}

/**
 * Remove null/undefined fields from object
 */
export function removeNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeNulls(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = removeNulls(value);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }

  return obj;
}

export function formatAsJSON(
  data: UsageExportRecord[] | UsageExportResponse,
  options: JSONFormatOptions = {},
): string {
  const { indent = 2, includeNulls = false } = options;
  const output = includeNulls ? data : removeNulls(data);
  return JSON.stringify(output, null, indent);
}

export function formatSummaryAsJSON(
  summary: UsageExportSummary,
  options?: JSONFormatOptions,
): string {
  const { indent = 2, includeNulls = false } = options || {};
  const output = includeNulls ? summary : removeNulls(summary);
  return JSON.stringify(output, null, indent);
}

export function createJSONDownload(
  response: UsageExportResponse,
  filename?: string,
): {
  content: string;
  filename: string;
  contentType: string;
} {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const defaultFilename = `usage-export-${timestamp}.json`;

  return {
    content: formatAsJSON(response),
    filename: filename || defaultFilename,
    contentType: 'application/json',
  };
}
