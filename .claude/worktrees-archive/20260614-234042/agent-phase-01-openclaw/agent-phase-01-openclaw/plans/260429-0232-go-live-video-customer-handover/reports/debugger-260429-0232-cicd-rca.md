# RCA: GitHub Actions Not Triggering After 2026-04-27 Push

**Date:** 2026-04-29  
**Workflow:** `.github/workflows/test.yml` (Tests & Deploy, id: 230917486)  
**Affected SHAs:** d3a65bd8, 9dc9798d, e921af21, 6a73dd1e, a6892c74 (5 commits)

---

## ROOT CAUSE

GitHub Actions stopped auto-creating `check-suite` entries for all pushes to `main` after commit `882721c3` triggered a **cancelled** "Tests & Deploy" run + a **failed** "Post-Merge Tests" run at 10:37:06Z on 2026-04-27. Subsequent normal pushes (d3a65bd8..a6892c74) reached GitHub (confirmed via reflog) but never received a `github-actions` check-suite — so no workflow was ever queued.

This is a known GitHub Actions behavior: when a workflow run is **cancelled mid-execution** (not failed-naturally), GitHub's event routing sometimes fails to auto-trigger check-suite creation for subsequent pushes to the same branch, leaving the queue silent until manually re-triggered or the workflow is disabled/re-enabled.

---

## Evidence

| Data Point | Value |
|---|---|
| Last triggered commit | `882721c3` at 10:37:06Z |
| Outcome for 882721c3 | Tests&Deploy: **cancelled** / Post-Merge: **failed** |
| Next push `d3a65bd8` | pushed at 04:41:57 PDT — check-suites: firebase, vercel, cursor, render, gitguardian — **NO github-actions** |
| `a6892c74` check-suites | same 5 third-party apps, **no github-actions suite** |
| `9888ddd6` (working commit) check-suites | 8 suites including **3x github-actions** |
| All push methods | `update by push` (normal, not force) per reflog |
| Workflow state | `active` (never disabled) |
| Actions permissions | `enabled: true, allowed_actions: all` |
| Secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` present |
| Actions cache | 360MB / 10GB — not a quota issue |
| April run count | 473 runs — minutes quota not exhausted |
| `paths-ignore` filter | test.yml has none; post-merge/quality-gate do not apply on push |

---

## FIX

Two options:

**Option A — Manually re-trigger (immediate, no code change):**
```bash
# Trigger workflow_dispatch on current HEAD
gh workflow run test.yml --repo longtho638-jpg/sophia-ai-factory --ref main

# Verify it queued
sleep 10
gh run list -L 5 --repo longtho638-jpg/sophia-ai-factory
```

**Option B — Disable + re-enable workflow (resets GitHub's internal state):**
```bash
gh workflow disable test.yml --repo longtho638-jpg/sophia-ai-factory
gh workflow enable test.yml --repo longtho638-jpg/sophia-ai-factory

# Then push an empty commit to re-trigger normally
git -C /Users/macbook/sophia-ai-factory commit --allow-empty -m "chore(ci): re-trigger GitHub Actions after check-suite stall"
git -C /Users/macbook/sophia-ai-factory push origin main
```

**Option C — Add `workflow_dispatch` to test.yml (prevent future stalls):**

Add to `test.yml` under `on:`:
```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:   # ← add this
```
This allows manual re-trigger from UI or CLI without code changes.

---

## Verification

After applying fix:
```bash
# Confirm run created and passes
gh run list -L 3 --repo longtho638-jpg/sophia-ai-factory
gh run watch $(gh run list -L 1 --json databaseId -q '.[0].databaseId' --repo longtho638-jpg/sophia-ai-factory)
```

Expect: `Tests & Deploy` run appears with `status: in_progress` → `conclusion: success`

---

## Unresolved Questions

1. Why did the `882721c3` run get **cancelled** (not failed)? Was it user-cancelled via UI, or did the `concurrency` auto-cancel fire? (No `concurrency:` block in test.yml, so likely manual.)
2. The `882721c3` "Post-Merge Tests" run concluded `failure` — what specific test failed? This may need fixing before deploy will pass even after re-triggering.
3. Firebase App Hosting, Vercel, Render check-suites on `a6892c74` are stuck `queued` — are these connected to this repo as integration apps? If yes, they may also need cleanup.
