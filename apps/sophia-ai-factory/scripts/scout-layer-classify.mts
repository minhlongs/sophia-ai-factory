/**
 * scout-layer-classify.mts
 * Phase 01 dependency analysis for mekong restructure.
 * Classifies every .ts/.tsx file in src/ into: seed | tree | forest | land | AMBIGUOUS
 * Detects cross-layer violations (shallower layer importing deeper).
 * Usage: npx tsx scripts/scout-layer-classify.mts
 */

import { Project, SourceFile } from "ts-morph";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Types ──────────────────────────────────────────────────────────────────

type Layer = "seed" | "tree" | "forest" | "land" | "AMBIGUOUS";
const LAYER_IDX: Record<Layer, number> = {
  seed: 0,
  tree: 1,
  forest: 2,
  land: 3,
  AMBIGUOUS: -1,
};

interface FileRecord {
  path: string; // relative to src/
  layer: Layer;
  inboundRefs: number;
  outboundRefs: number;
  violations: string[]; // "importedPath (importedLayer)"
}

// ─── Classification Rules ───────────────────────────────────────────────────
// ORDER MATTERS — first match wins.

const LAND_PATTERNS = [
  "lib/billing",
  "lib/payments",
  "lib/status",
  "lib/refunds",
  "lib/payouts",
  "lib/affiliates",
  "lib/promo",
  "lib/orders",
  "lib/wallet",
  "lib/checkout",
  "app/[locale]/pricing",
  "app/[locale]/status",
  "app/[locale]/checkout",
  "app/[locale]/payment-success",
  "app/api/checkout",
  "app/api/payos",
  "app/api/payments",
  "app/api/refund-requests",
  "app/api/offers",
  "app/api/referral",
  "app/api/license",
  "app/api/analytics",
  "app/api/affiliates",
];

const FOREST_PATTERNS = [
  "lib/outbox",
  "lib/api-keys",
  "lib/email",
  "lib/onboarding",
  "lib/quota",
  "lib/usage-metering",
  "lib/usage-export",
  "lib/overage",
  "lib/raas",
  "lib/inngest",
  "lib/publishing",
  "lib/fulfillment",
  "lib/missions",
  "lib/campaigns",
  "lib/intelligence",
  "lib/discovery",
  "lib/sop",
  "lib/signals",
  "lib/observability",
  "lib/monitoring",
  "lib/analytics",
  "lib/agents",
  "lib/llm",
  "lib/mcu",
  "lib/ai",
  "lib/heygen",
  "lib/tiktok",
  "lib/youtube",
  "lib/video",
  "lib/openclaw",
  "lib/ingestion",
  "lib/cron",
  "middleware/tenant-isolation",
  "app/[locale]/onboarding",
  "app/[locale]/welcome",
  "app/[locale]/redeem",
  "app/[locale]/affiliate-discovery",
  "app/[locale]/dashboard",
  "app/api/v1",
  "app/api/v1/api-keys",
  "app/api/welcome",
  "app/api/cron",
  "app/api/ingestion",
  "app/api/intelligence",
  "app/api/inngest",
  "app/api/oauth",
  "app/api/sop",
  "app/api/discovery",
  "app/api/signals",
  "app/api/metrics",
  "app/api/media",
  "app/api/branding",
  "app/api/debug",
  "app/api/violations",
  "app/api/admin",
  "app/[locale]/(admin)",
  "app/[locale]/blog",
  "app/[locale]/guide",
];

const TREE_PATTERNS = [
  "app/setup-wizard",
  "lib/handover",
  "lib/telegram",
  "lib/byok",
  "lib/audit",
  "lib/credentials",
  "lib/clients",
  "lib/gateway",
  "lib/crypto",
  "lib/admin",
  "app/[locale]/dashboard/admin",
];

const SEED_PATTERNS = [
  "lib/db",
  "lib/utils",
  "lib/security",
  "types",
  "config",
  "lib/better-auth",
  "lib/agents/base-agent",
  "lib/health",
  "lib/redis",
  "lib/auth",
  "lib/i18n",
  "lib/schemas",
  "lib/validation",
  "lib/validators",
  "lib/core",
  "lib/shared",
  "lib/config",
  "lib/feature-flags",
  "lib/features",
  "lib/telemetry",
  "lib/supabase",
  "middleware-helpers",
  "middleware.ts",
  "navigation.ts",
  "i18n.ts",
  "app/api/auth",
  "app/api/health",
  "app/auth",
];

