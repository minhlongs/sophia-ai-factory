import { mkdtemp, mkdir, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectTsxFiles, countHardcodedStrings, flattenKeys, getFsPath, loadMessageKeys } from './i18n-scanner-helpers';

describe('i18n scanner helpers', () => {
  it('flattens nested objects and arrays into leaf key paths', () => {
    expect(flattenKeys({
      dashboard: { title: 'Home', counts: { active: 3 }, empty: {} },
      choices: ['one', 'two'],
      missing: null,
    })).toEqual([
      'dashboard.title', 'dashboard.counts.active', 'choices.0', 'choices.1', 'missing',
    ]);
  });

  it('loads existing locale keys and returns null for missing or malformed message files', async () => {
    const messagesPath = join(process.cwd(), 'messages');
    const malformedLocale = `test-invalid-${process.pid}-${Math.random().toString(36).slice(2)}`;
    const malformedPath = join(messagesPath, `${malformedLocale}.json`);
    try {
      await writeFile(malformedPath, '{ invalid json', 'utf8');
      const keys = await loadMessageKeys('en');
      expect(keys).not.toBeNull();
      expect(keys?.length).toBeGreaterThan(0);
      expect(await loadMessageKeys(`missing-${malformedLocale}`)).toBeNull();
      expect(await loadMessageKeys(malformedLocale)).toBeNull();
    } finally {
      await unlink(malformedPath).catch(() => undefined);
    }
  });

  it('provides Node filesystem primitives from the lazy loader', async () => {
    const fs = await getFsPath();
    expect(typeof fs.existsSync).toBe('function');
    expect(typeof fs.readFileSync).toBe('function');
    expect(typeof fs.readdirSync).toBe('function');
    expect(typeof fs.statSync).toBe('function');
    expect(typeof fs.join).toBe('function');
  });

  it('recursively collects TypeScript files and counts at most the first 50 scanned files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sophia-i18n-scan-'));
    const nested = join(root, 'nested');
    await mkdir(nested);
    try {
      const viString = 'const label = <p>Hãy bắt đầu ngay</p>;';
      for (let index = 0; index < 50; index += 1) {
        await writeFile(join(root, `screen-${String(index).padStart(2, '0')}.tsx`), viString, 'utf8');
      }
      await writeFile(join(nested, 'component.ts'), viString, 'utf8');
      await writeFile(join(root, 'ignored.js'), viString, 'utf8');

      const files = await collectTsxFiles(root);
      expect(files).toHaveLength(51);
      expect(files.some((file) => file.endsWith(join('nested', 'component.ts')))).toBe(true);
      expect(await collectTsxFiles(join(root, 'does-not-exist'))).toEqual([]);
      expect(await countHardcodedStrings(root)).toBe(50);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
