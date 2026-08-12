# Plan: Auto-restore wrangler.toml after OpenNext deploy

Status: Complete
Date: 2026-08-12

## Outcome
`deploy-with-sha.sh` must keep `wrangler.toml` out of git permanently by restoring any OpenNext version injection immediately after deploy, without adding `.gitignore` exceptions.

## Constraints
- Never commit manual wrangler.toml edits.
- Restore must be automatic and verified.
- Do not change deploy flow order or green-verification gates.
- No extra ignores or workarounds.

## Non-goals
- Rewriting OpenNext behavior.
- Changing commit SHA verification.
- Editing unrelated scripts.

## Acceptance criteria
- `npm run deploy:full` leaves working tree identical to pre-deploy state for `wrangler.toml`.
- `OPENNEXT_VERSION` stays at `1.19.9` locally after deploy.
- No `.gitignore` changes for `wrangler.toml`.
