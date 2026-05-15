# Phase 01 — DV-1 Production/Git Divergence Reconciliation

**Priority:** P0 (blocks all future deploys)
**Status:** pending
**Effort:** 30min

## Context

- Production worker SHA: `9da5a1b7` (feat compliance Phase 08)
- Git origin/main: `960dbfde` (handover docs + grooming + scout-clients Phase 02)
- Lost commits (reflog-only): `212b6960` (scoring) + `9da5a1b7` (compliance)
- Root cause: parallel CC CLI session deployed via CF-direct doctrine but never `git push`. My session rebased + reset to drop those commits due to `writer.test.ts` test flake.

See `plans/reports/handover-260515-0830-gap-91to100.md` §0 for full reconstruction.

## Key Insights

- CF-direct doctrine permits deploy without push — historically OK for solo workflow, broken when multi-session.
- The flake (Phase 02 DV-2) is what forced my reset; if hook was reliable, I'd have rebased + pushed all 3 commits.
- Production runs scoring + compliance code that has no source-of-truth backup outside the deployed worker artifact + local reflogs.

## Requirements

- Restore `212b6960` + `9da5a1b7` to git origin/main as proper commits.
- Verify post-restoration that `npm run deploy:full` produces a worker matching current prod (no functional regression).
- Document a doctrine update preventing recurrence.

## Architecture

No new code. Pure git history reconciliation + ops doctrine.

## Related Files

- `git reflog` (volatile, ~90d retention)
- `.git/logs/HEAD` (durable reflog backing store)
- `scripts/deploy-with-sha.sh` (potentially add `git push` precondition)
- `apps/sophia-ai-factory/CLAUDE.md` "Canonical Deploy Flow" section
- `.claude/rules/sophia-deploy-verify.md`

## Implementation Steps

### Path A (recommended — cherry-pick from reflog)

```bash
# 1. Confirm reflog still has the commits
git reflog --all | grep -E "212b6960|9da5a1b7" | head -5
# If empty → fall back to Path B or C

# 2. Cherry-pick onto current HEAD
git cherry-pick 212b6960 9da5a1b7
# Resolve any conflicts (likely with the scout-clients commit 5cd07d70)

# 3. PRE-REQUISITE: Phase 02 DV-2 fix MUST be done first
#    Otherwise pre-push hook will fail on writer.test.ts again

# 4. Push to both mirrors
git push origin main
git push gitlab main

# 5. Verify deploy matches push
LOCAL=$(git rev-parse origin/main | cut -c1-8)
# DON'T deploy yet — verify prod still matches what was live:
PROD=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
# Expected: LOCAL has prod's commit in its ancestry now
git merge-base --is-ancestor $PROD origin/main && echo "OK: prod is ancestor of origin" || echo "STILL DIVERGENT"

# 6. Optionally redeploy to make SHA match (cosmetic)
npm run deploy:full
```

### Path B (wait for parallel session owner)

Send Telegram / Slack ping to parallel session owner. They run Path A locally.
Risk: their reflog may have aged out if too much idle time.

### Path C (reverse-engineer from build artifact)

Last resort. Inspect `.open-next/worker.js` or last `npm run build` output to identify functions added. Re-write source. NOT recommended — build outputs are minified/bundled.

## Doctrine Update (post-resolve)

Add to `apps/sophia-ai-factory/CLAUDE.md` "Canonical Deploy Flow":

> **Rule:** Before `npm run deploy:full`, ALWAYS `git push origin main && git push gitlab main` first. Deploy script SHOULD reject if `git log origin/main..HEAD` is non-empty (uncommitted-and-deployable code is a latent landmine).

Optional: add precondition check to `scripts/deploy-with-sha.sh`:

```bash
# Step 0: Ensure HEAD is pushed
if ! git diff-index --quiet HEAD --; then
  echo "❌ Uncommitted changes — commit first"; exit 1
fi
if [ -n "$(git log origin/main..HEAD --oneline 2>/dev/null)" ]; then
  echo "❌ Unpushed commits — push to origin first"; exit 1
fi
```

## Todo List

- [ ] Verify reflog still has `212b6960` + `9da5a1b7`
- [ ] Complete Phase 02 DV-2 fix (prerequisite for clean push)
- [ ] Cherry-pick + resolve conflicts
- [ ] Push both mirrors
- [ ] Verify `git merge-base --is-ancestor` check passes
- [ ] Add doctrine update to `apps/sophia-ai-factory/CLAUDE.md`
- [ ] Add precondition check to `scripts/deploy-with-sha.sh`
- [ ] Update changelog v1.27.0 with reconciliation note

## Success Criteria

- `git merge-base --is-ancestor 9da5a1b7 origin/main` returns 0 (prod commit is in origin's ancestry)
- OR: prod SHA matches origin SHA after a fresh deploy
- `scripts/deploy-with-sha.sh` has push-precondition guard
- Doctrine documented in `apps/sophia-ai-factory/CLAUDE.md`

## Risk Assessment

- **Cherry-pick conflicts** likely with `5cd07d70` (same affiliate scout area) — manageable, hand-resolve.
- **Reflog aged out** if too much delay (unlikely within 90d).
- **Forgetting Phase 02 first** → pre-push hook flake recurs → tempt to `--no-verify` → bad habit.

## Security Considerations

None — pure history reconciliation. No new code paths.

## Next Steps

After completion:
- Phase 02 must be done in parallel (prerequisite ordering)
- Phase 03/04 unblock once deploy doctrine is safe again
- Update handover v3 with reconciliation timestamp
