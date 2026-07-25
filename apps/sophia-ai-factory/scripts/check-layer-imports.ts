import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(process.cwd(), "src");
const LAYERS = ["seed","tree","forest","land"];
const RULES: Record<string,string[]> = {
  // seed có thể nhập từ tree cho i18n/BYOK (credential-crypto, BYOK resolver); các hướng khác cấm.
  seed: ["tree"],
  tree: ["seed"],
  forest: ["seed","tree","land"],
  land: ["seed","tree","forest"],
};

function extractImports(content: string): string[] {
  const re = /from\s+['"]([^'"]+)['"]/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

function getLayer(imp: string): string | "banned" | null {
  if (!imp.startsWith("@/")) return null;
  if (imp.startsWith("@/lib/") || imp.startsWith("@/app/")) return "banned";
  const rest = imp.slice(2);
  for (const layer of LAYERS) {
    if (rest.startsWith(layer + "/")) return layer;
  }
  return null;
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory() && e !== "__tests__") {
      out.push(...walk(full));
    } else if (e.endsWith(".ts") && !e.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

async function main(): Promise<void> {
  let total = 0;
  for (const layer of LAYERS) {
    const errs: string[] = [];
    const allowed = RULES[layer];
    const rootLayerDir = join(ROOT, layer);
    for (const file of walk(rootLayerDir)) {
      const rel = relative(ROOT, file);
      const content = readFileSync(file, "utf-8");
      for (const imp of extractImports(content)) {
        const srcL = getLayer(imp);
        if (srcL === "banned") {
          errs.push(`[${rel}] -> ${imp} (src/lib/src/app BANNED)`);
        } else if (srcL && srcL !== layer && !allowed.includes(srcL)) {
          errs.push(`[${rel}] -> ${imp} (${layer}->${srcL} violates)`);
        }
      }
    }
    if (errs.length) {
      console.error(`\n${layer.toUpperCase()} violations (${errs.length}):`);
      errs.forEach(e => console.error(" ", e));
      total += errs.length;
    } else {
      console.log(`${layer.toUpperCase()} clean`);
    }
  }
  if (total > 0) {
    console.error(`\nTotal ${total} violation(s) — DEPLOY BLOCKED`);
    process.exit(1);
  }
  console.log("All layers clean + no src/lib/app imports");
}

main();
