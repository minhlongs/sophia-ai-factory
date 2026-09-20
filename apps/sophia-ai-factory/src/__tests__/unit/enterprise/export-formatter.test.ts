/**
 * Unit Tests for RFC-4180 CSV & Streaming JSON Export Formatter.
 *
 * Covers:
 * 1. RFC-4180 CSV escaping & serialization (escapeCsvField, formatStreamingCsv)
 * 2. Web Streams CSV generator (streamCsv)
 * 3. Streaming JSON & NDJSON generator (streamJsonArray)
 * 4. Streaming HTTP Response factory (createStreamingExportResponse)
 *
 * @module __tests__/unit/enterprise/export-formatter.test
 */

import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  formatStreamingCsv,
  streamCsv,
  streamJsonArray,
  createStreamingExportResponse,
} from '@/tree/bi/export-formatter';

/** Helper to collect all bytes from a ReadableStream<Uint8Array> into a UTF-8 string */
async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

/** Helper to create an AsyncIterable from an array */
async function* toAsyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

describe('Unit Tests: Export Formatter Service', () => {
  describe('1. RFC-4180 CSV Escaping (escapeCsvField)', () => {
    it('returns simple strings without modification', () => {
      expect(escapeCsvField('hello')).toBe('hello');
      expect(escapeCsvField('org_12345')).toBe('org_12345');
    });

    it('wraps fields containing commas in double quotes', () => {
      expect(escapeCsvField('Acme, Inc.')).toBe('"Acme, Inc."');
      expect(escapeCsvField('a,b,c')).toBe('"a,b,c"');
    });

    it('doubles internal double quotes and wraps in quotes', () => {
      expect(escapeCsvField('The "Best" Agency')).toBe('"The ""Best"" Agency"');
      expect(escapeCsvField('"Quoted"')).toBe('"""Quoted"""');
    });

    it('wraps fields containing newlines or CRLF in double quotes', () => {
      expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
    });

    it('handles null and undefined by returning empty strings', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('converts numbers and booleans directly without quotes', () => {
      expect(escapeCsvField(42)).toBe('42');
      expect(escapeCsvField(3.14159)).toBe('3.14159');
      expect(escapeCsvField(true)).toBe('true');
      expect(escapeCsvField(false)).toBe('false');
    });

    it('serializes objects and arrays as JSON and escapes them', () => {
      const obj = { key: 'value', tags: ['a', 'b'] };
      const escaped = escapeCsvField(obj);
      expect(escaped).toContain('""key"":""value""');
    });

    it('sanitizes leading formula characters when sanitizeFormulas is true', () => {
      expect(escapeCsvField('=SUM(A1:A10)', ',', true)).toBe('\'=SUM(A1:A10)');
      expect(escapeCsvField('+123', ',', true)).toBe('\'+123');
      expect(escapeCsvField('-123', ',', true)).toBe('\'-123');
      expect(escapeCsvField('@cmd', ',', true)).toBe('\'@cmd');
    });
  });

  describe('2. In-Memory CSV Serialization (formatStreamingCsv)', () => {
    it('generates valid RFC-4180 CSV with CRLF line breaks', () => {
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
      expect(lines[2]).toBe('2024-07,4500.00,150,3.5x');
    });

    it('supports custom delimiters and UTF-8 BOM prefix', () => {
      const headers = ['colA', 'colB'];
      const rows = [{ colA: 'val1', colB: 'val2' }];
      const csv = formatStreamingCsv(headers, rows, {
        delimiter: ';',
        includeBom: true,
      });

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('colA;colB');
      expect(csv).toContain('val1;val2');
    });

    it('handles complex multi-column escaping in a single row', () => {
      const headers = ['title', 'notes'];
      const rows = [
        {
          title: 'Field with "quotes" and, commas',
          notes: 'Multi\r\nLine',
        },
      ];
      const csv = formatStreamingCsv(headers, rows);
      expect(csv).toContain('"Field with ""quotes"" and, commas"');
      expect(csv).toContain('"Multi\r\nLine"');
    });
  });

  describe('3. Web Streams CSV Generator (streamCsv)', () => {
    it('streams CSV rows from an AsyncIterable into Uint8Array chunks', async () => {
      const headers = ['id', 'name', 'spend'];
      const rows = [
        { id: '1', name: 'Alpha', spend: 500 },
        { id: '2', name: 'Beta, Corp', spend: 1200 },
      ];

      const stream = streamCsv(headers, toAsyncIterable(rows));
      const output = await streamToString(stream);
      const lines = output.split('\r\n').filter(Boolean);

      expect(lines[0]).toBe('id,name,spend');
      expect(lines[1]).toBe('1,Alpha,500');
      expect(lines[2]).toBe('2,"Beta, Corp",1200');
    });
  });

  describe('4. Streaming JSON & NDJSON (streamJsonArray)', () => {
    it('formats empty iterable as "[]"', async () => {
      const stream = streamJsonArray(toAsyncIterable([]));
      const output = await streamToString(stream);
      expect(output).toBe('[]');
    });

    it('streams populated JSON array parseable by JSON.parse', async () => {
      const items = [
        { orgId: 'org_1', peakMrr: 5000 },
        { orgId: 'org_2', peakMrr: 12000 },
      ];
      const stream = streamJsonArray(toAsyncIterable(items));
      const output = await streamToString(stream);

      const parsed = JSON.parse(output);
      expect(parsed).toEqual(items);
    });

    it('preserves nested metadata structures in JSON export', async () => {
      const items = [
        {
          id: 'item_1',
          channels: ['tiktok', 'shorts'],
          metrics: { viralScore: 92.5, roi: 3.5 },
        },
      ];
      const stream = streamJsonArray(toAsyncIterable(items));
      const output = await streamToString(stream);

      const parsed = JSON.parse(output);
      expect(parsed[0].channels).toEqual(['tiktok', 'shorts']);
      expect(parsed[0].metrics.viralScore).toBe(92.5);
    });

    it('streams Newline-Delimited JSON (NDJSON) correctly', async () => {
      const items = [
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' },
      ];
      const stream = streamJsonArray(toAsyncIterable(items), { ndjson: true });
      const output = await streamToString(stream);
      const lines = output.trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(items[0]);
      expect(JSON.parse(lines[1])).toEqual(items[1]);
    });
  });

  describe('5. HTTP Streaming Response Factory (createStreamingExportResponse)', () => {
    it('creates CSV response with correct headers and attachment filename', () => {
      const rows = [{ a: 1, b: 2 }];
      const res = createStreamingExportResponse(toAsyncIterable(rows), 'csv', 'report-2024', {
        headers: ['a', 'b'],
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="report-2024.csv"');
      expect(res.headers.get('Cache-Control')).toContain('no-cache');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('creates JSON response with correct headers', () => {
      const items = [{ id: 'test' }];
      const res = createStreamingExportResponse(toAsyncIterable(items), 'json', 'data.json');

      expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="data.json"');
    });

    it('creates NDJSON response with correct headers', () => {
      const items = [{ id: 'test' }];
      const res = createStreamingExportResponse(toAsyncIterable(items), 'ndjson', 'events');

      expect(res.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8');
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="events.ndjson"');
    });
  });
});
