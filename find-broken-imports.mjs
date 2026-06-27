#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const BASE_DIR = '/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory';
const SRC_DIR = path.join(BASE_DIR, 'src');

const PATH_MAPPINGS = {
  '@/*': './src/*',
  '@/seed/*': './src/seed/*',
  '@/tree/*': './src/tree/*',
  '@/forest/*': './src/forest/*',
  '@/land/*': './src/land/*'
};

const EXTERNAL_MODULES = new Set([
  'next', 'next/intl', 'next/navigation', 'next/image', 'next/link', 'next/head',
  'react', 'react-dom', 'react/jsx-runtime',
  '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-avatar',
  '@tanstack/react-query', '@tanstack/react-table',
  '@supabase/ssr', '@supabase/supabase-js',
  'stripe', 'clsx', 'class-variance-authority', 'tailwind-merge', 'lucide-react',
  'date-fns', 'react-hook-form', '@hookform/resolvers', 'zod',
  'vitest', '@testing-library/react', '@testing-library/dom', 'jsdom',
]);

let totalFiles = 0, filesWithIssues = 0;
const brokenImports = [], missingFiles = new Set();

function isExternalModule(importPath) {
  if (importPath.startsWith('http://') || importPath.startsWith('https://') || importPath.startsWith('/') || importPath.includes(':')) return true;
  if (importPath.startsWith('.')) return false;
  const baseModule = importPath.split('/')[0];
  return EXTERNAL_MODULES.has(importPath) || EXTERNAL_MODULES.has(baseModule);
}

function resolveAliasPath(importPath) {
  for (const [pattern, target] of Object.entries(PATH_MAPPINGS)) {
    const prefix = pattern.replace('/*', '');
    if (importPath.startsWith(prefix)) {
      const rel = importPath.slice(prefix.length);
      return path.join(BASE_DIR, target.replace('*', rel));
    }
  }
  return null;
}

function fileExists(importPath) {
  if (missingFiles.has(importPath)) return false;
  const fullPath = path.resolve(SRC_DIR, importPath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return true;
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.json'];
  for (const ext of exts) {
    const p = fullPath + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return true;
  }
  const dir = fullPath.replace(/\/[^/]+$/, '');
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    if (fs.existsSync(path.join(dir, 'index.ts')) || fs.existsSync(path.join(dir, 'index.js'))) return true;
  }
  missingFiles.add(importPath);
  return false;
}

function extractImports(content) {
  const imports = new Set();
  const patterns = [
    /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:\{[^}]+\}\s*from\s+)?['"]([^'"]+)['"]/g,
    /import\s+type\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(content)) !== null) imports.add(m[1]);
  }
  return [...imports];
}

function checkFile(filePath) {
  const relPath = path.relative(BASE_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const broken = [];
  for (const imp of extractImports(content)) {
    if (!imp || isExternalModule(imp)) continue;
    let resolved = null;
    if (imp.startsWith('@/')) resolved = resolveAliasPath(imp);
    else if (imp.startsWith('.')) {
      resolved = path.resolve(path.dirname(filePath), imp);
      if (resolved.includes(SRC_DIR)) resolved = path.relative(SRC_DIR, resolved);
    }
    if (resolved && !fileExists(resolved)) {
      broken.push({ import: imp, resolved, file: relPath });
    }
  }
  return broken;
}

function scanDirectory(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || (entry.name.startsWith('.') && entry.name !== '.claude' && entry.name !== '.git')) continue;
      files.push(...scanDirectory(p));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) files.push(p);
    }
  }
  return files;
}

console.log('🔍 Đang quét broken import paths trong Sophia AI Factory...\n');
console.log(`📁 Thư mục: ${BASE_DIR}/src\n`);

console.log('⏳ Đang thu thập danh sách file...');
let allFiles = [];
try {
  allFiles = scanDirectory(SRC_DIR);
  totalFiles = allFiles.length;
  console.log(`📄 Tìm thấy ${totalFiles} file TypeScript/JavaScript\n`);
} catch (err) {
  console.error('❌ Lỗi khi quét thư mục:', err.message);
  process.exit(1);
}

console.log('🔍 Đang kiểm tra imports...\n');

let fileCount = 0;
for (const file of allFiles) {
  fileCount++;
  if (fileCount % 100 === 0) {
    process.stdout.write(`\r  Đã xử lý ${fileCount}/${totalFiles} files...`);
  }
  try {
    const broken = checkFile(file);
    if (broken.length > 0) {
      filesWithIssues++;
      broken.forEach(b => brokenImports.push(b));
    }
  } catch (e) {}
}
if (totalFiles > 0) console.log(`\r  ✅ Đã xử lý ${totalFiles}/${totalFiles} files\n`);

console.log('='.repeat(70));
console.log('📊 KẾT QUẢ QUÉT BROKEN IMPORTS');
console.log('='.repeat(70));
console.log(`\n📁 Tổng số file đã quét: ${totalFiles}`);
console.log(`⚠️  File có broken imports: ${filesWithIssues}`);
console.log(`❌ Tổng số broken imports: ${brokenImports.length}\n`);

if (brokenImports.length === 0) {
  console.log('✅ KHÔNG TÌM THẤY BROKEN IMPORTS NÀO!\n');
  process.exit(0);
}

const byFile = {};
for (const bi of brokenImports) {
  if (!byFile[bi.file]) byFile[bi.file] = [];
  byFile[bi.file].push(bi);
}

console.log('📋 DANH SÁCH BROKEN IMPORTS THEO FILE:\n');
for (const [file, issues] of Object.entries(byFile)) {
  console.log(`📄 ${file}:`);
  for (const issue of issues) {
    console.log(`   ❌ import '${issue.import}'`);
    console.log(`      → Resolved: ${issue.resolved}`);
  }
  console.log('');
}

const byImport = {};
for (const bi of brokenImports) byImport[bi.import] = (byImport[bi.import] || 0) + 1;
const sorted = Object.entries(byImport).sort((a, b) => b[1] - a[1]);

console.log('='.repeat(70));
console.log('📈 TỔNG KẾT THEO LOẠI IMPORT:\n');
for (const [imp, count] of sorted) console.log(`  '${imp}': ${count} lần`);

console.log('\n' + '='.repeat(70));
console.log('⚠️  CÁC FILE NÀY CẦN ĐƯỢC SỬA IMPORTS!\n');

const output = '/Users/macbook/projects/sophia-ai-factory/broken-imports-report.json';
fs.writeFileSync(output, JSON.stringify({ totalFiles, filesWithIssues, brokenImports, byFile, byImport }, null, 2));
console.log(`📄 Báo cáo chi tiết đã được lưu vào: ${output}\n`);

process.exit(1);
