/**
 * i18n Coverage File & String Scanner Helpers
 *
 * @module tree/audit/checks/i18n-scanner-helpers
 */

export function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
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

export async function getFsPath() {
  // Lazy dynamic import — fs/path are Node.js builtins that Next.js NFT static tracer
  // cannot resolve when imported at module top-level.
  const { existsSync, readFileSync, readdirSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')
  return { existsSync, readFileSync, readdirSync, statSync, join }
}

export async function loadMessageKeys(locale: string): Promise<string[] | null> {
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

export async function collectTsxFiles(dir: string): Promise<string[]> {
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

export async function countHardcodedStrings(dir: string): Promise<number> {
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
