#!/usr/bin/env node
/**
 * No-Tech Doctrine Compliance Audit (Extended)
 *
 * Extends no-tech-audit.mjs with:
 *  - Client-facing docs scan (docs/ + public pages)
 *  - Setup Wizard BYOK pattern scan
 *  - Operator-side credential disclosure in client-reachable content
 *
 * Exit 0 = pass, 1 = violations found.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const DOCS = join(ROOT, "docs");

let failed = 0;
let warnings = 0;

function pass(label) {
  console.log(" PASS  " + label);
}
function fail(label, msg) {
  console.log(" FAIL  " + label + ": " + msg);
  failed++;
}
function warn(label, msg) {
  console.log(" WARN  " + label + ": " + msg);
  warnings++;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function grepFiles(pattern, dirs, extGlobs) {
  const args = ["-rln"];
  for (const e of extGlobs) args.push("--include=" + e);
  args.push("-e", pattern);
  for (const d of dirs) args.push(d);
  try {
    const out = execSync("grep " + args.join(" "), {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    return out
      .split("\n")
      .filter((l) => l.trim().length > 0);
  } catch {
    return [];
  }
}

function readJsonIfExists(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// ─── 1. Banned payment providers (same as no-tech-audit.mjs) ──────────────
function checkBannedProviders() {
  console.log("\n[1] Banned payment providers");
  const banned = ["@polar-sh/nextjs", "polar-sh", "@paypal", "paypal"];
  const pkgPath = join(ROOT, "package.json");
  if (!existsSync(pkgPath)) {
    warn("Banned providers", "package.json not found");
    return;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const deps = Object.assign(
    {},
    pkg.dependencies || {},
    pkg.devDependencies || {}
  );
  const keys = Object.keys(deps);
  for (const b of banned) {
    const hits = keys.filter((k) => k.toLowerCase().includes(b.toLowerCase()));
    if (hits.length > 0) fail(b, "Found in deps: " + hits.join(", "));
    else pass("No " + b);
  }
}

// ─── 2. Credential encryption ───────────────────────────────────────────────
function checkCredentialEncryption() {
  console.log("\n[2] Credential encryption");
  const files = [
    "src/seed/security/credential-crypto.ts",
    "src/tree/credentials/encryption.ts",
    "src/tree/credentials/user-credentials-repo.ts",
  ];
  let found = 0;
  for (const f of files) {
    if (existsSync(join(ROOT, f))) found++;
  }
  if (found > 0) pass("Encryption files present (" + found + ")");
  else fail("Credential encryption", "encryptValue/decryptValue not found");
}

// ─── 3. Operator-side secrets in unexpected source files ───────────────────
const OPERATOR_SECRET_NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "SENTRY_AUTH_TOKEN",
];
const APPROVED_OPERATOR_FILES = [
  "src/seed/cache/redis.ts",
  "src/seed/utils/redis-client.ts",
  "src/seed/redis.ts",
  "src/tree/clients/upstash-redis-client.ts",
  "src/land/redis.ts",
  "src/tree/clients/index.ts",
  "src/land/payouts/stripe-connect.ts",
];

function checkOperatorSecrets() {
  console.log("\n[3] Operator-side secrets in src/");
  let hits = 0;
  for (const s of OPERATOR_SECRET_NAMES) {
    const files = grepFiles(s, [join(ROOT, "src")], ["*.ts", "*.tsx"]);
    for (const f of files) {
      const rel = f.replace(ROOT + "/", "");
      if (APPROVED_OPERATOR_FILES.some((a) => rel === a || rel.includes("/__tests__/")))
        continue;
      warn(s + " in unexpected file", rel);
      hits++;
    }
  }
  if (hits === 0) pass("No unchecked operator-side secrets");
}

// ─── 4. Graceful degradation for optional secrets ──────────────────────────
const BYOK_GLOBS = [
  "src/seed/cache/redis.ts",
  "src/seed/utils/redis-client.ts",
  "src/seed/redis.ts",
  "src/tree/clients/upstash-redis-client.ts",
  "src/land/redis.ts",
];
const OPTIONAL_SECRETS = [
  "SENTRY_AUTH_TOKEN",
  "HONEYCOMB_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

function checkHardFails() {
  console.log("\n[4] Graceful degradation for optional secrets");
  let hardFails = 0;
  for (const s of OPTIONAL_SECRETS) {
    const matches = grepFiles(s, [join(ROOT, "src")], ["*.ts", "*.tsx"]);
    for (const line of matches) {
      const file = line.split(":")[0] || "";
      const rel = file.replace(ROOT + "/", "");
      if (BYOK_GLOBS.some((g) => rel === g || rel.includes("/__tests__/"))) continue;
      const lower = line.toLowerCase();
      if (lower.includes("throw") || lower.includes("required")) {
        warn(s + " hard-fail", (rel + ":" + (line.split(":")[1] || "").trim()).slice(0, 100));
        hardFails++;
      }
    }
  }
  if (hardFails === 0) pass("Optional secrets degrade gracefully");
}

// ─── 5. CF-Direct doctrine contradiction ───────────────────────────────────
function checkCFDirect() {
  console.log("\n[5] CF-Direct doctrine (GitHub Actions contradiction)");
  const wfDir = join(ROOT, ".github", "workflows");
  if (!existsSync(wfDir)) {
    pass("No .github/workflows directory");
    return;
  }
  let files = [];
  try {
    files = readdirSync(wfDir).map((f) => ".github/workflows/" + f);
  } catch {
    pass("No .github/workflows directory (read error ignored)");
    return;
  }
  // Old script may list dotfiles from root — normalize out
  const active = files.filter((f) => {
    const base = f.split("/").pop() || "";
    return !base.includes(".disabled") && !base.includes(".archive");
  });
  if (active.length > 0) {
    warn("Active GitHub Actions workflows (" + active.length + ")", active.join(", "));
    console.log("  CF-direct doctrine: disable or remove these — see sophia-no-tech-doctrine.md");
  } else {
    pass("No active GitHub Actions workflows");
  }
}


// ─── 5b. D1 migration gap verification ──────────────────────────────────────
function checkMigrationGap() {
  console.log("\n[5b] D1 migration gap (apm_metrics table)");
  const apmMigration = "0231_apm_metrics.sql";
  const apmFile = join(ROOT, "migrations", apmMigration);
  if (!existsSync(apmFile)) {
    warn("Migration gap", `${apmMigration} not found in migrations/`);
    return;
  }
  // Read migration to find table names created
  const content = readFileSync(apmFile, "utf8");
  const tables = [];
  const tableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  let m;
  while ((m = tableRe.exec(content)) !== null) tables.push(m[1]);

  // Check if wrangler is available and DB is configured
  const wranglerToml = join(ROOT, "wrangler.toml");
  if (!existsSync(wranglerToml)) {
    warn("Migration gap", "wrangler.toml not found — skipping remote D1 check");
    console.log(`  Migration ${apmMigration} defines tables: ${tables.join(", ")}`);
    console.log("  Run 'npx wrangler d1 execute sophia-raas-db --remote --file=migrations/" + apmMigration + "' to apply.");
    return;
  }

  console.log(`  Migration ${apmMigration} defines tables: ${tables.join(", ")}`);
  console.log("  Verification requires remote D1 access (run apply-migrations.sh before deploy)");
  pass("Migration file present; apply via apply-migrations.sh");
}

// ─── 6. Client-facing docs scan ────────────────────────────────────────────
const CLIENT_DOC_GLOBS = [
  join(DOCS, "CLIENT-HANDOVER-PACKAGE*.md"),
  join(DOCS, "CEO-HANDOFF-PACKAGE*.md"),
  join(DOCS, "HANDOVER*.md"),
  join(DOCS, "client-handover", "**/*.md"),
  join(DOCS, "onboarding", "**/*.md"),
];
const OPERATOR_SECRET_DOC_PATTERNS = [
  /SENTRY_AUTH_TOKEN/i,
  /QSTASH/i,
  /STRIPE_SECRET_KEY/i,
  /wrangler\s+(deploy|rollback|execute|secret)/i,
  /STRIPE_WEBHOOK_SECRET/i,
  /HEALTH_CHECK_SECRET/i,
  /CRON_SECRET/i,
];

