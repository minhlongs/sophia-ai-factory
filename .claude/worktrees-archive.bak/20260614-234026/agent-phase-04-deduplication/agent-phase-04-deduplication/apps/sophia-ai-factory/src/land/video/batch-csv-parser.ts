export interface BatchVideoRow {
  rowIndex: number;
  prompt: string;
  voiceoverText?: string;
  language?: string;
  tone?: string;
  cta?: string;
  [key: string]: string | number | undefined;
}

export interface ParseResult {
  rows: BatchVideoRow[];
  errors: string[];
}

const REQUIRED_COLUMNS = ['prompt'];
const MAX_ROWS = 500;

export function parseBatchCsv(csvText: string): ParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return { rows: [], errors: ['CSV must have a header row and at least one data row'] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const errors: string[] = [];

  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      errors.push(`Missing required column: ${col}`);
    }
  }

  if (errors.length > 0) return { rows: [], errors };

  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);

  if (dataLines.length > MAX_ROWS) {
    return { rows: [], errors: [`Too many rows: ${dataLines.length} (max ${MAX_ROWS})`] };
  }

  const rows: BatchVideoRow[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const values = parseCsvLine(dataLines[i]);
    const row: Record<string, string | number | undefined> = { rowIndex: i };

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j]?.trim() ?? '';
    }

    if (!row.prompt || String(row.prompt).trim().length === 0) {
      errors.push(`Row ${i + 1}: missing prompt`);
      continue;
    }

    rows.push(row as unknown as BatchVideoRow);
  }

  return { rows, errors };
}

export function parseBatchJson(jsonText: string): ParseResult {
  try {
    const data = JSON.parse(jsonText);
    const items = Array.isArray(data) ? data : data.videos ?? data.rows ?? data.items;

    if (!Array.isArray(items)) {
      return { rows: [], errors: ['JSON must be an array or have a "videos"/"rows"/"items" key'] };
    }

    if (items.length > MAX_ROWS) {
      return { rows: [], errors: [`Too many items: ${items.length} (max ${MAX_ROWS})`] };
    }

    const errors: string[] = [];
    const rows: BatchVideoRow[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.prompt || String(item.prompt).trim().length === 0) {
        errors.push(`Item ${i + 1}: missing prompt`);
        continue;
      }
      rows.push({ ...item, rowIndex: i });
    }

    return { rows, errors };
  } catch {
    return { rows: [], errors: ['Invalid JSON format'] };
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function estimateBatchCost(rowCount: number): number {
  // ~$0.06/video (Wan2.1 + Fish Speech) = 6 cents
  return rowCount * 6;
}
