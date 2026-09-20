# Handoff Report: Streaming Export API & RFC-4180 Serialization

**Agent**: `teamwork_preview_explorer_m3_3`  
**Milestone**: Milestone 3 (Executive BI & Automated Reporting Engine)  
**Date**: 2026-09-20  
**Status**: Complete (Hard Handoff)  
**Target Files Designed**:
1. `apps/sophia-ai-factory/src/tree/bi/export-formatter.ts` (Pure domain serializer & Web Streams generator)
2. `apps/sophia-ai-factory/src/app/api/v1/analytics/export/route.ts` (Streaming Edge API Route Handler)

---

## 1. Observation

Direct observations and evidence gathered from the codebase, test harness, migration files, and existing export routes:

### 1.1 E2E Test Contract (`apps/sophia-ai-factory/src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts`)
The contract for executive BI analytics export is codified in Tier 1 (Features F4 & F5), Tier 2 (Boundary B4 & B5), Tier 3 (P2), and Tier 4 (S1):
- **Feature F4: Streaming CSV Export with RFC-4180 Compliance** (Lines 263–298):
  - `F4-1`: Generates valid RFC-4180 CSV header and rows separated by `\r\n`.
    ```typescript
    const headers = ['period', 'mrr_usd', 'throughput', 'roi'];
    const rows = [
      { period: '2024-06', mrr_usd: '3000.00', throughput: 100, roi: '3.0x' },
      { period: '2024-07', mrr_usd: '4500.00', throughput: 150, roi: '3.5x' },
    ];
    const csv = formatStreamingCsv(headers, rows);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('period,mrr_usd,throughput,roi');
    expect(lines[1]).toBe('2024-06,3000.00,100,3.0x');
    ```
  - `F4-2`: Escapes fields containing commas by enclosing in double quotes:
    `escapeCsvField('Agency, Inc.')` -> `'"Agency, Inc."'`.
  - `F4-3`: Escapes fields containing double quotes by doubling inner quotes:
    `escapeCsvField('The "Best" Agency')` -> `'"The ""Best"" Agency"'`.
  - `F4-4`: Escapes fields containing newlines (`\n` and `\r\n`) by enclosing in double quotes:
    `escapeCsvField('Line 1\nLine 2')` -> `'"Line 1\nLine 2"'`.
    `escapeCsvField('Line 1\r\nLine 2')` -> `'"Line 1\r\nLine 2"'`.
  - `F4-5`: Safely handles `null` -> `''`, `undefined` -> `''`, `12345` -> `'12345'`, `true` -> `'true'`.
- **Feature F5: Streaming Structured JSON Export** (Lines 300–342):
  - `F5-1`: Formats array of records as valid JSON array parseable via `JSON.parse`.
  - `F5-2`: Handles empty record list returning `[]`.
  - `F5-3`: Preserves nested metadata structures (e.g. `metrics: { channels: ['tiktok', 'youtube'] }`).
  - `F5-4`: Serializes numbers and timestamps deterministically without floating-point precision loss.
  - `F5-5`: Formats streaming chunks as Newline-Delimited JSON (NDJSON): each line is a valid JSON object ending with `\n`.
- **Tier 2 Boundary B4** (Lines 395–409):
  - Multi-column escaping in a single row: `'Field with "quotes" and, commas'` -> `'"Field with ""quotes"" and, commas"'`, `'Multi\r\nLine'` -> `'"Multi\r\nLine"'`.
- **Tier 2 Boundary B5** (Lines 411–436):
  - Strict date bounding: queries must filter with `period_start >= ?` and `period_end <= ?` and exclude records outside the window.
- **Tier 3 Combination P2 & Tier 4 Scenario S1** (Lines 473–569):
  - Executive BI metrics aggregate output feeds directly into `formatStreamingCsv` with headers `['channel', 'mrr_cents', 'throughput', 'revenue_cents', 'spend_cents']`.

