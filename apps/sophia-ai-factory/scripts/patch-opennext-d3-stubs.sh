#!/usr/bin/env bash
# OpenNext D3 stub patch.
#
# OpenNext < 1.19.9 stubbed entire npm packages as empty-client-pkg, which
# broke named imports from d3-*/recharts. OpenNext 1.19.9+ handles stubs
# differently (per-symbol, not per-package), so this patch is a no-op.
set -euo pipefail

BUNDLE_SERVER="node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js"
LOAD_MANIFEST="node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js"
NEXT_SERVER_PATCH="node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/next-server.js"

if [ -f "$NEXT_SERVER_PATCH" ]; then
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    let s = fs.readFileSync(file, "utf8");
    const target = "  globalThis[handlersSetSymbol] = new Set(globalThis[handlersMapSymbol].values());\n`;";
    const replacement = "  globalThis[handlersSetSymbol] = new Set(globalThis[handlersMapSymbol].values());\n  return;\n`;";
    if (s.includes(target)) {
      s = s.replace(target, replacement);
      fs.writeFileSync(file, s);
    }
  ' "$NEXT_SERVER_PATCH"
  echo "✅ Patched OpenNext next-server.js createComposableCacheHandlersRule early return for Next.js 16.4"
fi

if [ -f "$LOAD_MANIFEST" ]; then
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    let s = fs.readFileSync(file, "utf8");
    s = s.replace("{*{*-manifest,", "{*-manifest,");
    s = s.replace("{*-manifest,required-server-files,prefetch-hints}.json", "{*-manifest,required-server-files,prefetch-hints,preview-props}.json");
    if (!s.includes("p.endsWith(\"preview-props\")")) {
      s = s.replace("p.endsWith(\"prefetch-hints\")", "p.endsWith(\"prefetch-hints\") || p.endsWith(\"preview-props\")");
    }
    fs.writeFileSync(file, s);
  ' "$LOAD_MANIFEST"
  echo "✅ Patched OpenNext load-manifest.js with Next.js 16.4 preview-props.json support"
fi

if [ ! -f "$BUNDLE_SERVER" ]; then
  echo "WARNING: OpenNext bundle-server.js not found — skip d3 stub patch"
  exit 0
fi

# Detect whether the old-style d3 package stubs exist in this OpenNext version.
# The old pattern was `'d3-*': path.join(buildOpts.outputDir, "cloudflare-templates/shims/empty-client-pkg.js")`
# inside bundleServer(). OpenNext 1.19.9+ removed those glob stubs.
if ! grep -q 'empty-client-pkg' "$BUNDLE_SERVER"; then
  echo "✅ OpenNext $(node -p "require('./node_modules/@opennextjs/cloudflare/package.json').version") — no empty-client-pkg stubs; d3 patch not needed"
  exit 0
fi

# Fallback: if the old pattern IS present, patch as before.
echo "⚠️  OpenNext still uses empty-client-pkg stubs — applying d3 named-export patch"

EXPORTS="range,timeYear,timeFormat,utcWeek,interpolate,group,merge,ascending,bisect,format,formatPrefix,formatSpecifier,InternMap,interpolateNumber,interpolateRound,Path,piecewise,precisionFixed,precisionPrefix,precisionRound,quantile,quantileSorted,tickIncrement,ticks,tickStep,timeDay,timeHour,timeMinute,timeMonth,timeSecond,timeTickInterval,timeTicks,timeWeek,utcDay,utcFormat,utcHour,utcMinute,utcMonth,utcSecond,utcTickInterval,utcTicks,utcYear"
DECLS=$(echo "$EXPORTS" | sed 's/,/=void 0,/g')'=void 0'
OLD='contents: "export default {};'
NEW="contents: \"export default {}; export const $DECLS;\","
sed -i.bak "s|$OLD.*|$NEW|" "$BUNDLE_SERVER"
rm -f "${BUNDLE_SERVER}.bak"

CRITICAL_EXPORTS="range,timeYear,timeFormat,utcWeek,interpolate,group,merge,ascending,bisect,format,formatPrefix,formatSpecifier,InternMap,interpolateNumber,interpolateRound,Path,piecewise,precisionFixed,precisionPrefix,precisionRound,quantile,quantileSorted,tickIncrement,ticks,tickStep,timeDay,timeHour,timeMinute,timeMonth,timeSecond,timeTickInterval,timeTicks,timeWeek,utcDay,utcFormat,utcHour,utcMinute,utcMonth,utcSecond,utcTickInterval,utcTicks,utcYear"
for sym in $(echo "$CRITICAL_EXPORTS" | tr ',' '\n'); do
  if ! grep -q "${sym}=void 0" "$BUNDLE_SERVER"; then
    echo "❌ Post-patch assertion failed: '$sym' not exported from empty-client-pkg stub"
    exit 1
  fi
done

echo "✅ Patched OpenNext empty-client-pkg stubs with D3 named exports"
