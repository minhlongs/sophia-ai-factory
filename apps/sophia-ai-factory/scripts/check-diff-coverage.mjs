import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const threshold = 70;
const baseSha = process.env.BASE_SHA?.trim();
const sourceFiles = new Map();

function runGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function isProductionTypeScript(filePath) {
  const normalized = filePath.split(sep).join('/');
  return (
    normalized.startsWith('src/') &&
    /\.(ts|tsx)$/.test(normalized) &&
    !normalized.endsWith('.d.ts') &&
    !normalized.endsWith('.config.ts') &&
    !/(^|\/)(__tests__|test)\//.test(normalized) &&
    !/\.(test|spec)\.(ts|tsx)$/.test(normalized)
  );
}

function addChangedLines(filePath, lines) {
  if (lines.length === 0) return;
  const path = filePath.split(sep).join('/');
  if (!isProductionTypeScript(path)) return;
  const current = sourceFiles.get(path) ?? new Set();
  for (const line of lines) current.add(line);
  sourceFiles.set(path, current);
}

function formatSamples(entries, limit = 25) {
  const sample = entries.slice(0, limit).join(', ');
  const remainder = entries.length - limit;
  return remainder > 0 ? `${sample}, ... and ${remainder} more` : sample;
}

function parseDiff(filePath, diff) {
  for (const line of diff.split('\n')) {
    if (!line.startsWith('@@ ')) continue;
    const match = line.match(/\+(\d+)(?:,(\d+))?/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    addChangedLines(filePath, Array.from({ length: count }, (_, index) => start + index));
  }
}

if (baseSha && !/^[0-9a-f]{40}$/i.test(baseSha)) {
  throw new Error('BASE_SHA must be a full Git commit SHA');
}
const comparison = baseSha ? `${baseSha}...HEAD` : 'HEAD';
const diffArgs = ['diff', '--relative', '--no-renames', '--diff-filter=ACM'];
const changed = runGit([...diffArgs, '--name-only', '-z', comparison, '--', 'src'])
  .split('\0').filter(Boolean);
for (const filePath of changed) {
  if (!isProductionTypeScript(filePath)) continue;
  parseDiff(filePath, runGit([...diffArgs, '--no-ext-diff', '--no-textconv', '--unified=0',
    comparison, '--', `:(literal)${filePath}`]));
}
if (!baseSha) {
  const untracked = runGit(['ls-files', '--others', '--exclude-standard', '-z', '--', 'src'])
    .split('\0').filter(Boolean);
  for (const filePath of untracked) {
    if (!isProductionTypeScript(filePath)) continue;
    const source = await readFile(resolve(filePath), 'utf8');
    addChangedLines(filePath, source.split(/\r?\n/).map((_, index) => index + 1));
  }
}

const lcov = await readFile(resolve('coverage/lcov.info'), 'utf8');
const coverageByFile = new Map();
const branchesByFile = new Map();
let currentFile = null;
for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) {
    const sourcePath = line.slice(3);
    const mappedPath = relative(process.cwd(), resolve(sourcePath)).split(sep).join('/');
    currentFile = isProductionTypeScript(mappedPath) ? mappedPath : null;
    if (currentFile && !coverageByFile.has(currentFile)) coverageByFile.set(currentFile, new Map());
  } else if (currentFile && line.startsWith('DA:')) {
    const [lineNumber, count] = line.slice(3).split(',').map(Number);
    const lines = coverageByFile.get(currentFile);
    lines.set(lineNumber, Math.max(lines.get(lineNumber) ?? 0, count));
  } else if (currentFile && line.startsWith('BRDA:')) {
    const [lineNumber, block, branch, taken] = line.slice(5).split(',');
    const branches = branchesByFile.get(currentFile) ?? new Map();
    const key = `${lineNumber},${block},${branch}`;
    branches.set(key, { lineNumber: Number(lineNumber),
      taken: Math.max(branches.get(key)?.taken ?? 0, taken === '-' ? 0 : Number(taken)) });
    branchesByFile.set(currentFile, branches);
  } else if (line === 'end_of_record') {
    currentFile = null;
  }
}

let executableLines = 0;
let coveredLines = 0;
const uncovered = [];
let executableBranches = 0;
let coveredBranches = 0;
const uncoveredBranches = [];
const missingCoverage = [];
const zeroHitFiles = [];
for (const [filePath, changedLines] of sourceFiles) {
  const lineCoverage = coverageByFile.get(filePath);
  if (!lineCoverage) {
    missingCoverage.push(filePath);
    continue;
  }
  const fileExecutableLines = [];
  let fileCoveredLines = 0;
  for (const lineNumber of changedLines) {
    const hitCount = lineCoverage.get(lineNumber);
    if (hitCount === undefined) continue;
    fileExecutableLines.push({ lineNumber, hitCount });
    if (hitCount > 0) fileCoveredLines++;
  }
  const fileBranches = [...(branchesByFile.get(filePath)?.values() ?? [])].filter((branch) =>
    changedLines.has(branch.lineNumber),
  );
  const fileCoveredBranches = fileBranches.filter((branch) => branch.taken > 0).length;

  if (fileExecutableLines.length > 0 && fileCoveredLines === 0) zeroHitFiles.push(`${filePath} (lines)`);
  if (fileBranches.length > 0 && fileCoveredBranches === 0) zeroHitFiles.push(`${filePath} (branches)`);

  for (const { lineNumber, hitCount } of fileExecutableLines) {
    executableLines++;
    if (hitCount > 0) coveredLines++;
    else uncovered.push(`${filePath}:${lineNumber}`);
  }
  for (const branch of fileBranches) {
    executableBranches++;
    if (branch.taken > 0) coveredBranches++;
    else uncoveredBranches.push(`${filePath}:${branch.lineNumber}`);
  }
}

if (uncovered.length > 0) {
  console.log(`Uncovered changed executable lines (${uncovered.length}): ${formatSamples(uncovered)}`);
}

const percentage = executableLines === 0 ? 100 : (coveredLines / executableLines) * 100;
const branchPercentage = executableBranches === 0 ? 100 : (coveredBranches / executableBranches) * 100;
console.log(`Changed executable lines: ${coveredLines}/${executableLines} (${percentage.toFixed(2)}%)`);
console.log(`Changed branches: ${coveredBranches}/${executableBranches} (${branchPercentage.toFixed(2)}%)`);
if (uncoveredBranches.length > 0) {
  console.log(`Uncovered changed branches (${uncoveredBranches.length}): ${formatSamples(uncoveredBranches)}`);
}
if (missingCoverage.length > 0) {
  console.error(`Missing LCOV records (${missingCoverage.length}): ${formatSamples(missingCoverage)}`);
}
if (zeroHitFiles.length > 0) {
  console.error(`Changed files with zero coverage (${zeroHitFiles.length}): ${formatSamples(zeroHitFiles)}`);
}
if (missingCoverage.length > 0 || zeroHitFiles.length > 0 || percentage < threshold || branchPercentage < threshold) {
  console.error(`FAIL: changed coverage is incomplete or below ${threshold}%`);
  process.exit(1);
}
console.log(`PASS: changed-line and changed-branch coverage meet ${threshold}% thresholds`);