### 1.2 Test Harness Implementation (`apps/sophia-ai-factory/src/__tests__/e2e/enterprise/enterprise-test-harness.ts`)
Lines 808–821 implement the baseline sync CSV formatter:
```typescript
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatStreamingCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCsvField).join(',');
  const rowLines = rows.map((row) => headers.map((h) => escapeCsvField(row[h])).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}
```

### 1.3 Table Schema & Data Source (`executive_bi_metrics`)
From `enterprise-test-harness.ts` (lines 115–126):
```sql
CREATE TABLE IF NOT EXISTS executive_bi_metrics (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  throughput_count INTEGER NOT NULL DEFAULT 0,
  viral_score REAL NOT NULL DEFAULT 0,
  affiliate_revenue_cents INTEGER NOT NULL DEFAULT 0,
  marketing_spend_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### 1.4 Tenant Isolation Guard (`apps/sophia-ai-factory/src/forest/tenant/isolation-guard.ts`)
Lines 43–71 define `assertTenantScope(currentOrgId, targetResourceOrgId)`:
- If `currentOrgId` or `targetResourceOrgId` is empty or mismatched, throws `CrossTenantViolationError` with `.code = 'CROSS_TENANT_VIOLATION'` and status 403.
- In `route.ts`, when a client specifies a target `org_id` in query params or headers, `assertTenantScope(userOrgId, targetOrgId)` must be called before querying D1.

### 1.5 Layer Boundary Check (`apps/sophia-ai-factory/scripts/check-layer-boundaries.sh`)
- `src/tree/` CANNOT import from `@/forest` or `@/land`.
- `src/tree/bi/export-formatter.ts` must only import from `@/seed/*` (or standard Web Streams APIs).
- `src/app/api/v1/analytics/export/route.ts` is in `src/app/` and can import from `@/seed`, `@/tree`, and `@/forest`.

---

## 2. Logic Chain

### 2.1 RFC-4180 Serialization Rules
1. *Observation*: RFC-4180 requires records to be separated by CRLF (`\r\n`). Tests `F4-1` and `B4` split by `\r\n` and assert line count.
2. *Deduction*: Default line ending must be `\r\n`. An optional config can permit `\n` if explicitly configured.
3. *Observation*: Fields containing `,`, `"`, `\n`, or `\r` must be enclosed in double quotes. Internal quotes must be escaped as `""` (Tests `F4-2`, `F4-3`, `F4-4`).
4. *Deduction*: When `delimiter` is parameterized (e.g. `;` or `\t`), the character set that triggers quoting must dynamically include the chosen delimiter.
5. *Observation*: `null` and `undefined` must yield empty strings (`""`), while numbers and booleans must be stringified directly without quotes (Test `F4-5`). Objects and arrays should be JSON-stringified and escaped.

### 2.2 Streaming vs In-Memory Performance on Cloudflare Workers
1. *Observation*: Cloudflare Workers edge runtime has a 128MB memory limit per isolate. Buffering a 50,000-row CSV or JSON payload in a single string risks isolate termination (OOM).
2. *Deduction*: The production service must provide both:
   - Synchronous `formatStreamingCsv` for in-memory datasets and test harness compatibility.
   - Web Streams `ReadableStream<Uint8Array>` generators (`streamCsv`, `streamJsonArray`, `streamNdjson`) that encode chunks on the fly via `TextEncoder`.
3. *Observation*: In JSON array streaming (`streamJsonArray`), an empty dataset must serialize as `[]` (Test `F5-2`), whereas a populated stream must serialize as `[\n  {...},\n  {...}\n]`.
4. *Deduction*: The streaming controller must defer emitting the opening `[\n` until the first record is yielded. If the iterable finishes without yielding any records, it emits `[]`. If it yields records, subsequent records are prefixed with `,\n  `, and the stream is closed with `\n]`.

### 2.3 Edge API Route Architecture (`/api/v1/analytics/export`)
1. *Observation*: The route handler must support both GET (browser downloads with query parameters) and POST (automated integrations with JSON request body).
2. *Security Deduction*:
   - Step 1: Session authentication via `getCurrentUser()`. If unauthenticated -> HTTP 401 (`UNAUTHORIZED`).
   - Step 2: D1 database availability check via `getD1()`. If unavailable -> HTTP 503 (`DB_UNAVAILABLE`).
   - Step 3: Org context resolution via `resolveOrgId(user.id, db)`. If no org context -> HTTP 403 (`FORBIDDEN`).
   - Step 4: Strict tenant boundary check via `assertTenantScope(currentOrgId, requestedOrgId)`. Mismatches throw `CrossTenantViolationError` -> HTTP 403 (`CROSS_TENANT_VIOLATION`).
   - Step 5: Input validation:
     - `format`: `'csv' | 'json' | 'ndjson'` (default `'csv'`).
     - `start`, `end`: epoch ms timestamps. Must be valid positive numbers, `start <= end`, max span 365 days. Invalid -> HTTP 400 (`INVALID_DATE_RANGE`).
   - Step 6: Query D1 for `executive_bi_metrics` filtered strictly by `org_id = ? AND period_start >= ? AND period_end <= ?`.
   - Step 7: Stream response using `createStreamingExportResponse(stream, format, filename)` with appropriate headers:
     - CSV: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="..."`
     - JSON: `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="..."`
     - NDJSON: `Content-Type: application/x-ndjson; charset=utf-8`, `Content-Disposition: attachment; filename="..."`
     - `Cache-Control: no-cache, no-store, must-revalidate`
     - `X-Content-Type-Options: nosniff`

---

## 3. Caveats

1. **Excel BOM (Byte Order Mark)**:
   - Microsoft Excel on Windows may misinterpret UTF-8 CSV files with non-ASCII characters (e.g. Vietnamese accents like `Tiếng Việt`) unless prefixed with UTF-8 BOM (`\uFEFF`).
   - *Design Choice*: Add an optional `includeBom: boolean` option in `CsvFormatOptions`. It defaults to `false` for standard RFC-4180 compliance, but can be enabled for Excel exports.
2. **Formula Injection (CSV Injection / DDE)**:
   - Cells beginning with `=`, `+`, `-`, `@` can execute macros in spreadsheet software.
   - *Design Choice*: In `executive-bi.e2e.test.ts` (F4-1), values like `2024-06` and `3.0x` are standard strings without escaping prefix. We preserve standard RFC-4180 compliance by default, and provide an opt-in `sanitizeFormulas?: boolean` option to prefix dangerous leading characters with `'` when exporting untrusted user-generated content.
3. **D1 Query Result Sizes**:
   - D1 currently returns up to 10,000 rows per query. For extremely large exports (>10k rows), the route generator should page through results using `LIMIT ? OFFSET ?` or keyset pagination `WHERE id > ? LIMIT ?` to stream arbitrarily large datasets without exceeding D1 batch limits.

---

## 4. Conclusion & Technical Blueprint

### 4.1 Specification of `apps/sophia-ai-factory/src/tree/bi/export-formatter.ts`

```typescript
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
```

---

### 4.2 Specification of `apps/sophia-ai-factory/src/app/api/v1/analytics/export/route.ts`

```typescript
/**
 * API Route: Streaming Analytics & Executive BI Export
 *
 * Endpoint: /api/v1/analytics/export
 *
 * Supports:
 * - GET: Browser direct downloads via query parameters
 * - POST: Programmatic export queries with JSON filter payload
 *
 * Formats:
 * - format=csv (RFC-4180 with quote escaping and CRLF)
 * - format=json (Structured streaming JSON array)
 * - format=ndjson (Newline-delimited JSON stream)
 *
 * Security & Isolation:
 * - Better Auth session authentication (401 on missing session)
 * - Multi-tenant isolation enforcement (assertTenantScope, 403 on mismatch)
 * - Input validation on date range (start, end, max 365 days)
 *
 * Layer: app/api/v1/analytics/export
 *
 * @module app/api/v1/analytics/export/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { assertTenantScope, CrossTenantViolationError } from '@/forest/tenant/isolation-guard';
import {
  createStreamingExportResponse,
  type ExportFormat,
} from '@/tree/bi/export-formatter';

export const runtime = 'edge';

interface ExportQueryParams {
  format?: string | null;
  start?: string | null;
  end?: string | null;
  category?: string | null;
  orgId?: string | null;
}

const DEFAULT_HEADERS = [
  'id',
  'org_id',
  'period_start',
  'period_end',
  'mrr_usd',
  'throughput',
  'viral_score',
  'affiliate_revenue_usd',
  'marketing_spend_usd',
  'roi',
  'created_at',
];

const SUMMARY_HEADERS = [
  'org_id',
  'period_start',
  'period_end',
  'peak_mrr_usd',
  'total_throughput',
  'average_viral_score',
  'total_affiliate_revenue_usd',
  'total_marketing_spend_usd',
  'roi_multiplier',
  'record_count',
];

/**
 * Generator function that fetches records from Cloudflare D1 in batches
 * and yields normalized objects for streaming serialization.
 */