function classify(relPath: string): Layer {
  const norm = relPath.replace(/\\/g, "/");

  for (const p of LAND_PATTERNS) {
    if (norm.includes(p)) return "land";
  }
  for (const p of FOREST_PATTERNS) {
    if (norm.includes(p)) return "forest";
  }
  for (const p of TREE_PATTERNS) {
    if (norm.includes(p)) return "tree";
  }
  for (const p of SEED_PATTERNS) {
    if (norm.includes(p)) return "seed";
  }

  // Additional heuristics for remaining files
  if (norm.includes("components") || norm.includes("hooks") || norm.includes("sdk")) return "seed";
  if (norm.includes("utils")) return "seed";
  if (norm.includes("app/actions")) return "forest";
  if (norm.includes("app/api")) return "forest";
  if (norm.includes("app/[locale]")) return "land";
  if (norm.includes("worker")) return "seed";
  if (norm.includes("db/")) return "seed";
  if (norm.includes("data/")) return "seed";

  return "AMBIGUOUS";
}

// ─── Main ───────────────────────────────────────────────────────────────────

const APP_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(APP_DIR, "src");
const REPORTS_DIR = path.resolve(APP_DIR, "../../plans/reports");

async function main() {
  console.log("Loading project with ts-morph...");
  const project = new Project({
    tsConfigFilePath: path.join(APP_DIR, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
    skipFileDependencyResolution: false,
    addFilesFromTsConfig: true,
  });

  const sourceFiles = project.getSourceFiles().filter((sf) => {
    const fp = sf.getFilePath();
    return fp.startsWith(SRC_DIR) && !fp.includes("node_modules");
  });

  console.log(`Loaded ${sourceFiles.length} source files.`);

  const records = new Map<string, FileRecord>();
  const inboundCount = new Map<string, number>();

  // First pass: classify all files
  for (const sf of sourceFiles) {
    const absPath = sf.getFilePath();
    const relPath = path.relative(SRC_DIR, absPath);
    const layer = classify(relPath);
    records.set(absPath, {
      path: relPath,
      layer,
      inboundRefs: 0,
      outboundRefs: 0,
      violations: [],
    });
  }

  // Second pass: analyze imports
  for (const sf of sourceFiles) {
    const absPath = sf.getFilePath();
    const record = records.get(absPath)!;
    const imports = sf.getImportDeclarations();

    for (const imp of imports) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      // Only care about local imports (not node_modules)
      if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("@/")) continue;

      let resolvedPath: string | undefined;

      if (moduleSpecifier.startsWith("@/")) {
        // @/ maps to src/
        const rel = moduleSpecifier.slice(2); // remove @/
        const candidates = [
          path.join(SRC_DIR, rel),
          path.join(SRC_DIR, rel + ".ts"),
          path.join(SRC_DIR, rel + ".tsx"),
          path.join(SRC_DIR, rel, "index.ts"),
          path.join(SRC_DIR, rel, "index.tsx"),
        ];
        resolvedPath = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      } else {
        // relative import
        const dir = path.dirname(absPath);
        const base = path.resolve(dir, moduleSpecifier);
        const candidates = [
          base,
          base + ".ts",
          base + ".tsx",
          path.join(base, "index.ts"),
          path.join(base, "index.tsx"),
        ];
        resolvedPath = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      }

      if (!resolvedPath) continue;
      if (!resolvedPath.startsWith(SRC_DIR)) continue;

      record.outboundRefs++;
      inboundCount.set(resolvedPath, (inboundCount.get(resolvedPath) ?? 0) + 1);

      const importedRecord = records.get(resolvedPath);
      if (!importedRecord) continue;

      const fileLayerIdx = LAYER_IDX[record.layer];
      const importedLayerIdx = LAYER_IDX[importedRecord.layer];

      // Violation: shallower layer (lower idx) imports deeper layer (higher idx)
      if (
        fileLayerIdx !== -1 &&
        importedLayerIdx !== -1 &&
        fileLayerIdx < importedLayerIdx
      ) {
        record.violations.push(
          `${importedRecord.path} (${importedRecord.layer})`
        );
      }
    }
  }

  // Apply inbound counts
  for (const [absPath, count] of inboundCount.entries()) {
    const r = records.get(absPath);
    if (r) r.inboundRefs = count;
  }

  // ─── Aggregate ─────────────────────────────────────────────────────────────

  const byLayer: Record<Layer, FileRecord[]> = {
    seed: [],
    tree: [],
    forest: [],
    land: [],
    AMBIGUOUS: [],
  };

  for (const r of records.values()) {
    byLayer[r.layer].push(r);
  }

  // All violations flattened
  const allViolations: Array<{
    fromFile: string;
    fromLayer: Layer;
    toImport: string;
    toLayer: string;
    direction: "UP=violation";
  }> = [];

  for (const r of records.values()) {
    for (const v of r.violations) {
      const match = v.match(/^(.*)\s\((\w+)\)$/);
      if (!match) continue;
      allViolations.push({
        fromFile: r.path,
        fromLayer: r.layer,
        toImport: match[1],
        toLayer: match[2],
        direction: "UP=violation",
      });
    }
  }

  // Sort violations: seed violations first (most critical), then tree, forest
  allViolations.sort((a, b) => {
    const aIdx = LAYER_IDX[a.fromLayer as Layer] ?? 99;
    const bIdx = LAYER_IDX[b.fromLayer as Layer] ?? 99;
    return aIdx - bIdx;
  });

  const top50 = allViolations.slice(0, 50);

  // ─── Write CSV ──────────────────────────────────────────────────────────────

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const csvPath = path.join(REPORTS_DIR, "scout-260503-classification.csv");
  const csvLines = [
    "path,target_layer,inbound_refs,outbound_refs,cross_layer_violations",
    ...Array.from(records.values()).map((r) =>
      `"${r.path}","${r.layer}",${r.inboundRefs},${r.outboundRefs},${r.violations.length}`
    ),
  ];
  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");
  console.log(`CSV written: ${csvPath}`);

  // ─── Write Markdown Report ──────────────────────────────────────────────────

  const totalFiles = records.size;
  const violationCount = allViolations.length;
  const feasibility =
    violationCount === 0
      ? "PROCEED"
      : violationCount <= 20
      ? "PROCEED (with pre-fixes)"
      : violationCount <= 100
      ? "PROCEED (cautiously, fix violations in Phase 02.5)"
      : "BLOCK";

  const layerTableRows = (
    ["seed", "tree", "forest", "land", "AMBIGUOUS"] as Layer[]
  ).map((l) => {
    const files = byLayer[l];
    const samples = files
      .slice(0, 5)
      .map((f) => f.path)
      .join("<br/>");
    return `| ${l} | ${files.length} | ${samples} |`;
  });

  const ambiguousRows = byLayer.AMBIGUOUS.map((f) => {
    // Suggest layer from path
    const suggestion = suggestLayer(f.path);
    return `| \`${f.path}\` | ${suggestion} |`;
  });

  const violationRows = top50.map(
    (v) =>
      `| \`${v.fromFile}\` | ${v.fromLayer} | \`${v.toImport}\` | ${v.toLayer} | UP=VIOLATION |`
  );

  const routePages = [
    ...Array.from(records.keys())
      .filter(
        (k) =>
          k.endsWith("route.ts") ||
          k.endsWith("page.tsx") ||
          k.endsWith("layout.tsx")
      )
      .map((k) => `| \`${path.relative(SRC_DIR, k)}\` |`),
  ];

  const report = `# Scout Report — Phase 01 Dependency Graph
Generated: ${new Date().toISOString()}

## Executive Summary

| Metric | Value |
|---|---|
| Total TS/TSX files scanned | ${totalFiles} |
| seed | ${byLayer.seed.length} |
| tree | ${byLayer.tree.length} |
| forest | ${byLayer.forest.length} |
| land | ${byLayer.land.length} |
| AMBIGUOUS | ${byLayer.AMBIGUOUS.length} |
| Cross-layer violations | ${violationCount} |
| Refactor feasibility | **${feasibility}** |

> Violations = shallower layer importing deeper layer (e.g., seed → forest = BAD).
> These must be fixed before Phase 03 file moves begin.

---

## Layer Classification Table

| Layer | File Count | Sample Files (5) |
|---|---|---|
${layerTableRows.join("\n")}

---

## AMBIGUOUS Files (require human assignment)

${
  byLayer.AMBIGUOUS.length === 0
    ? "_None — all files classified._"
    : `| File | Recommended Layer |