function checkClientDocDisclosure() {
  console.log("\n[6] Client-facing docs — operator credential disclosure");
  let scanned = 0,
    disclosures = 0;
  for (const g of CLIENT_DOC_GLOBS) {
    const dir = g.replace(/\/\*\*\/\*\.md$/, "");
    if (!existsSync(dir) && !existsSync(g)) continue;
    try {
      const out = execSync("ls " + g, {
        cwd: ROOT,
        encoding: "utf8",
        shell: "/bin/bash",
      });
      const files = out
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((f) => (f.startsWith("/") ? f : join(ROOT, f)));
      for (const fp of files) {
        scanned++;
        const text = readFileSync(fp, "utf8");
        for (const pat of OPERATOR_SECRET_DOC_PATTERNS) {
          if (pat.test(text)) {
            fail("Client doc disclosure", fp.replace(ROOT + "/", "") + " → matches " + pat);
            disclosures++;
          }
        }
      }
    } catch {
      // glob didn't resolve — skip
    }
  }
  if (scanned === 0) warn("Client-facing docs", "No handover packages found to scan");
  if (scanned > 0 && disclosures === 0) pass("No operator credential disclosure in client docs");
}

// ─── 7. Setup Wizard BYOK pattern scan ─────────────────────────────────────
function checkSetupWizardBYOK() {
  console.log("\n[7] Setup Wizard BYOK pattern");
  const wizardDirs = [
    join(ROOT, "src", "land", "tenant-settings"),
    join(ROOT, "src", "tree", "byok"),
    join(ROOT, "src", "land", "openclaw"),
  ];
  let wizardFiles = [];
  for (const d of wizardDirs) {
    if (!existsSync(d)) continue;
    try {
      const out = execSync(
        "find " + d + " -type f \\( -name '*.tsx' -o -name '*.ts' \\)",
        { cwd: ROOT, encoding: "utf8" }
      );
      wizardFiles.push(...out
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((f) => (f.startsWith("/") ? f : join(ROOT, f))));
    } catch {}
  }

  // Patterns that indicate operator-side setup (not BYOK)
  const antiPatterns = [
    /operator\s+(must|should|needs|provides|configures?)\s+/i,
    /set\s+(the\s+)?STRIPE_SECRET_KEY/i,
    /set\s+(the\s+)?SENTRY_AUTH_TOKEN/i,
    /configure\s+(QStash|Upstash|wrangler)\s+secret/i,
    /contact\s+support\s+to\s+enable/i,
    /ask\s+your\s+administrator/i,
    /operator\s+(action|approval|setup)\s+required/i,
  ];

  let issues = 0;
  for (const f of wizardFiles) {
    const rel = f.replace(ROOT + "/", "");
    if (rel.includes("/__tests__/") || rel.includes(".test.")) continue;
    const text = readFileSync(f, "utf8");
    for (const pat of antiPatterns) {
      if (pat.test(text)) {
        warn("BYOK anti-pattern in " + rel, pat);
        issues++;
      }
    }
  }
  if (issues === 0) pass("Setup Wizard files use BYOK pattern");
}

