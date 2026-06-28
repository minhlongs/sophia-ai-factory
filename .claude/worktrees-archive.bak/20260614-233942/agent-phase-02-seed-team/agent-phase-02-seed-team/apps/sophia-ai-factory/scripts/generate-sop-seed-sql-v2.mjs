#!/usr/bin/env node
/**
 * Generate SOP Seed SQL v2 (0060-sop-seed-31-playbooks.sql)
 *
 * Reads seed data from src/lib/sop/seeds/index.ts and emits
 * INSERT OR REPLACE statements for all 31 official SOPs,
 * including the new config_schema, config_defaults, setup_time_minutes,
 * and is_featured columns added in migration 0059.
 *
 * Usage: node scripts/generate-sop-seed-sql-v2.mjs
 * Or via npm: npm run db:gen-sop-seed-v2
 *
 * Idempotent: stable IDs derived from slug. INSERT OR REPLACE overwrites
 * stale 0058 entries (5 original seeds replaced by refactored versions).
 */

import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');
const outputPath = join(appRoot, 'migrations', '0060-sop-seed-31-playbooks.sql');

function sqlEsc(str) {
  if (str == null) return null;
  return String(str).replace(/'/g, "''");
}

function sqlVal(val) {
  if (val == null) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${sqlEsc(val)}'`;
}

function slugToId(slug) {
  return 'sop_official_' + slug.replace(/-/g, '_');
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function loadSeeds() {
  const seedsPath = join(appRoot, 'src', 'lib', 'sop', 'seeds', 'index.ts');

  if (!existsSync(seedsPath)) {
    throw new Error(`Seeds file not found: ${seedsPath}`);
  }

  const extractScript = join(appRoot, 'scripts', '__sop-seeds-extract-v2.mjs');
  const extractContent = `
import { SOP_SEEDS } from ${JSON.stringify(seedsPath.replace(/\\/g, '/'))};
process.stdout.write(JSON.stringify(SOP_SEEDS));
`;

  writeFileSync(extractScript + '.ts', extractContent, 'utf8');

  try {
    const json = execSync(`npx tsx ${JSON.stringify(extractScript + '.ts')}`, {
      cwd: appRoot,
      timeout: 60_000,
      encoding: 'utf8',
    });
    return JSON.parse(json);
  } finally {
    try {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(extractScript + '.ts');
    } catch { /* ignore */ }
  }
}

function buildSql(seeds) {
  const ts = nowSec();
  const lines = [
    '-- SOP Official Seed Data v2 — 31 playbooks (auto-generated)',
    '-- DO NOT EDIT MANUALLY — regenerate with: npm run db:gen-sop-seed-v2',
    `-- Generated at: ${new Date().toISOString()}`,
    '-- Replaces 0058 seeds. Uses INSERT OR REPLACE for idempotency.',
    '',
  ];

  for (const seed of seeds) {
    const id = slugToId(seed.slug);
    const configSchema = seed.configSchema ?? null;
    const configDefaults = seed.configDefaults ?? null;
    const setupTime = seed.setupTimeMinutes ?? 5;
    const isFeatured = seed.isFeatured ?? 0;

    lines.push(
      `INSERT OR REPLACE INTO sop_templates ` +
      `(id, slug, name_vi, name_en, description_vi, description_en, category, ` +
      `agents_yaml, playbook_md, output_schema, config_schema, config_defaults, ` +
      `setup_time_minutes, is_featured, credits_per_run, version, is_official, ` +
      `author_user_id, status, created_at, updated_at) VALUES ` +
      `(${sqlVal(id)}, ${sqlVal(seed.slug)}, ${sqlVal(seed.nameVi)}, ${sqlVal(seed.nameEn)}, ` +
      `${sqlVal(seed.descVi)}, ${sqlVal(seed.descEn)}, ${sqlVal(seed.category)}, ` +
      `${sqlVal(seed.agentsYaml)}, ${sqlVal(seed.playbookMd)}, ${sqlVal(seed.outputSchema)}, ` +
      `${sqlVal(configSchema)}, ${sqlVal(configDefaults)}, ` +
      `${setupTime}, ${isFeatured}, ${seed.creditsPerRun}, 1, 1, NULL, 'published', ${ts}, ${ts});`,
      '',
    );
  }

  return lines.join('\n');
}

async function main() {
  console.log('[gen-sop-seed-v2] Loading seed modules...');

  const seeds = await loadSeeds();

  if (!Array.isArray(seeds) || seeds.length === 0) {
    console.error('[gen-sop-seed-v2] No seeds loaded — aborting');
    process.exit(1);
  }

  console.log(`[gen-sop-seed-v2] Loaded ${seeds.length} seeds`);

  const sql = buildSql(seeds);
  writeFileSync(outputPath, sql, 'utf8');

  console.log(`[gen-sop-seed-v2] Written: ${outputPath}`);
  console.log(`[gen-sop-seed-v2] ${seeds.length} official SOPs seeded`);
}

main().catch(err => {
  console.error('[gen-sop-seed-v2] Fatal error:', err);
  process.exit(1);
});