|---|---|
${ambiguousRows.join("\n")}`
}

---

## Cross-Layer Violations (top 50 of ${violationCount})

${
  violationCount === 0
    ? "_No violations detected. Safe to proceed._"
    : `| From File | From Layer | To Import | To Layer | Direction |
|---|---|---|---|---|
${violationRows.join("\n")}`
}

---

## Route File Census (CANNOT MOVE — Next.js convention)

These files stay at their current paths. Only their imports may be rewritten in later phases.

| File |
|---|
${routePages.slice(0, 80).join("\n")}
${routePages.length > 80 ? `\n_...and ${routePages.length - 80} more route/page/layout files._` : ""}

---

## Tooling Decision

**Recommendation: ts-morph**

Justification:
- Codebase is 100% TypeScript — ts-morph loads the real tsconfig.json, resolving all path aliases (@/ → src/) natively.
- jscodeshift is optimized for codemod transforms, not static analysis/classification.
- ts-morph gives full import resolution + type info needed for accurate violation detection.
- File count (${totalFiles}) is within ts-morph's sweet spot; runtime ~30-60s acceptable for a one-shot scout.
- Madge lacks @/ alias support without custom config.

---

## Vitest / Inngest Findings

### Vitest Path Resolution
- **vite-tsconfig-paths**: NOT loaded in vitest.config.ts.
  Current config uses manual \`resolve.alias: { '@': path.resolve(__dirname, './src') }\` — functionally equivalent.
  No remediation needed for Phase 02.
- **Note:** If new packages are added that rely on tsconfig paths beyond \`@/\`, vite-tsconfig-paths should be added.

### Inngest Discovery
- **inngest.config.ts**: Does NOT exist. Functions registered explicitly in \`src/app/api/inngest/route.ts\` via \`serve({ functions: [...] })\`.
- **Registration pattern**: Explicit array in route handler — NOT path-based autodiscovery.
- **Impact**: Safe to move \`src/lib/inngest/\` — update import paths in route handler only.
- **Functions directory**: \`src/lib/inngest/functions/\` — 15 functions, all explicitly imported.

---

## Bundle Baseline

| Metric | Value |
|---|---|
| .open-next/server-functions/default | **119 MB** |
| Threshold target (Phase 09) | < 80 MB (32% reduction goal) |
| Status | Baseline recorded |

---

## Test File Analysis (Playwright/Cypress)

- **E2E test files**: \`tests/e2e/*.spec.ts\` (6 files)
- **No \`@/\` imports found** in tests/e2e/ — Playwright tests use HTTP only (no direct src imports).
- **Vitest unit tests**: Co-located in \`src/**/*.test.{ts,tsx}\` — use \`@/\` imports via vitest.config.ts alias.
  These tests move WITH their source files in Phase 03+.
- **Integration test**: \`tests/middleware.test.ts.skip\` (skipped, no @/ imports).

---

## Pre-Refactor Action Items (Before Phase 03)

${
  violationCount === 0
    ? "None — codebase is clean. Proceed to Phase 02."
    : `The following fixes MUST complete before Phase 03 starts:

