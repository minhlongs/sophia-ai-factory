/**
 * Initialize local D1 SQLite database for development.
 *
 * Creates a SQLite file at .wrangler/state/v3/d1/miniflare-D1DatabaseObject/sophia-raas-db.sqlite
 * and applies all migrations from migrations/*.sql.
 *
 * Usage: node scripts/init-local-d1.mjs
 */

import { readFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Determine the local D1 database directory
const d1Dir = join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const dbPath = join(d1Dir, 'sophia-raas-db.sqlite');

// Ensure directory exists
mkdirSync(d1Dir, { recursive: true });

// Create or open database
const db = new Database(dbPath);
console.log(`✅ Created/opened local D1 database at ${dbPath}`);

// Apply migrations
const migrationsDir = join(process.cwd(), 'migrations');
if (!existsSync(migrationsDir)) {
  console.error(`❌ Migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

let applied = 0;
for (const file of files) {
  const filePath = join(migrationsDir, file);
  const sql = readFileSync(filePath, 'utf-8');
  try {
    db.exec(sql);
    console.log(`   ✓ Applied migration: ${file}`);
    applied++;
  } catch (err) {
    console.error(`   ✗ Migration ${file} failed:`, err.message);
    // Continue? Some migrations may be conditional. We'll continue.
  }
}

console.log(`✅ Applied ${applied} migrations. Local D1 ready.`);
db.close();
