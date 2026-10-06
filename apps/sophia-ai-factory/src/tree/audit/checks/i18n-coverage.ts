/**
 * i18n Coverage Checks
 * Compares vi.json vs en.json key coverage and checks for hardcoded strings.
 *
 * @module lib/audit/checks/i18n-coverage
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
 const keys: string[] = []
 for (const [k, v] of Object.entries(obj)) {
   const full = prefix ? `${prefix}.${k}` : k
   if (typeof v === 'object' && v !== null) {
     keys.push(...flattenKeys(v as Record<string, unknown>, full))
   } else {
     keys.push(full)
   }
 }
 return keys
}

async function getFsPath() {
 // Lazy dynamic import — fs/path are Node.js builtins that Next.js NFT static tracer
 // cannot resolve when imported at module top-level. Dynamic import inside this
 // function means they are only resolved at runtime, after the trace is done.

 const { existsSync, readFileSync, readdirSync, statSync } = await import('node:fs')

 const { join } = await import('node:path')
 return { existsSync, readFileSync, readdirSync, statSync, join }
}

async function loadMessageKeys(locale: string): Promise<string[] | null> {
 const { existsSync, readFileSync, join } = await getFsPath()
 const messagesDir = join(process.cwd(), 'messages')
 const path = join(messagesDir, `${locale}.json`)
 if (!existsSync(path)) return null
 try {
   return flattenKeys(JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>)
 } catch {
   return null
 }
}

async function collectTsxFiles(dir: string): Promise<string[]> {
 const { existsSync, readdirSync, statSync, join } = await getFsPath()
 if (!existsSync(dir)) return []
 const files: string[] = []
 for (const entry of readdirSync(dir)) {
   const full = join(dir, entry)
   const s = statSync(full)
   if (s.isDirectory()) {
     files.push(...(await collectTsxFiles(full)))
   } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
     files.push(full)
   }
 }
 return files
}

async function countHardcodedStrings(dir: string): Promise<number> {
  const tsxFiles = (await collectTsxFiles(dir)).slice(0, 50)
  let count = 0
  const { readFileSync } = await getFsPath()
  for (const file of tsxFiles) {
    try {
      const content = readFileSync(file, 'utf-8')
      const matches = content.match(/>[^<]{4,}[àáạảãăắặẳẵâấầẩẫ][^<]*</g) ?? []
      count += matches.length
    } catch {
      // skip
    }
  }
  return count
}

function resolveWorstStatus(totalMissing: number, hardcodedCount: number): 'pass' | 'warn' | 'fail' {
  const keyStatus = totalMissing === 0 ? 'pass' : totalMissing <= 10 ? 'warn' : 'fail'
  const hardcodedStatus = hardcodedCount <= 5 ? 'pass' : hardcodedCount <= 20 ? 'warn' : 'fail'

  if (keyStatus === 'fail' || hardcodedStatus === 'fail') return 'fail'
  if (keyStatus === 'warn' || hardcodedStatus === 'warn') return 'warn'
  return 'pass'
}

function buildI18nEvidence(
  viCount: number,
  enCount: number,
  missingInEn: string[],
  missingInVi: string[],
  hardcodedCount: number,
): string {
  return [
    `vi.json: ${viCount} keys, en.json: ${enCount} keys`,
    missingInEn.length > 0 ? `Missing in en: ${missingInEn.slice(0, 3).join(', ')}${missingInEn.length > 3 ? '...' : ''}` : '',
    missingInVi.length > 0 ? `Missing in vi: ${missingInVi.slice(0, 3).join(', ')}${missingInVi.length > 3 ? '...' : ''}` : '',
    `Possible hardcoded Vietnamese strings: ${hardcodedCount}`,
  ]
    .filter(Boolean)
    .join(' | ')
}

export async function runI18nChecks(_env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()

  // Compute path at runtime to avoid NFT module-level tracing
  const { join } = await getFsPath()
  const APP_SRC_DIR = join(process.cwd(), 'src', 'app')

  const viKeys = await loadMessageKeys('vi')
  const enKeys = await loadMessageKeys('en')

  if (!viKeys || !enKeys) {
    return [
      {
        id: 'i18n-coverage',
        category: 'i18n Coverage',
        name: 'Translation Key Parity',
        status: 'warn',
        weight: 5,
        score: 0.5,
        evidence: `Could not load message files from ${join(process.cwd(), 'messages')}`,
        fix: 'Ensure messages/vi.json and messages/en.json exist',
        durationMs: Date.now() - start,
      },
    ]
  }

  const viSet = new Set(viKeys)
  const enSet = new Set(enKeys)

  const missingInEn = viKeys.filter((k) => !enSet.has(k))
  const missingInVi = enKeys.filter((k) => !viSet.has(k))
  const totalMissing = missingInEn.length + missingInVi.length

  const hardcodedCount = await countHardcodedStrings(APP_SRC_DIR)
  const worstStatus = resolveWorstStatus(totalMissing, hardcodedCount)
  const evidence = buildI18nEvidence(viKeys.length, enKeys.length, missingInEn, missingInVi, hardcodedCount)

  return [
    {
      id: 'i18n-coverage',
      category: 'i18n Coverage',
      name: 'Translation Key Parity',
      status: worstStatus,
      weight: 5,
      score: worstStatus === 'pass' ? 1 : worstStatus === 'warn' ? 0.5 : 0,
      evidence,
      fix:
        worstStatus !== 'pass'
          ? `Sync ${totalMissing} missing translation keys; review ${hardcodedCount} possibly hardcoded strings`
          : undefined,
      durationMs: Date.now() - start,
    },
  ]
}

