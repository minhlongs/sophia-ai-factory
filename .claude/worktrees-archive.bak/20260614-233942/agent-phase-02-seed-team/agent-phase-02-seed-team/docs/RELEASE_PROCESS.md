# Release Process

This document defines the release standards, branching strategy, commit style, and deployment steps for shipping modifications to the Sophia AI Factory platform.

---

## 1. Branching Strategy

The repository follows a trunk-based branching model:
* **`main`**: The canonical production branch. All code on `main` must compile cleanly, pass all tests, and represent the live deployment state. Direct pushes to `main` are restricted, requiring review and status check validation.
* **Feature Branches**: Named using prefixes describing the change scope (e.g. `feat/auth-challenge`, `fix/quota-leak`, `docs/release-guide`). Merge requests are directed to `main`.

---

## 2. Commit Message Convention

All commits must follow the **Conventional Commits** specification:
```
<type>(<scope>): <short description>
```

### Types
* **`feat`**: A new user-facing feature.
* **`fix`**: A bug fix.
* **`refactor`**: Code changes that do not modify external behavior or add features.
* **`docs`**: Documentation updates only.
* **`test`**: Adding or correcting test suites.
* **`chore`**: Maintenance tasks, library upgrades, or build config changes.

### Example
`feat(billing): integrate PayOS payment callback endpoint`

---

## 3. Release Checklist (Step-by-Step)

Follow these steps when preparing to release a version to production:

### Phase 1: Local Validation Gates
Before pushing your branch or merging:
```bash
# 1. Typecheck the codebase
pnpm run type-check

# 2. Run the linter
pnpm run lint

# 3. Run the Vitest unit/integration suite
pnpm run ci:test
```

### Phase 2: Merge and Tag
1. Submit a Pull Request targeting `main`.
2. Once approved, merge the Pull Request.
3. Pull the updated `main` branch locally:
   ```bash
   git checkout main
   git pull origin main
   ```
4. Create a tag using Semantic Versioning (`vMAJOR.MINOR.PATCH`):
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0: adding PayOS integration"
   git push origin v1.2.0
   ```

### Phase 3: Production Deploy
Run the direct deploy sequence:
```bash
# 1. Trigger Cloudflare deployment
pnpm run deploy:full

# 2. Apply any database migrations
pnpm run deploy:migrations
```

---

## 4. Post-Release Verification

Verify that the deploy was successful and the new version is active:
1. **Endpoint SHA Match**: Check the version API endpoint returns the newly deployed commit SHA:
   ```bash
   curl -s https://sophia.agencyos.network/api/version | jq .
   ```
2. **Log Monitoring**: Monitor the live Cloudflare worker stream for anomalies:
   ```bash
   npx wrangler tail --name sophia-ai-factory
   ```
3. **Rollback Trigger**: If errors surge, immediately execute the rollback sequence:
   ```bash
   npx wrangler rollback --name sophia-ai-factory --yes
   ```
