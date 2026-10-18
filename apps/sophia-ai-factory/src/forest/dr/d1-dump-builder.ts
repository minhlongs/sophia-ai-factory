/**
 * D1 SQL dump builder — serializes a D1 database to SQL INSERT statements.
 *
 * Used by `/api/cron/d1-backup` to produce a portable snapshot uploaded to R2.
 * Compatible with `wrangler d1 execute --file=<dump.sql>` for restore.
 *
 * Scope: tables only. Indices and views are recreated by migrations; this dump
 * is a DATA snapshot, NOT a schema snapshot.
 *
 * @module forest/dr/d1-dump-builder
 */

/** SQLite system tables we skip — auto-managed by SQLite and re-created by migrations. */
const SQLITE_INTERNAL_TABLES = new Set([
  'sqlite_sequence',
  'sqlite_stat1',
  'sqlite_stat4',
  '_cf_KV',
  'd1_migrations',
]);

/** Maximum rows per table dump. Hard ceiling to keep Worker CPU bounded. */
const MAX_ROWS_PER_TABLE = 100_000;

/** SQLite identifier quoting — doubles embedded `"` per ANSI SQL. */
function quoteIdent(name: string): string {
  return '"' + name.replaceAll('"', '""') + '"';
}

/**
 * Escape a single SQL value into its literal form.
 * Handles: null, boolean, number, bigint, string, ArrayBuffer (blob).
 */
export function sqlEscape(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return `X'${hex}'`;
  }
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function serializeRow(columns: string[], row: Record<string, unknown>): string {
  return '(' + columns.map((col) => sqlEscape(row[col])).join(', ') + ')';
}

/**
 * Build a SQL dump for all user tables in a D1 database.
 * Tables exceeding `MAX_ROWS_PER_TABLE` are truncated with a `-- TRUNCATED` marker.
 */
export async function buildD1Dump(db: D1Database): Promise<string> {
  const lines: string[] = [
    `-- Sophia AI Factory D1 dump`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Restore: wrangler d1 execute sophia-raas-db --file=<this-file> --remote`,
    '',
  ];

  const tablesResult = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type='table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all<{ name: string }>();

  const tables = (tablesResult.results ?? []).filter(
    (t) => !SQLITE_INTERNAL_TABLES.has(t.name),
  );

  for (const { name: tableName } of tables) {
    const rowsResult = await db
      .prepare(`SELECT * FROM "${tableName}" LIMIT ${MAX_ROWS_PER_TABLE + 1}`)
      .all<Record<string, unknown>>();
    const rows = rowsResult.results ?? [];
    if (rows.length === 0) {
      lines.push(`-- Table: ${tableName} (0 rows)`, '');
      continue;
    }

    const truncated = rows.length > MAX_ROWS_PER_TABLE;
    const dumpRows = truncated ? rows.slice(0, MAX_ROWS_PER_TABLE) : rows;
    const columns = Object.keys(dumpRows[0]);
    const columnList = columns.map((c) => quoteIdent(c)).join(', ');

    lines.push(`-- Table: ${tableName} (${rows.length} rows${truncated ? ' — TRUNCATED' : ''})`);
    lines.push(`INSERT INTO ${quoteIdent(tableName)} (${columnList}) VALUES`);
    lines.push('  ' + dumpRows.map((r) => serializeRow(columns, r)).join(',\n  ') + ';', '');
  }

  lines.push(`-- Dump finished: ${new Date().toISOString()}`, `-- Tables: ${tables.length}`);
  return lines.join('\n');
}
