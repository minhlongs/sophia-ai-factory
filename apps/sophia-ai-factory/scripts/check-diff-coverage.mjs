import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const threshold = 70;
const sourceRoot = resolve('src');
const baseSha = process.env.BASE_SHA?.trim();
const sourceFiles = new Map();

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trimEnd();
}

function isProductionTypeScript(filePath) {
  const normalized = filePath.split(sep).join('/');
  return (
    /^src\/.*\.(ts|tsx)$/.test(normalized) &&
    !normalized.endsWith('.d.ts') &&
    !normalized.endsWith('.config.ts') &&
    !/(^|\/)(__tests__|test)\//.test(normalized) &&
    !/\.(test|spec)\.(ts|tsx)$/.test(normalized)
  );
}

function addChangedLines(filePath, lines) {
  const path = filePath.split(sep).join('/');
  if (!isProductionTypeScript(path)) return;
  const current = sourceFiles.get(path) ?? new Set();
  for (const line of lines) current.add(line);
  sourceFiles.set(path, current);
}

function parseDiff(diff) {
  let currentFile = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length);
    } else if (line.startsWith('+++ /dev/null')) {
      currentFile = null;
    } else if (currentFile && line.startsWith('@@ ')) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      if (!match) continue;
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      addChangedLines(currentFile, Array.from({ length: count }, (_, index) => start + index));
    }
  }
}

if (baseSha) {
  if (!/^[0-9a-f]{40}$/i.test(baseSha)) {
    throw new Error('BASE_SHA must be a full Git commit SHA');
  }
  parseDiff(runGit(['diff', '--unified=0', '--diff-filter=ACMR', `${baseSha}...HEAD`, '--', 'src']));
} else {
  parseDiff(runGit(['diff', '--unified=0', '--diff-filter=ACMR', 'HEAD', '--', 'src']));
  const untracked = runGit(['ls-files', '--others', '--exclude-standard', '--', 'src'])
    .split('\n')
    .filter(Boolean);
  for (const filePath of untracked) {
    if (!isProductionTypeScript(filePath)) continue;
    const source = await readFile(resolve(filePath), 'utf8');
    addChangedLines(filePath, source.split(/\r?\n/).map((_, index) => index + 1));
  }
}

const lcov = await readFile(resolve('coverage/lcov.info'), 'utf8');
const coverageByFile = new Map();
let currentFile = null;
for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) {
    const sourcePath = line.slice(3).replaceAll('\\', '/');
    const sourceMarker = '/src/';
    const markerIndex = sourcePath.lastIndexOf(sourceMarker);
    currentFile = markerIndex >= 0
      ? `src/${sourcePath.slice(markerIndex + sourceMarker.length)}`
      : sourcePath.startsWith('src/') ? sourcePath : null;
    if (currentFile) coverageByFile.set(currentFile, new Map());
  } else if (currentFile && line.startsWith('DA:')) {
    const [lineNumber, count] = line.slice(3).split(',').map(Number);
    coverageByFile.get(currentFile)?.set(lineNumber, count);
  } else if (line === 'end_of_record') {
    currentFile = null;
  }
}

let executableLines = 0;
let coveredLines = 0;
const uncovered = [];
for (const [filePath, changedLines] of sourceFiles) {
  const lineCoverage = coverageByFile.get(filePath);
  if (!lineCoverage) {
    uncovered.push(`${filePath}: no coverage data`);
    continue;
  }
  for (const lineNumber of changedLines) {
    const hitCount = lineCoverage.get(lineNumber);
    if (hitCount === undefined) continue;
    executableLines++;
    if (hitCount > 0) coveredLines++;
    else uncovered.push(`${filePath}:${lineNumber}`);
  }
}

if (uncovered.length > 0) {
  console.log(`Uncovered changed executable lines: ${uncovered.join(', ')}`);
}

const percentage = executableLines === 0 ? 100 : (coveredLines / executableLines) * 100;
console.log(`Changed executable lines: ${coveredLines}/${executableLines} (${percentage.toFixed(2)}%)`);
if (percentage < threshold) {
  console.error(`FAIL: changed-line coverage ${percentage.toFixed(2)}% is below ${threshold}%`);
  process.exit(1);
}
console.log(`PASS: changed-line coverage meets ${threshold}% threshold`);
