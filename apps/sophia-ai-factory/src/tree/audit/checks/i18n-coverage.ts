/**
 * i18n Coverage Checks
 * Compares vi.json vs en.json key coverage and checks for hardcoded strings.
 *
 * @module lib/audit/checks/i18n-coverage
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

const MESSAGES_DIR = join(process.cwd(), 'messages')

interface VitestResult {
  numPassedTests?: number
  numFailedTests?: number
  numTotalTests?: number
  success?: boolean
  testResults?: Array<{ status: string; numPassingAsserts?: number }>
}

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

function loadMessageKeys(locale: string): string[] | null {
  // Path resolved at call time; MESSAGES_DIR defined at module level for reuse in error message.
  const path = join(MESSAGES_DIR, `${locale}.json`)
  if (!existsSync(path)) return null
  try {
    return flattenKeys(JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>)
  } catch {
    return null
  }
}

function collectTsxFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectTsxFiles(full))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(full)
    }
  }
  return files
}

export async function runI18nChecks(_env: AuditEnv): Promise<CheckResult[]> {
  const start = Date.now()

  // Compute path at runtime to avoid NFT module-level tracing
  const APP_SRC_DIR = join(process.cwd(), 'src', 'app')

  const viKeys = loadMessageKeys('vi')
  const enKeys = loadMessageKeys('en')

  if (!viKeys || !enKeys) {
    return [
      {
        id: 'i18n-coverage',
        category: 'i18n Coverage',
        name: 'Translation Key Parity',
        status: 'warn',
        weight: 5,
        score: 0.5,
        evidence: `Could not load message files from ${MESSAGES_DIR}`,
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

  // Sample hardcoded string check in TSX files — look for JSX text with > 3 chars that isn't a translation call
  const tsxFiles = collectTsxFiles(APP_SRC_DIR).slice(0, 50) // cap at 50 files for performance
  let hardcodedCount = 0
  for (const file of tsxFiles) {
    try {
      const content = readFileSync(file, 'utf-8')
      // Simple heuristic: JSX text content with Vietnamese characters not inside {t(
      const matches = content.match(/>[^<{]{4,}[àáạảãăắặẳẵâấầẩẫăắặẳẵ][^<{]*</g) ?? []
      hardcodedCount += matches.length
    } catch {
      // skip
    }
  }

  const keyStatus = totalMissing === 0 ? 'pass' : totalMissing <= 10 ? 'warn' : 'fail'
  const hardcodedStatus = hardcodedCount <= 5 ? 'pass' : hardcodedCount <= 20 ? 'warn' : 'fail'

  const worstStatus =
    keyStatus === 'fail' || hardcodedStatus === 'fail'
      ? 'fail'
      : keyStatus === 'warn' || hardcodedStatus === 'warn'
        ? 'warn'
        : 'pass'

  const evidence = [
    `vi.json: ${viKeys.length} keys, en.json: ${enKeys.length} keys`,
    totalMissing > 0 ? `Missing in en: ${missingInEn.slice(0, 3).join(', ')}${missingInEn.length > 3 ? '...' : ''}` : '',
    totalMissing > 0 ? `Missing in vi: ${missingInVi.slice(0, 3).join(', ')}${missingInVi.length > 3 ? '...' : ''}` : '',
    `Possible hardcoded Vietnamese strings: ${hardcodedCount}`,
  ]
    .filter(Boolean)
    .join(' | ')

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