async function* fetchExecutiveBIMetricsStream(
  db: D1Database,
  orgId: string,
  startTimestamp: number,
  endTimestamp: number,
  category?: string,
): AsyncGenerator<Record<string, unknown>> {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  if (category === 'summary') {
    // Single summary aggregation row
    const query = `
      SELECT
        org_id,
        MAX(mrr_cents) AS peak_mrr_cents,
        SUM(throughput_count) AS total_throughput,
        AVG(viral_score) AS avg_viral_score,
        SUM(affiliate_revenue_cents) AS total_affiliate_cents,
        SUM(marketing_spend_cents) AS total_spend_cents,
        COUNT(*) AS row_count
      FROM executive_bi_metrics
      WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
      GROUP BY org_id
    `;
    const res = await db.prepare(query).bind(orgId, startTimestamp, endTimestamp).first<{
      org_id: string;
      peak_mrr_cents: number;
      total_throughput: number;
      avg_viral_score: number;
      total_affiliate_cents: number;
      total_spend_cents: number;
      row_count: number;
    }>();

    if (res && res.row_count > 0) {
      const spend = res.total_spend_cents ?? 0;
      const aff = res.total_affiliate_cents ?? 0;
      const roiRatio = spend > 0 ? Number((aff / spend).toFixed(2)) : aff > 0 ? 99.0 : 0;

      yield {
        org_id: res.org_id,
        period_start: new Date(startTimestamp).toISOString(),
        period_end: new Date(endTimestamp).toISOString(),
        peak_mrr_usd: ((res.peak_mrr_cents ?? 0) / 100).toFixed(2),
        total_throughput: res.total_throughput ?? 0,
        average_viral_score: Number((res.avg_viral_score ?? 0).toFixed(2)),
        total_affiliate_revenue_usd: (aff / 100).toFixed(2),
        total_marketing_spend_usd: (spend / 100).toFixed(2),
        roi_multiplier: `${roiRatio}x`,
        record_count: res.row_count,
      };
    }
    return;
  }

  // Paged cursor stream for detailed rows
  while (hasMore) {
    const query = `
      SELECT id, org_id, period_start, period_end, mrr_cents, throughput_count,
             viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at
      FROM executive_bi_metrics
      WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
      ORDER BY period_start ASC
      LIMIT ?4 OFFSET ?5
    `;
    const batch = await db.prepare(query)
      .bind(orgId, startTimestamp, endTimestamp, PAGE_SIZE, offset)
      .all<{
        id: string;
        org_id: string;
        period_start: number;
        period_end: number;
        mrr_cents: number;
        throughput_count: number;
        viral_score: number;
        affiliate_revenue_cents: number;
        marketing_spend_cents: number;
        created_at: number;
      }>();

    const results = batch.results ?? [];
    if (results.length === 0) {
      break;
    }

    for (const row of results) {
      const spend = row.marketing_spend_cents ?? 0;
      const aff = row.affiliate_revenue_cents ?? 0;
      const roi = spend > 0 ? Number((aff / spend).toFixed(2)) : aff > 0 ? 99.0 : 0;

      yield {
        id: row.id,
        org_id: row.org_id,
        period_start: new Date(row.period_start).toISOString(),
        period_end: new Date(row.period_end).toISOString(),
        mrr_usd: (row.mrr_cents / 100).toFixed(2),
        throughput: row.throughput_count,
        viral_score: row.viral_score,
        affiliate_revenue_usd: (aff / 100).toFixed(2),
        marketing_spend_usd: (spend / 100).toFixed(2),
        roi: `${roi}x`,
        created_at: new Date(row.created_at).toISOString(),
      };
    }

    offset += results.length;
    if (results.length < PAGE_SIZE) {
      hasMore = false;
    }
  }
}

