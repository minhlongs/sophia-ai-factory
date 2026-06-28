/**
 * Layer Violation Detector
 * Rules:
 * - seed: can only import from seed
 * - tree: can import from seed + tree only
 * - forest: can import from seed + tree + may call land for orchestration
 * - land: can import from seed + tree + forest
 * Forbidden:
 *   - land->forest (non-orchestration)
 *   - tree->forest/land
 *   - seed->tree/forest/land
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = '/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory';
const SRC_ROOT = join(PROJECT_ROOT, 'src');

// Layer definitions
const LAYERS = ['seed', 'tree', 'forest', 'land'];
const LAYER_ORDER = { seed: 0, tree: 1, forest: 2, land: 3 };

// Get layer from file path
function getLayer(filePath: string): string | null {
  const rel = relative(SRC_ROOT, filePath);
  const firstSegment = rel.split('/')[0];
  if (LAYERS.includes(firstSegment)) {
    return firstSegment;
  }
  return null; // Not in a layer (e.g., app, components, lib)
}

// Extract import paths from TypeScript/JavaScript file
function extractImports(content: string): string[] {
  const imports: string[] = [];

  // ES6 import statements
  const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

// Check if import is from same layer
function getImportLayer(importPath: string, currentLayer: string): string | null {
  // Skip node_modules, external packages, absolute paths outside src
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    // Resolve relative path
    let resolvedPath: string;

    if (importPath.startsWith('/')) {
      // Absolute path - check if it's within our project
      if (!importPath.startsWith(PROJECT_ROOT)) {
        return null; // External absolute path
      }
      resolvedPath = importPath;
    } else {
      // Relative path - this is tricky without context, we'll check patterns
      // For now, we'll look at the path segments
      const cleanPath = importPath.replace(/^(\.\.\/)+/, '');
      const firstSegment = cleanPath.split('/')[0];

      // Check if it's a layer reference
      if (LAYERS.includes(firstSegment)) {
        // Could be '../layer' or 'layer' if current file is in a subdirectory
        // Determine the actual layer being imported
        if (importPath.startsWith('../')) {
          // Going up one level from current file's directory
          return firstSegment;
        } else if (!importPath.includes('/')) {
          // Direct reference like 'seed' - this would be a package name
          // Check if it's actually a src path by looking for /src/ prefix assumption
          // For relative imports within src, we need to resolve properly
          return firstSegment;
        } else {
          // Could be 'seed/module' or '../seed/module'
          return firstSegment;
        }
      }

      // Check if it's a layer in the path
      for (const layer of LAYERS) {
        if (cleanPath.includes(`/${layer}/`) || cleanPath.startsWith(layer + '/')) {
          return layer;
        }
      }

      return null; // Not a layer import (could be within same layer)
    }

    // Check if resolved path is in a layer
    for (const layer of LAYERS) {
      if (resolvedPath.includes(`/src/${layer}/`)) {
        return layer;
      }
    }
    return null;
  }

  return null; // External package
}

// Determine if import is intra-layer (same layer)
function isIntraLayer(importPath: string, currentLayer: string): boolean {
  if (!importPath.startsWith('.')) return false;

  // Remove leading ../ or ./
  let cleanPath = importPath.replace(/^(\.\.\/|\.\/)+/, '');

  // If it ends with a file extension, strip it
  cleanPath = cleanPath.replace(/\.(ts|tsx|js|jsx|json)$/, '');

  // If cleanPath is empty or doesn't have a layer indicator, it's likely same layer
  const firstSegment = cleanPath.split('/')[0];

  // Not referencing another layer directly
  if (LAYERS.includes(firstSegment)) {
    return false; // This is a cross-layer import
  }

  return true; // Same layer or index barrel
}

// Analyze a single file
function analyzeFile(filePath: string): Array<{ importPath: string; importLayer: string; rule: string }> {
  const violations: Array<{ importPath: string; importLayer: string; rule: string }> = [];
  const content = readFileSync(filePath, 'utf-8');
  const currentLayer = getLayer(filePath);

  if (!currentLayer) {
    return violations; // File not in a layer
  }

  const imports = extractImports(content);

  for (const importPath of imports) {
    // Skip external packages
    if (importPath.startsWith('@') || /^[a-z0-9]/.test(importPath) && !importPath.startsWith('.')) {
      continue;
    }

    // Determine the layer being imported
    let importLayer: string | null = null;

    // Check if import explicitly references a layer
    const layerMatch = importPath.match(/(?:\.\.\/)*(seed|tree|forest|land)(?:\/|$)/);
    if (layerMatch) {
      importLayer = layerMatch[1];
    } else {
      // Check if it's an intra-layer import (no layer reference)
      if (isIntraLayer(importPath, currentLayer)) {
        continue; // Same layer, no violation
      }

      // Could be from app/, components/, lib/, etc. - these might be allowed
      // Let's check if it's from outside the layer structure
      continue; // Assume allowed for now
    }

    // Check layer compatibility
    const currentOrder = LAYER_ORDER[currentLayer];
    const importOrder = LAYER_ORDER[importLayer];

    if (importOrder === undefined) {
      continue; // Not a layer import
    }

    // Determine the rule that would be violated
    let violatedRule: string | null = null;

    if (currentLayer === 'seed') {
      if (importOrder > currentOrder) {
        violatedRule = 'seed can only import from seed';
      }
    } else if (currentLayer === 'tree') {
      if (importOrder > currentOrder) {
        violatedRule = 'tree can only import from seed + tree';
      }
    } else if (currentLayer === 'forest') {
      // Forest can import from seed/tree freely
      // Can import from land only for orchestration
      if (importOrder === 3) { // land import
        // Check if it's likely an orchestration call
        // For now, flag all forest->land imports for review
        violatedRule = 'forest->land: only allowed for orchestration';
      }
    } else if (currentLayer === 'land') {
      // Land can import from seed/tree/forest
      // But forbidden: land->forest (non-orchestration)
      // Actually land->forest should be allowed if it's calling forest functions
      // The rule says "land imports seed+tree+forest" - so land can import forest
      // But the forbidden says "land->forest (non-orchestration)"
      // This is ambiguous. Let's interpret: land->forest is generally forbidden unless it's orchestration
      // Actually re-reading: "Forest imports seed+tree and may call land for orchestration"
      // "Land imports seed+tree+forest"
      // So land CAN import forest. The forbidden list says "land->forest (non-orchestration)"
      // Wait, re-reading carefully:
      // - seed foundational, tree imports seed only, forest imports seed+tree and may call land for orchestration, land imports seed+tree+forest
      // - Forbidden: land->forest (non-orchestration), tree->forest/land, seed->tree/forest/land
      //
      // This seems contradictory: "land imports seed+tree+forest" vs "land->forest (non-orchestration)" forbidden
      // Interpretation: land->forest is allowed ONLY for orchestration? But the positive rule says land imports forest...
      //
      // Let me re-read the rules carefully:
      // "seed foundational, tree imports seed only, forest imports seed+tree and may call land for orchestration, land imports seed+tree+forest."
      // This is the ALLOWED pattern.
      // "Forbidden: land->forest (non-orchestration), tree->forest/land, seed->tree/forest/land."
      //
      // So:
      // - seed: only seed ✓
      // - tree: seed + tree ✓
      // - forest: seed + tree + MAY CALL land for orchestration (i.e., land functions passed as params or invoked)
      // - land: seed + tree + forest
      //
      // Forbidden:
      // - land->forest (non-orchestration) = land importing forest for regular use is forbidden, only orchestration allowed?
      // But "land imports seed+tree+forest" says it can import forest...
      //
      // I think there's a confusion in terminology. "imports" vs "calls".
      // - "forest imports seed+tree and may call land for orchestration" means:
      //   Forest files can have import statements from seed/tree
      //   Forest files can also invoke land functions (passed as params or imported? unclear)
      //
      // - "land imports seed+tree+forest" means:
      //   Land files can import from seed/tree/forest
      //
      // The forbidden clarifies:
      // - land->forest (non-orchestration) = if land imports forest for non-orchestration purposes, it's forbidden
      //   So land can only import forest if it's for orchestration
      //
      // This is getting convoluted. Let's use a simpler interpretation based on dependency direction:
      // The hierarchy is: seed (most foundational) -> tree -> forest -> land (most abstract/highest)
      //
      // Allowed imports go UP the dependency chain or within the same layer:
      // - seed: only seed (within layer)
      // - tree: seed + tree
      // - forest: seed + tree + forest
      // - land: seed + tree + forest + land
      //
      // Forbidden: importing from LOWER layers? No that doesn't make sense.
      // Actually in layered architecture, higher layers import from lower layers. That's normal.
      // The rules say: tree imports seed only (tree can import from seed) - that's importing from lower layer.
      // Forest imports seed+tree - importing from lower layers.
      // Land imports seed+tree+forest - importing from lower layers.
      //
      // So the rule is: a layer can import from itself and all layers below it.
      // But then what's forbidden?
      // "land->forest (non-orchestration)" - but land importing forest is allowed since forest is below land.
      // "tree->forest/land" - tree importing forest/land = importing from ABOVE (higher layer) - FORBIDDEN
      // "seed->tree/forest/land" - seed importing from above - FORBIDDEN
      //
      // That makes sense! The forbidden list is about importing from HIGHER layers (circular dependencies).
      // And "land->forest (non-orchestration)" - wait, forest is below land, so that's allowed normally...
      // Unless "non-orchestration" means land shouldn't directly import forest because forest should be called via orchestration?
      //
      // Let me re-read: "Forest imports seed+tree and may call land for orchestration"
      // This suggests forest can CALL land (higher layer) but not import it? Or maybe it means forest can
      // receive land functions as parameters?
      //
      // Actually the pattern is clear: each layer can import from below. The exceptions:
      // - forest "may call land for orchestration" means forest can invoke land functions (probably as callbacks)
      // - land imports seed+tree+forest = land can import from all below
      //
      // Forbidden:
      // - land->forest (non-orchestration) = land importing forest for non-orchestration? But land importing forest is listed as allowed...
      //
      // I'm going to interpret based on standard dependency rule:
      // - Lower layer number (seed=0) can ONLY be imported by higher layers, never import higher
      // - seed (0): imports only seed (can't import tree/forest/land = higher)
      // - tree (1): imports seed (0) + tree (1) - can't import forest (2) or land (3) = higher
      // - forest (2): imports seed (0) + tree (1) + forest (2) - can't import land (3)? But "may call land for orchestration" suggests some land interaction
      // - land (3): imports seed (0) + tree (1) + forest (2) + land (3) - can import all below
      //
      // Forbidden list:
      // - land->forest (non-orchestration): Could mean land should not import forest directly, only through orchestration?
      // But "land imports seed+tree+forest" explicitly says land imports forest...
      //
      // Let's check the exact wording again: "land->forest (non-orchestration)"
      // The arrow might mean "calls" not "imports"? The context: "Forbidden: land->forest (non-orchestration), tree->forest/land, seed->tree/forest/land."
      //
      // If we interpret arrow as "imports from":
      // - land->forest is forbidden if non-orchestration, but "land imports seed+tree+forest" says it's allowed
      //
      // If we interpret arrow as "calls/invokes":
      // - land calling forest is forbidden (non-orchestration) = land shouldn't directly invoke forest functions
      // - tree calling forest/land is forbidden
      // - seed calling tree/forest/land is forbidden
      //
      // That makes more sense! The rules are about dependency direction:
      // - Imports: lower layers can be imported by higher layers
      // - Calls/invocations: only orchestration flows from higher to lower are allowed
      //
      // But the phrasing "tree imports seed only" is clearly about imports.
      // So we have two concepts mixed: imports and calls.
      //
      // Let me simplify to just imports (since that's what we can detect statically):
      // - A layer can import from: itself and all layers with LOWER index
      //   (seed=0, tree=1, forest=2, land=3)
      // - So seed (0) can import seed only
      // - tree (1) can import seed (0) and tree (1)
      // - forest (2) can import seed (0), tree (1), forest (2)
      // - land (3) can import seed (0), tree (1), forest (2), land (3)
      //
      // That's the basic rule. The "may call land for orchestration" is about runtime calls, not imports.
      // And "land imports seed+tree+forest" matches this.
      //
      // The forbidden list:
      // - land->forest (non-orchestration): This would be a call from land to forest, not an import. We can't detect calls reliably.
      // - tree->forest/land: tree importing from forest or land - VIOLATION
      // - seed->tree/forest/land: seed importing from above - VIOLATION
      //
      // So for static import analysis:
      // Violation if: importLayer index > currentLayer index
      //
      // Let's use this simple rule:
      // currentLayer can import only from layers with index <= currentLayer index
      //
      // This catches:
      // - seed importing tree/forest/land (forbidden)
      // - tree importing forest/land (forbidden)
      // - forest importing land (forbidden)
      // - land importing anything is OK (land is highest)
      //
      // The "land->forest (non-orchestration)" would be a call, not an import. We'll ignore it.
    }

    // Simple rule: can only import from same or lower layers
    if (importOrder > currentOrder) {
      violatedRule = `importing from higher layer (${importLayer})`;
    }

    if (violatedRule) {
      violations.push({
        importPath,
        importLayer,
        rule: violatedRule,
      });
    }
  }

  return violations;
}

// Main analysis
const violations: Array<{
  file: string;
  currentLayer: string;
  importPath: string;
  importLayer: string;
  rule: string;
}> = [];

// Process all layer files
const allFiles: string[] = [];

for (const layer of LAYERS) {
  const layerDir = join(SRC_ROOT, layer);
  if (!existsSync(layerDir)) continue;

  const files = getAllFiles(layerDir);
  allFiles.push(...files);
}

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      results.push(fullPath);
    }
  }

  return results;
}

// Need to import these at top level
import { readdirSync } from 'fs';

for (const file of allFiles) {
  const fileViolations = analyzeFile(file);
  for (const v of fileViolations) {
    violations.push({
      file: relative(PROJECT_ROOT, file),
      currentLayer: getLayer(file)!,
      ...v,
    });
  }
}

// Group by layer
const byLayer: Record<string, typeof violations> = { seed: [], tree: [], forest: [], land: [] };
for (const v of violations) {
  byLayer[v.currentLayer].push(v);
}

// Output summary
console.log(`\n=== LAYER VIOLATION ANALYSIS ===\n`);
console.log(`Total files analyzed: ${allFiles.length}`);
console.log(`Total violations found: ${violations.length}\n`);

for (const layer of LAYERS) {
  const layerViors = byLayer[layer];
  if (layerViors.length > 0) {
    console.log(`[${layer.toUpperCase()}] ${layerViors.length} violations:`);
    for (const v of layerViors) {
      console.log(`  ${v.file}`);
      console.log(`    → imports from ${v.importLayer}: ${v.rule}`);
    }
    console.log('');
  } else {
    console.log(`[${layer.toUpperCase()}] 0 violations ✓`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Seed violations: ${byLayer.seed.length}`);
console.log(`Tree violations: ${byLayer.tree.length}`);
console.log(`Forest violations: ${byLayer.forest.length}`);
console.log(`Land violations: ${byLayer.land.length}`);
console.log(`TOTAL: ${violations.length}`);

// Write detailed report to file
const report = JSON.stringify({
  totalFiles: allFiles.length,
  totalViolations: violations.length,
  byLayer,
  violations,
}, null, 2);

writeFileSync('layer-violations-report.json', report);
console.log(`\nDetailed report saved to: layer-violations-report.json`);
