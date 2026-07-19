# Deploy Doctrine Change: CF-direct (wrangler CLI) — 2026-05-03

## Summary

Switched Sophia AI Factory deploy doctrine from GitHub Actions CI to Cloudflare-direct
(wrangler CLI via `npm run deploy:full`). GH Actions blocked at account level since 2026-05-03.
Five prior manual deploys proved the CF-direct path reliable — now the official standard.

## Files Modified

| File | Change |
|------|--------|
| `apps/sophia-ai-factory/CLAUDE.md` | Line 4: "via GitHub Actions" → "via wrangler CLI direct"; Green Production Rule rewritten to 4-step CF-direct verify; GH Actions block section replaced with Historical Note + Canonical Deploy Flow |
| `/Users/macbook/projects/sophia-ai-factory/CLAUDE.md` | Added deploy doctrine note (last bullet) |
| `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` | Full rewrite — primary path is now `npm run deploy:full`, not `git push`; CI polling steps removed; Migration Application + Rollback sections added |
| `/Users/macbook/.claude/rules/binh-phap-cicd.md` | "Direct Deploy BANNED" section updated: BANNED for projects with working CI, ALLOWED for CF-direct doctrine projects; Sophia exception documented |
| `apps/sophia-ai-factory/package.json` | Added `deploy:migrations`, `deploy:verify`, `deploy:all` scripts |
| `apps/sophia-ai-factory/scripts/sophia-doctor.mjs` | Added `checkCIDoctrine()` function (check 9b); calls it in main() before checkGit() |

## New Files Created

| File | Purpose |
|------|---------|
| `apps/sophia-ai-factory/scripts/apply-migrations.sh` | Apply D1 migrations changed since a git ref (default HEAD~1). chmod +x. |

## Archived

| From | To | Notes |
|------|----|-------|
| `.github/workflows/test.yml` | `.github/workflows/test.yml.disabled` | Header comment explains reason + how to re-enable |

## Skipped / Not applicable

- Root CLAUDE.md at `/Users/macbook/projects/sophia-ai-factory/CLAUDE.md` had no "GitHub Actions deployment" explicit line to replace — added deploy doctrine note instead.
- `sophia-doctor.mjs` has no standalone CI-poll check (no `gh run list` call) — added `checkCIDoctrine()` to report bypass status positively.

## Proof SHAs

`d84f3a6e`, `e53c7dd2`, `aafd1ba4`, `0520585b`, `f418f3df` — all successful manual wrangler deploys.