async function handleExportRequest(
  params: ExportQueryParams,
  req: NextRequest,
): Promise<Response> {
  // 1. Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required for analytics export' },
      { status: 401 },
    );
  }

  // 2. Database client lookup
  const db = await getD1();
  if (!db) {
    return NextResponse.json(
      { error: 'DB_UNAVAILABLE', message: 'Database connection unavailable' },
      { status: 503 },
    );
  }

  // 3. Resolve caller active organization
  const currentOrgId = await resolveOrgId(user.id, db);
  if (!currentOrgId) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'User is not associated with an active organization' },
      { status: 403 },
    );
  }

  // 4. Assert tenant isolation scope against requested org
  const requestedOrgId = (params.orgId || currentOrgId).trim();
  try {
    assertTenantScope(currentOrgId, requestedOrgId);
  } catch (err) {
    if (err instanceof CrossTenantViolationError) {
      logger.warn('[API:Export] Cross-tenant export attempt blocked', {
        userId: user.id,
        currentOrgId,
        requestedOrgId,
      });
      return NextResponse.json(
        { error: 'CROSS_TENANT_VIOLATION', message: err.message, code: err.code },
        { status: 403 },
      );
    }
    throw err;
  }

  // 5. Parse and validate format
  const rawFormat = (params.format || 'csv').toLowerCase().trim();
  if (rawFormat !== 'csv' && rawFormat !== 'json' && rawFormat !== 'ndjson') {
    return NextResponse.json(
      { error: 'INVALID_FORMAT', message: "Format must be 'csv', 'json', or 'ndjson'" },
      { status: 400 },
    );
  }
  const format = rawFormat as ExportFormat;

  // 6. Parse and validate date range
  const now = Date.now();
  const startTimestamp = params.start ? Number(params.start) : now - 30 * 86400 * 1000;
  const endTimestamp = params.end ? Number(params.end) : now;

  if (isNaN(startTimestamp) || isNaN(endTimestamp) || startTimestamp <= 0 || endTimestamp <= 0) {
    return NextResponse.json(
      { error: 'INVALID_DATE_RANGE', message: 'start and end must be valid positive timestamps in milliseconds' },
      { status: 400 },
    );
  }

  if (startTimestamp > endTimestamp) {
    return NextResponse.json(
      { error: 'INVALID_DATE_RANGE', message: 'start timestamp cannot be greater than end timestamp' },
      { status: 400 },
    );
  }

  const maxRangeMs = 365 * 86400 * 1000;
  if (endTimestamp - startTimestamp > maxRangeMs) {
    return NextResponse.json(
      { error: 'INVALID_DATE_RANGE', message: 'Date range cannot exceed 365 days' },
      { status: 400 },
    );
  }

  const category = (params.category || 'all').toLowerCase().trim();
  const headers = category === 'summary' ? SUMMARY_HEADERS : DEFAULT_HEADERS;

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `analytics-export-${currentOrgId}-${dateStr}`;

  logger.info('[API:Export] Initiating streaming analytics export', {
    orgId: currentOrgId,
    format,
    startTimestamp,
    endTimestamp,
    category,
  });

  // 7. Stream generator into response
  const dataStream = fetchExecutiveBIMetricsStream(
    db,
    currentOrgId,
    startTimestamp,
    endTimestamp,
    category,
  );

  return createStreamingExportResponse(dataStream, format, filename, {
    headers,
    csvOptions: {
      delimiter: ',',
      lineEnding: '\r\n',
      headers,
    },
    jsonOptions: {
      indent: 2,
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: ExportQueryParams = {
      format: searchParams.get('format'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      category: searchParams.get('category'),
      orgId: searchParams.get('org_id') || searchParams.get('orgId'),
    };

    return await handleExportRequest(params, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API:Export] Export failure', { error: message });
    return NextResponse.json(
      { error: 'EXPORT_FAILED', message: 'Internal server error during analytics export' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body: ExportQueryParams = {};
    try {
      body = (await request.json()) as ExportQueryParams;
    } catch {
      // Body is empty or not JSON, fallback to query parameters
    }

    const searchParams = request.nextUrl.searchParams;
    const params: ExportQueryParams = {
      format: body.format || searchParams.get('format'),
      start: body.start !== undefined ? String(body.start) : searchParams.get('start'),
      end: body.end !== undefined ? String(body.end) : searchParams.get('end'),
      category: body.category || searchParams.get('category'),
      orgId: body.orgId || searchParams.get('org_id') || searchParams.get('orgId'),
    };

    return await handleExportRequest(params, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API:Export] Export failure', { error: message });
    return NextResponse.json(
      { error: 'EXPORT_FAILED', message: 'Internal server error during analytics export' },
      { status: 500 },
    );
  }
}
```

---

## 5. Verification Method

### 5.1 Independent E2E Test Verification
Run the existing enterprise executive BI E2E test suite:
```bash
cd apps/sophia-ai-factory
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vitest run src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts
```
**Verification Invalidation Condition**:
- Any failure in F4 (F4-1 through F4-5), F5 (F5-1 through F5-5), B4, B5, P2, or S1.
- Line splits failing on `\r\n`.
- Quote escaping failing on `""`.

### 5.2 Layer Architecture Boundary Verification
Run the architecture boundary linter:
```bash
cd apps/sophia-ai-factory
bash scripts/check-layer-boundaries.sh
```
**Verification Invalidation Condition**:
- Any `from '@/forest'` or `from '@/land'` in `src/tree/bi/export-formatter.ts`.
- Exit code != 0.

### 5.3 TypeScript Compilation Check
Execute TypeScript strict compilation:
```bash
cd apps/sophia-ai-factory
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npm run type-check
```
**Verification Invalidation Condition**:
- Any compilation errors in `src/tree/bi/export-formatter.ts` or `src/app/api/v1/analytics/export/route.ts`.
- Any usage of `:any`.

### 5.4 Integration & Route Verification Scenarios
A downstream test file or manual probe should assert:
1. `GET /api/v1/analytics/export` without session -> HTTP 401.
2. `GET /api/v1/analytics/export?org_id=competitor_org` with user in `test_org` -> HTTP 403 `CROSS_TENANT_VIOLATION`.
3. `GET /api/v1/analytics/export?start=100&end=50` -> HTTP 400 `INVALID_DATE_RANGE`.
4. `GET /api/v1/analytics/export?format=csv` -> HTTP 200 with headers `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="analytics-export-...csv"`.
5. `GET /api/v1/analytics/export?format=json` with 0 records -> HTTP 200 body `[]`.
