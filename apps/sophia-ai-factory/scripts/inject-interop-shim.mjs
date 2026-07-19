/**
 * inject-interop-shim.mjs
 *
 * Patches .open-next/middleware/handler.mjs to include a global
 * __import_unsupported polyfill, guarding against ReferenceError
 * in environments where CJS→ESM interop helpers were stripped.
 *
 * Usage: node scripts/inject-interop-shim.mjs
 *        (run AFTER @opennextjs/cloudflare build, before wrangler deploy)
 *
 * Safe to run multiple times — uses a sentinel comment for idempotency.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HANDLER = join(process.cwd(), ".open-next", "middleware", "handler.mjs");
const SENTINEL = "/* __INTEROP_SHIM_INJECTED__ */";

const SHIM = `
// ---- interop shim injected by inject-interop-shim.mjs --------------------
// Guarantees globalThis.__import_unsupported exists even when the
// CJS→ESM strip script skips the original definition (no interop in handler).
${SENTINEL}
if (typeof globalThis.__import_unsupported === "undefined") {
  try {
    const ShimError = class InteropShimError extends Error {
      constructor(moduleName) {
        super(
          "The edge runtime does not support Node.js '" +
            moduleName +
            "' module. Learn More: https://nextjs.org/docs/messages/node-module-in-edge-runtime"
        );
        this.name = "InteropShimError";
        Object.defineProperty(this, "__NEXT_ERROR_CODE", {
          value: "E394",
          enumerable: false,
          configurable: true,
        });
      }
    };
    const proxyHandler = {
      get(_target, prop) {
        if (prop === "then") return {};
        throw new ShimError("(shim)");
      },
      construct(_target, _args) {
        throw new ShimError("(shim)");
      },
      apply(_target, _this, args) {
        if (typeof args[0] === "function") {
          // Simulate the lazy-require proxy shape Turbopack expects
          const lazy = new Proxy(() => {}, proxyHandler);
          return new Proxy({}, { get: () => lazy });
        }
        throw new ShimError("(shim)");
      },
    };
    globalThis.__import_unsupported = function InteropShim(moduleName) {
      return new Proxy(function () {}, proxyHandler);
    };
    console.log("[inject-interop-shim] Polyfilled globalThis.__import_unsupported");
  } catch {
    // last-resort: define a no-op so code referencing it doesn't crash
    globalThis.__import_unsupported = function () {};
  }
}
// ---- end interop shim -----------------------------------------------------

`;

function main() {
  let code;
  try {
    code = readFileSync(HANDLER, "utf-8");
  } catch (err) {
    console.error(`[inject-interop-shim] Cannot read ${HANDLER}: ${err.message}`);
    process.exit(1);
  }

  if (code.includes(SENTINEL)) {
    console.log("[inject-interop-shim] Already patched — skipping (idempotent).");
    process.exit(0);
  }

  // Find the routingHandler export anchor (stable across builds) and
  // inject the shim immediately before the `async function routingHandler` line
  // so it runs before any request handling.
  // Try multiple patterns because OpenNext versions vary in how routingHandler is declared.
  const anchors = [
    "async function routingHandler(event",
    "async function routingHandler(",
    "export async function routingHandler",
    "function routingHandler(",
  ];
  let anchor = null;
  for (const a of anchors) {
    if (code.includes(a)) {
      anchor = a;
      console.log(`[inject-interop-shim] Found anchor: "${a}"`);
      break;
    }
  }
  if (!anchor) {
    console.error(
      `[inject-interop-shim] Cannot find routingHandler in middleware handler.\n` +
      `Searched for: ${anchors.join(", ")}\n` +
      `The Worker will crash with ReferenceError on __import_unsupported.\n` +
      `Fix: ensure @opennextjs/cloudflare build produces handler.mjs with a routingHandler function.`,
    );
    process.exit(1);
  }

  const patched = code.replace(anchor, SHIM + anchor);

  writeFileSync(HANDLER, patched, "utf-8");
  console.log(`[inject-interop-shim] Patched ${HANDLER}`);
}

main();
