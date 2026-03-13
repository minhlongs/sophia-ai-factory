---
description: 🔑 Secret Detection — API Keys, Tokens, Credentials Scanner
argument-hint> [scope: staged|committed|all|realtime]
---

**Think harder** để detect secrets: <scope>$ARGUMENTS</scope>

**IMPORTANT:** NEVER commit secrets — scan BEFORE commit with pre-commit hooks.

## Secret Detection Tools

| Tool | Speed | Accuracy | False Positives | Best For |
|------|-------|----------|-----------------|----------|
| `gitleaks` | Fast | High | Low | Git history |
| `truffleHog` | Medium | High | Low | Deep scanning |
| `detect-secrets` | Fast | Medium | Medium | Pre-commit |
| `git-secrets` | Fast | Low | High | AWS secrets |
| `semgrep` | Fast | High | Low | Code + secrets |

## Detection Commands

### `staged` — Scan Staged Changes (Pre-commit)
```bash
# Gitleaks (staged files only)
gitleaks detect --staged --verbose --report-format json \
  --report-path reports/gitleaks-staged.json

# Detect-secrets (pre-commit hook)
detect-secrets-hook --baseline .secrets.baseline src/

# Semgrep secrets
semgrep --config "p/secrets" --json --output reports/semgrep-secrets.json src/
```

### `committed` — Scan Git History
```bash
# Gitleaks full history
gitleaks detect --source . --verbose \
  --report-path reports/gitleaks-history.json

# TruffleHog (deep scan)
trufflehog filesystem . --json \
  --output reports/trufflehog.json

# Find high-entropy strings
trufflehog filesystem . --only-verified \
  --fail --entropy
```

### `all` — Full Repository Scan
```bash
#!/bin/bash
# Comprehensive secret detection

echo "=== Gitleaks Scan ==="
gitleaks detect --source . --verbose \
  --report-format sarif \
  --report-path reports/gitleaks.sarif

echo "=== TruffleHog Scan ==="
trufflehog git file://. --json \
  --output reports/trufflehog.json

echo "=== Semgrep Secrets ==="
semgrep --config "p/secrets" \
  --json --output reports/semgrep-secrets.json .

echo "=== AWS CodeGuru (if configured) ==="
aws codeguru-security create-scan \
  --s3-destination s3://security-scans/repo/
```

### `realtime` — Pre-commit Hook Setup
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running secret detection..."

# Gitleaks pre-commit
if ! gitleaks detect --staged --verbose; then
  echo "❌ Secrets detected in staged changes!"
  echo "Remove secrets before committing."
  exit 1
fi

# Detect-secrets
if ! detect-secrets-hook --baseline .secrets.baseline; then
  echo "❌ Potential secrets found!"
  echo "Run 'detect-secrets audit' to verify"
  exit 1
fi

echo "✅ No secrets detected"
exit 0
```

## Secret Patterns Detected

| Secret Type | Pattern Example | Risk |
|-------------|-----------------|------|
| AWS Keys | `AKIA[0-9A-Z]{16}` | Critical |
| GitHub Token | `ghp_[a-zA-Z0-9]{36}` | Critical |
| Google API | `AIza[0-9A-Za-z_-]{35}` | High |
| Stripe Key | `sk_live_[a-zA-Z0-9]{24}` | Critical |
| JWT | `eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*` | Medium |
| Private Key | `-----BEGIN RSA PRIVATE KEY-----` | Critical |
| Slack Token | `xox[baprs]-[a-zA-Z0-9-]*` | High |
| Database URL | `postgresql://.*:.*@` | High |

## Custom Rules (Gitleaks)

```toml
# .gitleaks.toml
title = "AgencyOS Custom Rules"

[extend]
useDefault = true

[[rules]]
id = "agencyos-api-key"
description = "AgencyOS API Key"
regex = '''agenc_[a-zA-Z0-9]{32}'''
tags = ["key", "AgencyOS"]
keywords = ["agenc_"]

[[rules]]
id = "polar-sh-token"
description = "Polar.sh API Token"
regex = '''pol_sk_[a-zA-Z0-9]{40}'''
tags = ["key", "Polar"]
keywords = ["pol_sk_"]

[[rules]]
id = "supabase-key"
description = "Supabase Anon Key"
regex = '''eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*'''
tags = ["key", "Supabase"]
keywords = ["supabase"]
```

## Remediation Workflow

### 1. Rotate Compromised Secret
```bash
# If secret is committed:
# Step 1: Immediately rotate the secret
# - AWS: Create new IAM key, disable old
# - GitHub: Settings → Developer settings → Personal access tokens
# - Stripe: Dashboard → Developers → API keys

# Step 2: Remove from git history (if recent)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/secret/file" \
  --prune-empty --tag-name-filter cat -- --all

# Step 3: Force push (WARNING: rewrites history)
git push origin --force --all

# Step 4: Notify affected parties
```

### 2. Git BFG (Faster alternative)
```bash
# Install BFG
brew install bfg

# Remove secrets from history
bfg --delete-files .env
bfg --replace-text passwords.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## Pre-commit Configuration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']

  - repo: https://github.com/returntocorp/semgrep
    rev: v1.40.0
    hooks:
      - id: semgrep
        args: ['--config', 'p/secrets']
```

## Environment Variables (Safe Pattern)

```typescript
// ✅ GOOD: Use environment variables
const apiKey = process.env.API_KEY;
const dbUrl = process.env.DATABASE_URL;

// ❌ BAD: Hardcoded secrets
const apiKey = "sk_live_abc123";  // NEVER DO THIS
const dbPassword = "supersecret";  // NEVER DO THIS
```

## Secret Scan Report Template

```markdown
# Secret Detection Report

**Date:** 2026-03-04
**Scope:** Full repository history
**Tool:** Gitleaks v8.18.0

## Summary
- Files scanned: 1,234
- Commits scanned: 456
- Secrets found: 3

## Findings

### CRITICAL-001: AWS Access Key
**File:** `config/deprecated.ts`
**Commit:** abc123def
**Line:** 45
**Secret:** `AKIA...`
**Status:** ✅ Rotated

### HIGH-002: Database Connection String
**File:** `.env.example`
**Commit:** def456
**Line:** 12
**Status:** ✅ Removed from history

## Actions Taken
1. All secrets rotated
2. History rewritten with BFG
3. Pre-commit hooks installed
4. Team notified
```

## Related Commands

- `/security-audit` — Full security audit
- `/vuln-scan` — Vulnerability scanning
- `/audit-permissions` — Permission audit
