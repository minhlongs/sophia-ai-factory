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

# Names gathered from deploy failure diagnostics (52 errors across d3-{array,interpolate,path,time,time-format})
# plus common d3 surface area to avoid silent merge collisions on next OpenNext upgrade.
EXPORTS="range,bisect,ascending,quantile,max,min,mean,median,deviation,variance,ticks,tickIncrement,tickStep,interpolate,interpolateNumber,interpolateRound,piecewise,Path,utcHour,utcMinute,utcSecond,utcTicks,utcTickInterval,utcFormat,isoFormat,timeFormat,timeParse,utcParse,pairs,permute,shuffle,merge,group,groups,rollup,rollups,index,indexes,bin,histogram,thresholdFreedmanDiaconis,thresholdScott,thresholdSturges,cross,floor,ceil,format,prefix,precision"

# Build comma-separated export declarations: "export const range=void 0,bisect=void 0,...;"
DECLS=$(echo "$EXPORTS" | sed 's/,/=void 0,/g')'=void 0'

# Replace the stub: from "export default {};" to "export default {}; export const <ALL>=void 0;"
# We target the exact string in returnEmpty's contents.
OLD='contents: "export default {};",'
NEW="contents: \"export default {}; export const $DECLS;\","

sed -i.bak "s|$OLD|$NEW|" "$BUNDLE_SERVER"
rm -f "${BUNDLE_SERVER}.bak"

echo "✅ Patched OpenNext empty-client-side-packages to export common D3 named symbols"
