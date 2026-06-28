# Renovate Bot Setup

## Overview

Renovate Bot automatically creates pull requests to keep dependencies up-to-date. It monitors `package.json` and `package-lock.json` and opens PRs for new versions.

Configuration: `.renovaterc.json`

---

## Installation

1. Go to the [Renovate GitHub App](https://github.com/marketplace/renovate) page.
2. Click **"Install"** or **"Configure"**.
3. Select the repository: `longtho638-jpg/sophia-ai-factory`
4. Grant the following permissions:
   - **Pull requests:** `Read & write`
   - **Contents:** `Read-only` (sufficient for Renovate to read dependency data)
   - **Metadata:** `Read-only`
5. Click **"Complete installation"**.

---

## Configuration

Renovate reads `.renovaterc.json` at the repository root.

Current settings:

| Setting | Value |
|---------|-------|
| Base config | `config:recommended` |
| Auto-merge | Enabled for `minor`, `patch`, `pin`, `digest` updates |
| Grouping | Next.js + React grouped together |
| PR concurrency | 5 |
| Hourly PR limit | 2 |
| NPM range strategy | `bump` |

---

## How It Works

1. **Scanning:** Renovate scans your dependencies every ~3 hours.
2. **PR Creation:** For each update:
   - Creates a branch with updated `package.json`
   - Updates `package-lock.json` to the latest matching version
   - Opens a PR with changelog links (if available)
3. **CI:** Pre-push hooks run (`type-check`, `lint`, `test`).
4. **Merge:** If CI passes and the update is auto-mergeable (e.g., patch releases), Renovate auto-merges the PR.

---

## Manual Trigger

To force Renovate to run immediately:

```bash
# Create an empty commit to trigger
git commit --allow-empty -m "chore: trigger renovate" && git push

# Or use the Renovate dashboard to trigger a run
# https://app.renovatebot.com/
```

---

## Adjusting Configuration

Common customizations:

### Exclude a package from updates
```json
{
  "packageRules": [
    {
      "matchPackageNames": ["some-package"],
      "enabled": false
    }
  ]
}
```

### Increase PR concurrency
```json
{
  "prConcurrentLimit": 10
}
```

### Schedule updates (e.g., only on weekdays)
```json
{
  "schedule": ["before 5am on monday", "before 5am on wednesday", "before 5am on friday"]
}
```

After editing `.renovaterc.json`, commit and push. Renovate picks up changes automatically.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No PRs after 24h | Renovate not installed or misconfigured | Check GitHub App installation status in Settings → Actions → Renovate |
| PRs fail CI | Tests or lint failing | Fix the failing checks; Renovate respects `requiredStatusChecks` |
| Too many PRs | Dependencies update frequently | Use `prConcurrentLimit` or schedule constraints |
| Duplicate PRs | Multiple version ranges in dependencies | Group packages using `groupName` |
| PRs for major versions | Auto-merge disabled for majors (by design) | Manually review major updates; they won't auto-merge |

---

## Disabling Renovate Temporarily

```bash
# Rename the config file (worst-case)
mv .renovaterc.json .renovaterc.json.disabled
git commit -am "temp: disable renovate" && git push
```

Re-enable by restoring the file.

---

## Support

- Renovate docs: https://docs.renovatebot.com/
- Issues: https://github.com/renovatebot/renovate/issues
