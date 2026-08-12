# Phase 01: deploy-with-sha.sh wrangler.toml restore
Priority: P0
Status: Proposed

## Context
OpenNext's `deploy` rewrites the `OPENNEXT_VERSION` block inside `wrangler.toml`. This dirties the tree and blocks subsequent deploys.

## Requirements
- Add backup/restore around the OpenNext deploy command.
- Log restore action.
- Log if tree is still dirty after restore.

## Implementation steps
1. After `npm run build` and before `npx opennextjs-cloudflare deploy`, snapshot the current `OPENNEXT_VERSION` line value from `wrangler.toml` into a temp variable.
2. Run the existing deploy command unchanged.
3. If the `OPENNEXT_VERSION` block exists, rewrite it back to the pre-deploy value.
4. If no block exists, no-op.
5. Print a clear log line for each restore action.

## Files
- `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`: modify deploy flow.

## Success criteria
- Verified locally that `wr stat` shows no dirty tree for `wrangler.toml` after deploy.