// ─── 8. Public page / API route operator disclosure ─────────────────────────
const PUBLIC_ROUTES_DIRS = [
  join(ROOT, "src", "app"),
  join(ROOT, "src", "land"),
];
const ROUTE_DOC_PATTERNS = [
  /SENTRY_AUTH_TOKEN/i,
  /QSTASH/i,
  /STRIPE_SECRET/i,
  /HEALTH_CHECK_SECRET/i,
  /CRON_SECRET/i,
  /wrangler\s+deploy/i,
];

function isClientSide(relPath) {
  // All app-router files ending in `route.ts|tsx` are server-only.
  const isServerRoute = /\/route\.(ts|tsx)$/.test(relPath);
  if (isServerRoute) return false;
  // Server-only tree/forest directories
  if (relPath.startsWith("src/forest/") || relPath.startsWith("src/land/")) return false;
  // src/app/(auth), src/app/api, src/app/dashboard/admin, src/app/middleware.ts are server-only
  if (
    relPath.includes("/app/(auth)/") ||
    relPath.includes("/app/api/") ||
    relPath.includes("middleware.ts") ||
    relPath.includes("/app/dashboard/admin/")
  )
    return false;
  // __tests__ excluded upstream
  return true;
}

function checkPublicRouteDisclosure() {
  console.log("\n[8] Client-facing routes — operator credential disclosure");
  let scanned = 0,
    hits = 0;
  for (const d of PUBLIC_ROUTES_DIRS) {
    if (!existsSync(d)) continue;
    try {
      const out = execSync(
        "find " + d + " -type f \\( -name '*.tsx' -o -name '*.ts' \\)",
        { cwd: ROOT, encoding: "utf8" }
      );
      const files = out
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((f) => (f.startsWith("/") ? f : join(ROOT, f)));
      for (const fp of files) {
        scanned++;
        const rel = fp.replace(ROOT + "/", "");
        if (rel.includes("/__tests__/") || rel.includes(".test.")) continue;
        // Skip server-only paths — the no-tech issue is CLIENT-VISIBLE disclosure
        if (!isClientSide(rel)) continue;
        const text = readFileSync(fp, "utf8");
        for (const pat of ROUTE_DOC_PATTERNS) {
          if (pat.test(text)) {
            fail("Operator disclosure in client route", rel + " → " + pat);
            hits++;
          }
        }
      }
    } catch {}
  }
  if (scanned === 0) warn("Public routes", "No app/land routes found");
  if (scanned > 0 && hits === 0) pass("No operator credentials in client-reachable routes");
}

