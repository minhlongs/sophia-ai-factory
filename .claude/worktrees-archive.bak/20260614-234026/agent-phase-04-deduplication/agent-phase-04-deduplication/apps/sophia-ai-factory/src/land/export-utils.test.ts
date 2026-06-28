import { describe, it, expect } from 'vitest';
import { convertToCSV } from './export-utils';

describe('convertToCSV', () => {
  it('returns empty string for empty array', () => {
    expect(convertToCSV([])).toBe('');
  });

  it('returns empty string for null/undefined input', () => {
    expect(convertToCSV(null as unknown as Record<string, unknown>[])).toBe('');
    expect(convertToCSV(undefined as unknown as Record<string, unknown>[])).toBe('');
  });

  it('generates correct CSV with headers and rows', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = convertToCSV(data);
    expect(result).toBe('name,age\n"Alice","30"\n"Bob","25"');
  });

  it('handles null/undefined values as empty string', () => {
    const data = [{ a: null, b: undefined }];
    const result = convertToCSV(data);
    expect(result).toBe('a,b\n"",""');
  });

  it('escapes double quotes by doubling (RFC 4180)', () => {
    const data = [{ text: 'He said "hello"' }];
    const result = convertToCSV(data);
    expect(result).toBe('text\n"He said ""hello"""');
  });

  it('strips formula injection prefix =', () => {
    const data = [{ formula: '=SUM(A1:A10)' }];
    const result = convertToCSV(data);
    expect(result).toContain("\"'=SUM(A1:A10)\"");
  });

  it('strips formula injection prefix +', () => {
    const data = [{ val: '+cmd|calc' }];
    const result = convertToCSV(data);
    expect(result).toContain("\"'+cmd|calc\"");
  });

  it('strips formula injection prefix -', () => {
    const data = [{ val: '-1+1|cmd' }];
    const result = convertToCSV(data);
    expect(result).toContain("\"'-1+1|cmd\"");
  });

  it('strips formula injection prefix @', () => {
    const data = [{ val: '@SUM(A1)' }];
    const result = convertToCSV(data);
    expect(result).toContain("\"'@SUM(A1)\"");
  });

  it('does not modify normal strings', () => {
    const data = [{ name: 'Normal text here' }];
    const result = convertToCSV(data);
    expect(result).toBe('name\n"Normal text here"');
  });

  it('handles numbers and booleans correctly', () => {
    const data = [{ num: 42, flag: true }];
    const result = convertToCSV(data);
    expect(result).toBe('num,flag\n"42","true"');
  });
});
