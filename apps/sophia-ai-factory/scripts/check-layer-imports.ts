#!/usr/bin/env node
/**
 * check-layer-imports.ts — Regex-based layer-boundary enforcement for Sophia AI Factory.
 *
 * Scans src/(seed|tree|forest|land) for three violation classes:
 *   (a) land file imports another land file that itself imports from forest
 *       (transitive land→forest violation — direct direct checks catch land->forest
 *       but a land -> land -> forest chain is still forbidden)
 *   (b) any file uses the four explicitly banned imports:
 *       @/lib/auth, @/lib/subscription, @/lib/unified-tier-config, @/lib/tier-gate
 *   (c) direct seed/tree/forest/land chain violations:
 *       seed -> tree|forest|land        (seed is foundational)
 *       tree -> forest|land            (tree is domain-only)
 *       land -> forest                 (circular; orchestration runs forest→land)
 *
 * Design choices (KISS):
 *   - Uses regex on raw text; no TS parser, no AST, no new npm dependencies.
 *   - Ignores __tests__ and *.test.ts(x) — test files may exercise internals.
 *   - Prints human-readable failures; exits 1 on any violation, 0 on clean.
 *
 * Run:  npx tsx scripts/check-layer-imports.ts
 *   or: npm run check:layers   (after adding to package.json)
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(process.cwd(), "src");
const LAYERS = ["seed", "tree", "forest", "land"] as const;
type Layer = (typeof LAYERS)[number];

const BANNED: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /@\/lib\/auth/, why: "banned — use @/seed/auth/better-auth-session" },
  { pattern: /@\/lib\/subscription/, why: "banned — use @/seed/db/get-user-tier" },
  { pattern: /@\/lib\/unified-tier-config/, why: "banned — use @/seed/config/tiers" },
  { pattern: /@\/lib\/tier-gate/, why: "banned — use @/seed/db/get-user-tier" },
];

// Direct chain rules: source layer may only import from these target layers.
// A missing target = forbidden.
const SELF_IMPORT_OK = new Set<Layer>(["land"]); // land→land is fine (same layer)
// Chain privilege is strictly seed → tree → forest → land.
// A layer MAY import from itself (stated via SELF_IMPORT_OK for land; all layers likewise).
// It must NOT reach backwards or sideways to a less-privileged layer.
// Extra: "land→forest" is additionally forbidden (would be circular for orchestration paths).
const CHAIN_RULES: Record<Layer, Layer[]> = {
  seed: [], // startup — foundational seed cannot import any business layer
  tree: ["seed"],
  forest: ["seed", "tree"],
  // land may import seed and tree only. It must NOT import forest (cross-layer orchestration
  // runs forest→land; importing forest back would be circular). Explicit exclusion in check below.
  land: ["seed", "tree"],
};

const IMPORT_PATTERN =
  /from\s+['"](@\/(?:seed|tree|forest|land)\/[^'"]+)['"]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    // skip _ prefixed folders (implementation detail directories)
    if (name.startsWith("_")) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.[tj]sx?$/.test(name))
      out.push(full);
  }
  return out;
}

function layerOf(file: string): Layer | null {
  let rel = relative(SRC, file);
  const first = rel.split(sep_)[0];
  return LAYERS.includes(first as Layer) ? (first as Layer) : null;
}
const sep_ = /[\\/]/;

function findLandFiles(landDirectory: string): string[] {
  const result: string[] = [];
  for (const name of readdirSync(landDirectory)) {
    const full = join(landDirectory, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("_")) continue;
      result.push(...findLandFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.[tj]sx?$/.test(name)) {
      result.push(full);
    }
  }
  return result;
}

interface Violation {
  file: string;
  line: number;
  target: string;
  rule: string;
}

const violations: Violation[] = [];

const files = walk(SRC);
const landDir = join(SRC, "land");
const landFiles: string[] = [];
try {
  landFiles.push(...findLandFiles(landDir));
} catch {
  // land/ may not exist in this project — landFiles stays empty
}

// Rule (a): transitive land→forest offenses.
// First: find land files that directly import forest (no self-import here is straight land/forest).
const landImportsForest = new Set<string>(); // absolute paths of land files that import @/forest/*
for (const f of landFiles) {
  const text = readFileToText(f);
  if (!text) continue;
  for (const m of text.matchAll(IMPORT_PATTERN)) {
    const target = m[1];
    if (target.startsWith("@/forest/")) {
      landImportsForest.add(f);
    }
  }
}
// Second: any land file importing another land file B, where B is in landImportsForest.
const forestImportingLandImports = new Map<string, string>(); // forest-path -> offending B path
for (const hit of landImportsForest) {
  const base = relative(SRC, hit);
  forestImportingLandImports.set(base, hit);
}
for (const f of landFiles) {
  const text = readFileToText(f);
  if (!text) continue;
  for (const m of text.matchAll(IMPORT_PATTERN)) {
    const target = m[1];
    const rel = target.slice(2); // strip "@/"
    const targetPath = rel.replace(sep_, "/");
    if (forestImportingLandImports.has(targetPath)) {
      const line = text.slice(0, m.index).split("\n").length;
      violations.push({
        file: relativeToCwd(f),
        line,
        target: `@/${targetPath} (→ @/forest/* via ${relativeToCwd(forestImportingLandImports.get(targetPath)!)})`,
        rule: "land→land→forest (transitive)",
      });
    }
  }
}

// Rules (b) and (c): walk all files once.
for (const f of files) {
  const text = readFileToText(f);
  if (!text) continue;
  const layer = layerOf(f);
  if (!layer) continue;

  const allowedTargetLayers = new Set<Layer>(CHAIN_RULES[layer]);
  for (const m of text.matchAll(IMPORT_PATTERN)) {
    const target = m[1]; // e.g. "@/land/billing/actions"
    const targetLayer = target.slice(2).split(sep_)[0] as Layer;
    if (!LAYERS.includes(targetLayer)) continue; // e.g. "@/seed/types/result" -> seed matches; ignore otherwise

    const line = text.slice(0, m.index).split("\n").length;

    // Rule (b): banned lib alias.
    for (const b of BANNED) {
      if (b.pattern.test(target)) {
        violations.push({
          file: relativeToCwd(f),
          line,
          target,
          rule: `banned import: ${b.why}`,
        });
      }
    }

    // Rule (c): chain violation.
    if (!allowedTargetLayers.has(targetLayer) && !(SELF_IMPORT_OK.has(layer) && targetLayer === layer)) {
      const direction = `${layer}→${targetLayer}`;
      // Surface known forbiddens with a friendly hint.
      let hint = "forbidden by 4-layer chain";
      if (layer === "seed" && (targetLayer === "tree" || targetLayer === "forest" || targetLayer === "land"))
        hint = "seed is foundational — import from @/seed/* directly";
      if (layer === "tree" && (targetLayer === "forest" || targetLayer === "land"))
        hint = "tree is domain-only — move shared infra to forest or seed";
      if (layer === "forest" && targetLayer === "land") hint = "allowed only for orchestration direct calls (EventBridge/Inngest dispatch); prefer event-driven handshake instead of import";
      if (layer === "land" && targetLayer === "forest") hint = "land must not import forest (circular) — invert to forest calling land";
      violations.push({
        file: relativeToCwd(f),
        line,
        target,
        rule: `${direction}: ${hint}`,
      });
    }
  }
}

if (violations.length === 0) {
  console.log("✅ Layer boundary check passed — 0 violations.");
  process.exit(0);
}

console.log(`❌ Layer boundary violations: ${violations.length}\n`);
for (const v of violations) {
  console.log(`${v.file}:${v.line}  →  ${v.target}`);
  console.log(`   ${v.rule}\n`);
}
process.exit(1);

function relativeToCwd(absolute: string): string {
  return relative(process.cwd(), absolute);
}

function readFileToText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
function readFileSync(p: string, enc: BufferEncoding): string {
  // Minimal wrapper so we're explicit about what we want.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("node:fs").readFileSync(p, enc);
}