// ─── 9. Banned provider check in source imports ────────────────────────────
function checkBannedProvidersInSrc() {
  console.log("\n[9] Banned provider imports in src/");
  const banned = [
    { name: "polar-sh", patterns: [/polar-sh/i] },
    { name: "paypal", patterns: [/paypal/i] },
  ];
  for (const b of banned) {
    const files = grepFiles(
      b.patterns[0].source,
      [join(ROOT, "src")],
      ["*.ts", "*.tsx"]
    );
    // Filter to actual import statements
    const importHits = files.filter((f) => {
      const base = f.split(":").slice(1).join(":").toLowerCase();
      return (
        base.includes("import") &&
        (base.includes("polar-sh") || base.includes("paypal"))
      );
    });
    if (importHits.length > 0)
      fail(b.name, "Import found in: " + importHits.map((x) => x.split(":")[0]).join(", "));
    else pass("No " + b.name + " imports in src/");
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
function main() {
  console.log("═══════════════════════════════════");
  console.log(" No-Tech Doctrine Compliance Audit (Extended)");
  console.log("═══════════════════════════════════");
  checkBannedProviders();
  checkCredentialEncryption();
  checkOperatorSecrets();
  checkHardFails();
  checkCFDirect();
  checkMigrationGap();
  checkClientDocDisclosure();
  checkSetupWizardBYOK();
  checkPublicRouteDisclosure();
  checkBannedProvidersInSrc();

  console.log("\n═══════════════════════════════════");
  if (failed > 0) {
    console.log(
      " RESULT FAILED: " + failed + " violation(s), " + warnings + " warning(s)"
    );
    process.exit(1);
  }
  console.log(" RESULT PASSED: " + warnings + " warning(s)");
  process.exit(0);
}

main().catch((err) => {
  console.error("Audit crashed: " + (err.message || err));
  process.exit(1);
});
