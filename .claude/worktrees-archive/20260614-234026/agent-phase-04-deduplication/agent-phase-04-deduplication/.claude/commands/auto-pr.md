---
description: Auto-create PR from current branch with conventional commit title and structured body
---

# /auto-pr

Stage all changes, commit with conventional format, push branch, and create PR against `main`.

## Steps

1. **Stage & inspect:**
   - `git status -s` — list changes
   - `git diff --cached --stat` — summarize
   - Refuse if branch is `main` or `master` (must be feature branch)

2. **Commit:**
   - Auto-generate conventional commit title from changed files (`fix:` / `feat:` / `chore:` / `docs:`)
   - Body: 1-line "why" + bullet list of key files
   - No AI references in message

3. **Push:**
   - `git push -u origin <current-branch>`

4. **Create PR via `gh`:**
   - Title = commit title
   - Body template:
     ```
     ## Summary
     - [bullet from commit body]

     ## Test plan
     - [ ] `npm run build`
     - [ ] `npm test`
     - [ ] CI passes
     ```
   - Base = `main`
   - Use `gh pr create --base main --head <branch>`

5. **Output:** PR URL + run `gh pr view --web` (optional)

## Sophia-Specific Rules

- **Never** commit `apps/sophia-ai-factory/.env*` or any `.env.local`
- **Never** commit `wrangler.jsonc` secrets (D1 IDs are public, but API tokens are not)
- Run `npm run build` and `npm test` BEFORE pushing if changed files touch `src/`, `app/`, `lib/`
- Polar webhook handlers (`app/api/polar/*`) require manual review — flag in PR body
- Telegram bot (`app/api/telegram/*`) require manual review — flag in PR body

## Failure Modes

- **Pre-commit hook fails:** Fix issue, re-commit (don't `--no-verify`)
- **CI fails after push:** Fix locally, force-push to feature branch (NEVER force-push main)
- **Merge conflict on PR:** Pull main, resolve, push again

## Tools Used

- `git` (committed/pushed via Bash tool)
- `gh` CLI (PR creation via Bash tool)
- `git-manager` subagent (optional, for complex multi-commit splits)

## Example

```
/auto-pr
```

Output:
```
✓ Staged: 5 files (+120 -34)
✓ Commit: fix(deps): bump wrangler to 4.80.0 (a3f2c1e)
✓ Pushed: claude/fix-wrangler-version → origin
✓ PR #34 created: https://github.com/longtho638-jpg/sophia-ai-factory/pull/34
```
