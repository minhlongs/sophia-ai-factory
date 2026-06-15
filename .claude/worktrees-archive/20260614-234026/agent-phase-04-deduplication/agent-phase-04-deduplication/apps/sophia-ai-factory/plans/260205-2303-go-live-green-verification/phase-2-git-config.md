# Phase 2: Git Configuration

## Objective
Standardize git configuration for CI/CD compatibility.

## Steps
1.  **Check Current Status**:
    ```bash
    git status
    git remote -v
    ```
2.  **Rename Branch**: Standardize on `main`.
    ```bash
    git branch -m master main
    ```
3.  **Configure Remote**:
    *Check if repo exists, if not create it, else add remote.*
    ```bash
    # Try to find existing repo or create new one
    gh repo view sophia-ai-factory --json url -q .url || gh repo create sophia-ai-factory --private --source=. --remote=origin
    ```

    *If remote needs to be added manually:*
    ```bash
    git remote add origin $(gh repo view sophia-ai-factory --json url -q .url)
    ```

4.  **Verify Remote**:
    ```bash
    git remote -v
    ```

## Success Criteria
- Current branch is `main`
- Remote `origin` is configured pointing to GitHub
