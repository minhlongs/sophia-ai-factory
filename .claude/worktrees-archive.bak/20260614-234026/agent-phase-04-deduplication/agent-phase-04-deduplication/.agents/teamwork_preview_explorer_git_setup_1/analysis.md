# Git Status and Worktree Analysis

This document details the git status, active branches, and worktrees in `/Users/macbook/projects/sophia-ai-factory` as of **2026-05-30T08:30:00Z**.

---

## 1. Current Git Status & Branch

* **Current Branch**: `main`
* **Local Changes (Dirty state)**:
  * Modified source files (e.g., page components, API routes, seed configs, unit tests)
  * Stale/temp files, untracked `.agents` directories, database migrations, and plan files.
* **Dirty State Context**: The root repository is currently dirty with local edits.

---

## 2. Existing Branches & Worktrees

### Branches
The repository has multiple local branches, including:
* `main` (active in the root repository)
* `feature/harness-engineering` (already exists, linked to a worktree)
* `pr-21`, `feat/phase-06-video-pipeline`, `feat/phase-07-tts-coqui`, etc.

### Worktrees
The output of `git worktree list` shows that the following worktrees are present:
1. `/Users/macbook/projects/sophia-ai-factory` (Branch: `main`)
2. `/Users/macbook/projects/sophia-ai-factory/.claude/worktrees/agent-a05b76712d10f137f` (locked)
3. `/Users/macbook/projects/sophia-ai-factory/.claude/worktrees/agent-a0e743bfdde5bfe13` (locked)
4. `/Users/macbook/projects/sophia-ai-factory/.claude/worktrees/agent-a1006affac0bd1129` (locked)
5. `/Users/macbook/projects/sophia-ai-factory/.claude/worktrees/agent-a8a9630589baa4704` (locked)
6. `/Users/macbook/projects/sophia-ai-factory/.claude/worktrees/feature-harness-engineering` (Branch: `feature/harness-engineering`)

---

## 3. Finding: Existing Branch & Worktree Found

* **Branch `feature/harness-engineering`**: Yes, already exists.
* **Worktree `feature-harness-engineering`**: Yes, already exists and is checked out at path `file:///Users/macbook/projects/sophia-ai-factory/.claude/worktrees/feature-harness-engineering`.
* **Current state**: Checked out at commit `3437f20f` (matching the root repository's current HEAD).

---

## 4. Recommended Git Command Sequences

Since the branch and worktree already exist, there are two paths forward depending on whether the orchestrator wants to **reuse** the existing worktree/branch or **start completely fresh**.

### Option A: Clean Start (Force Re-create)
To safely delete the existing worktree and branch, then create a clean one from the latest `main`:

```bash
# Navigate to the repository root
cd /Users/macbook/projects/sophia-ai-factory

# 1. Force remove the existing worktree
git worktree remove --force .claude/worktrees/feature-harness-engineering

# 2. Prune any stale worktree metadata
git worktree prune

# 3. Force delete the old branch to clear local commit history
git branch -D feature/harness-engineering

# 4. Re-create the worktree and branch based on the latest main branch
git worktree add -b feature/harness-engineering .claude/worktrees/feature-harness-engineering main
```

### Option B: Reuse & Reset (Fast Option)
To keep the existing worktree directory but reset the branch state to match `main` exactly:

```bash
# 1. Navigate to the existing worktree
cd /Users/macbook/projects/sophia-ai-factory/.claude/worktrees/feature-harness-engineering

# 2. Force clean and reset any untracked or modified files in the worktree
git clean -fdx
git reset --hard HEAD

# 3. Reset the branch pointing to main (syncs it with current main)
git reset --hard main
```
