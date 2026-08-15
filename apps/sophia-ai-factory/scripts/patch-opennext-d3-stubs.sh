#!/usr/bin/env bash
# Patch OpenNext 1.19.11 returnEmpty stub to export named D3 symbols.
# Without this, esbuild fails with "No matching export in empty-client-pkg:d3-*"
# because recharts → d3-scale → d3-array/interpolate/time/path imported as named exports.
# OpenNext's EMPTY_PKGS Set is hardcoded; this patches the stub function in-place
# to also export commonly-used named symbols, so esbuild tree-shakes what it doesn't need.
set -euo pipefail

BUNDLE_SERVER="node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js"

if [ ! -f "$BUNDLE_SERVER" ]; then
  echo "WARNING: OpenNext bundle-server.js not found — skip d3 stub patch"
  exit 0
fi

# Full d3 export surface required to satisfy named-import resolution for
# d3-scale 4.x + d3-time-format 4.x + d3-array 3.x + d3-time 3.x when OpenNext
# stubs them as empty-client-pkg. These are dynamically emitted; esbuild tree-shakes
# unused identifiers, so adding more does not bloat the worker at runtime.
EXPORTS="range,bisect,ascending,quantile,max,min,mean,median,deviation,variance,ticks,tickIncrement,tickStep,interpolate,interpolateNumber,interpolateRound,piecewise,Path,InternMap,quantileSorted,timeYear,timeMonth,timeWeek,timeDay,timeHour,timeMinute,timeSecond,timeTicks,timeTickInterval,timeInterval,utcYear,utcMonth,utcWeek,utcDay,utcHour,utcMinute,utcSecond,utcTicks,utcTickInterval,utcFormat,isoFormat,isoParse,timeFormat,timeParse,utcParse,pairs,permute,shuffle,merge,group,groups,rollup,rollups,index,indexes,bin,histogram,thresholdFreedmanDiaconis,thresholdScott,thresholdSturges,cross,floor,ceil,format,prefix,precision,formatPrefix,formatSpecifier,precisionFixed,precisionPrefix,precisionRound"

# Build comma-separated export declarations: "export const range=void 0,bisect=void 0,...;"
DECLS=$(echo "$EXPORTS" | sed 's/,/=void 0,/g')'=void 0'

# Replace the stub contents. Use generic "export default {};" anchor so the patch
# stays idempotent regardless of which symbol list is already in the string.
OLD='contents: "export default {};'
NEW="contents: \"export default {}; export const $DECLS;\","

sed -i.bak "s|$OLD.*|$NEW|" "$BUNDLE_SERVER"
rm -f "${BUNDLE_SERVER}.bak"

# Post-patch assertion: verify that the most commonly-imported D3 named exports
# are present. Exit non-zero so CI/deploy catches a broken patch immediately.
# Exports are comma-separated within a single `export const range=void 0,...,sym=void 0,...;`
# statement, so only the first symbol (`range`) is preceded by `export const`.
CRITICAL_EXPORTS="range,timeYear,timeFormat,utcWeek,interpolate,group,merge"
for sym in $(echo "$CRITICAL_EXPORTS" | tr ',' '\n'); do
  if ! grep -q "${sym}=void 0" "$BUNDLE_SERVER"; then
    echo "❌ Post-patch assertion failed: '$sym' not exported from empty-client-pkg stub"
    exit 1
  fi
done

echo "✅ Patched OpenNext empty-client-side-packages to export common D3 named symbols"
echo "✅ Post-patch assertion passed (checked: $CRITICAL_EXPORTS)"
