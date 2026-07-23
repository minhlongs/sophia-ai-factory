#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = "/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/migrations";

function walk(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
}

function splitPrefix(name) {
  const base = name.replace(/\.sql$/, "");
  const m = base.match(/^(\d+)/);
  return m ? m[1] : null;
}

function buildGroups(files) {
  const groups = new Map();
  for (const f of files) {
    const p = splitPrefix(f);
    if (!p) continue;
    const arr = groups.get(p) || [];
    arr.push(f);
    groups.set(p, arr);
  }
  const dupes = [];
  for (const [p, arr] of groups.entries()) {
    if (arr.length > 1) dupes.push({ prefix: p, files: arr });
  }
  dupes.sort((a, b) => a.prefix.localeCompare(b.prefix, undefined, { numeric: true }));
  return dupes;
}

const files = walk(MIGRATIONS_DIR);
const dupes = buildGroups(files);

const out = {
  generatedAt: new Date().toISOString(),
  directory: MIGRATIONS_DIR.replace("/Users/macbook/sophia-ai-factory/", ""),
  totalFiles: files.length,
  duplicateGroups: dupes.length,
  groups: dupes.map((g) => ({
    prefix: g.prefix,
    count: g.files.length,
    files: g.files,
  })),
};

console.log(JSON.stringify(out, null, 2));