${top50
  .slice(0, 20)
  .map(
    (v, i) =>
      `${i + 1}. Remove/refactor import of \`${v.toImport}\` (${v.toLayer}) from \`${v.fromFile}\` (${v.fromLayer})`
  )
  .join("\n")}

${
  violationCount > 20
    ? `\n> Full list in CSV: \`plans/reports/scout-260503-classification.csv\``
    : ""
}`
}

---

## Unresolved Questions

1. **AMBIGUOUS files > 10?** If so, need manual review pass before Phase 03.
2. **\`src/components/\`** — classified as seed. Confirm: are there any dashboard-specific components that should be forest/land?
3. **\`src/db/\`** — root-level db directory (separate from lib/db). Confirm target layer = seed.
4. **Worker files** (\`src/worker/\`) — classified seed. Confirm these are build-time infra, not business logic.
5. **\`src/sdk/\`** — classified seed. Confirm SDK is a pure utility layer (no billing/forest deps).
`;

  const reportPath = path.join(REPORTS_DIR, "scout-260503-dependency-graph.md");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`Report written: ${reportPath}`);
  console.log(`\nSummary:`);
  console.log(`  Total files: ${totalFiles}`);
  console.log(`  seed: ${byLayer.seed.length}`);
  console.log(`  tree: ${byLayer.tree.length}`);
  console.log(`  forest: ${byLayer.forest.length}`);
  console.log(`  land: ${byLayer.land.length}`);
  console.log(`  AMBIGUOUS: ${byLayer.AMBIGUOUS.length}`);
  console.log(`  Violations: ${violationCount}`);
  console.log(`  Verdict: ${feasibility}`);
}

function suggestLayer(relPath: string): string {
  // Quick heuristic for AMBIGUOUS files
  const norm = relPath.replace(/\\/g, "/");
  if (norm.includes("billing") || norm.includes("payment") || norm.includes("checkout")) return "land";
  if (norm.includes("agent") || norm.includes("campaign") || norm.includes("mission")) return "forest";
  if (norm.includes("db") || norm.includes("type") || norm.includes("util")) return "seed";
  if (norm.includes("telegram") || norm.includes("handover")) return "tree";
  return "AMBIGUOUS (review manually)";
}

main().catch((err) => {
  console.error("Scout script failed:", err);
  process.exit(1);
});
