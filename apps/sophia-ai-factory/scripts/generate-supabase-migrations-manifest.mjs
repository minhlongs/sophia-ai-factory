#!/usr/bin/env node
/**
 * generate-supabase-migrations-manifest.mjs
 *
 * Reads supabase/migrations/*.sql → writes
 * src/tree/admin/supabase-migrations-manifest.ts
 * with base64 content + SHA-256 hash.
 *
 * Run at deploy time (called by deploy-with-sha.sh).
 * Enables the admin Migration Console to list + copy pending migrations
 * without needing filesystem access at runtime (Cloudflare Workers edge).
 */

import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const migrationsDir = path.join(root, 'supabase', 'migrations')
const outFile = path.join(root, 'src', 'tree', 'admin', 'supabase-migrations-manifest.ts')

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

const files = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const entries = files.map((filename) => {
  const fullPath = path.join(migrationsDir, filename)
  const content = fs.readFileSync(fullPath, 'utf8')
  return {
    filename,
    content_b64: Buffer.from(content, 'utf8').toString('base64'),
    sha256: sha256(content),
  }
})

const ts = `/**
 * Supabase migrations manifest — AUTO-GENERATED at build time.
 * DO NOT edit manually. Run scripts/generate-supabase-migrations-manifest.mjs to regenerate.
 *
 * @module lib/admin/supabase-migrations-manifest
 */

export interface SupabaseMigrationEntry {
  filename: string
  content_b64: string
  sha256: string
}

export const SUPABASE_MIGRATIONS_MANIFEST: SupabaseMigrationEntry[] = ${JSON.stringify(entries, null, 2)}
`

// Ensure output dir exists
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, ts, 'utf8')

console.log(`[manifest] Generated ${entries.length} entries → ${path.relative(root, outFile)}`)
