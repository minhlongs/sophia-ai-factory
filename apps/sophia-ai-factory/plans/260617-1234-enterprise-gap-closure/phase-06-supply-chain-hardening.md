# Phase 06 — Supply-Chain Hardening

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Infra & Cost category)
- Related: D-5.1 Next.js bump fixed HIGH CVEs; this phase establishes ongoing supply-chain hygiene
- Related: DevEx improvements via automated dependency updates

## Overview

- **Priority:** P1 (independent; can run parallel)
- **Status:** pending
- **Description:** Harden software supply chain through SBOM generation, signed commits, and automated dependency updates. Ensure every release has an artifact bill of materials and commit attestation.

## Key Insights

- Current state: 12 HIGH CVEs were found in `next@^16.2.3` (fixed in Wave A by bump to 16.2.5)
- No SBOM (Software Bill of Materials) published with releases
- No commit signing enforcement (any developer can push)
- No automated patch application (Renovate/Dependabot not configured)
- Infra score was 5/10 partly due to single-point deploy; supply-chain controls are part of enterprise readiness

## Requirements

### Functional
1. **SBOM generation** — Produce SPDX or CycloneDX SBOM for every production build (`npm run build`)
2. **SBOM publication** — Attach SBOM to GitHub Releases (or store in R2 with public URL)
3. **Commit signing enforcement** — Require GPG-signed commits on main branch (pre-receive hook or GitHub branch protection)
4. **Automated dependency updates** — Configure Renovate Bot or Dependabot to auto-merge safe patches (patch-level, no breaking changes)
5. **Vulnerability scanning** — Integrate `npm audit` into CI; fail build on HIGH severity

### Non-functional
- SBOM generation must not add >30s to build time
- Signed commits must not block emergency deploys (override procedure)
- Auto-merge only for patch-level updates with passing tests
- Dependency update PRs include changelog summary

## Architecture

### SBOM Generation

Use `@cyclonedx/bom` or `spdx-sbom-generator`:

```bash
# package.json scripts
{
  "scripts": {
    "sbom": "cyclonedx-bom --output-file sbom.xml --output-format xml",
    "build": "npm run sbom && next build"
  }
}
```

Or using `@snyk/sbom`:

```bash
npx @snyk/sbom --format cyclonedx --output sbom.json
```

**Integration:** Add to `deploy-with-sha.sh`:
```bash
#!/bin/bash
set -e

# Build
npm run build

# Generate SBOM
npm run sbom
SBOM_FILE="sbom-$(git rev-parse HEAD).json"

# Upload SBOM to R2 (for archive)
npx wrangler r2 upload-file sophia-ai-factory-sboms "$SBOM_FILE" "sboms/$SBOM_FILE" \
  --metadata '{"content-type":"application/json"}'

# Optional: Attach to GitHub Release
gh release upload "$(git describe --tags --abbrev=0)" "sboms/$SBOM_FILE" --clobber
```

### Commit Signing Enforcement

**GitHub branch protection:**
- Require signed commits on `main` branch
- GPG keys stored in GitHub user settings
- Emergency override: `git commit -S` required; if key unavailable, `ALLOW_UNSIGNED_DEPLOY=1` logs to audit

**.git/hooks/pre-receive.local** (if self-hosted):
```bash
#!/bin/bash
while read oldrev newrev refname; do
  # Check all new commits are signed
  unsig=$(git rev-list $oldrev..$newrev --no-merges | while read commit; do
    git verify-commit $commit 2>/dev/null || echo $commit
  done)
  if [ -n "$unsig" ]; then
    echo "ERROR: Following commits are not GPG-signed:"
    echo "$unsig"
    echo "Sign with: git commit -S -m 'msg'"
    exit 1
  fi
done
exit 0
```

**Deploy script override:**
```bash
# In deploy-with-sha.sh
if ! git log -1 --show-signature -1 --format="%G?" | grep -q "^G$"; then
  if [ "$ALLOW_UNSIGNED_DEPLOY" = "1" ]; then
    echo "⚠️  Unsigned deploy permitted (ALLOW_UNSIGNED_DEPLOY=1)"
    echo "Unsigned commit: $(git log -1 --format='%H %s')" >> deploy_unsigned.log
  else
    echo "ERROR: Deploy requires signed commit. Use ALLOW_UNSIGNED_DEPLOY=1 for emergencies."
    exit 1
  fi
fi
```

### Renovate Configuration

```json
// .renovaterc.json
{
  "extends": ["config:base"],
  "rangeStrategy": "bump",
  "packageRules": [
    {
      "matchPackageNames": ["next"],
      "allowedVersions": "<17" // stay on Next 16 LTS
    },
    {
      "matchManagers": ["npm"],
      "matchUpdateTypes": ["patch", "minor"],
      "automerge": true,
      "requiredStatusChecks": null
    },
    {
      "matchManagers": ["npm"],
      "matchUpdateTypes": ["major"],
      "automerge": false
    }
  ],
  "prHourlyLimit": 10,
  "prConcurrentLimit": 5
}
```

**Install Renovate:**
```bash
npx renovate --token=${RENOVATE_TOKEN} sophia-ai-factory
```

Configure GitHub App with:
- Auto-merge for patch/minor (with passing tests)
- Create PRs daily at 6am
- Assign to `dependabot[bot]`

### Vulnerability Scanning CI

Add to `package.json`:
```json
{
  "scripts": {
    "audit": "npm audit --audit-level=high --json",
    "audit:fail": "npm audit --audit-level=high >/dev/null 2>&1 && exit 0 || exit 1"
  }
}
```

Integrate into pre-push:
```bash
# .husky/pre-push
#!/bin/bash
echo "🔍 Running security audit..."
npm run audit:fail
if [ $? -ne 0 ]; then
  echo "❌ High-severity vulnerabilities found. Fix with: npm audit fix"
  exit 1
fi
```

## Related Code Files

**Files to create:**
- `.renovaterc.json`
- `scripts/supply-chain/generate-sbom.js`
- `scripts/supply-chain/verify-signed-commits.js`
- `scripts/security/audit-high-cves.js` (fail on HIGH)
- `docs/security/SUPPLY-CHAIN.md` — documenting policies
- `docs/security/renovate-bot-setup.md` — how it works
- `docs/security/commit-signing-guide.md` — developer guide

**Files to modify:**
- `package.json` — add `sbom`, `audit` scripts
- `deploy-with-sha.sh` — add SBOM upload + commit signature check
- `.husky/pre-push` — add audit check
- `scripts/apply-migrations.sh` — no changes needed

## Implementation Steps

1. **SBOM tool selection** — evaluate CycloneDX vs SPDX; test generation time
2. **Add SBOM script** — `npm run sbom`; ensure includes all prod dependencies
3. **Integrate SBOM into build** — modify `deploy-with-sha.sh` to upload to R2
4. **Configure Renovate** — create `.renovaterc.json`; install GitHub App
5. **Test auto-merge** — create test repo; verify patch updates auto-merge after tests pass
6. **Implement commit signing check** — add to pre-push and deploy script
7. **Document developer guide** — how to set up GPG key, sign commits
8. **Emergency override process** — document `ALLOW_UNSIGNED_DEPLOY` procedure
9. **Staging test** — push unsigned commit; verify pre-push blocks; verify deploy guard blocks
10. **Production rollout** — enforce on main branch; monitor Renovate PR volume
11. **Set up vulnerability alerting** — configure GitHub Dependabot alerts; ensure team notified
12. **SOC 2 evidence** — collect SBOM samples, Renovate config, commit signature logs

## Todo List

- [ ] Evaluate SBOM tools (CycloneDX CLI vs @snyk/sbom)
- [ ] Add SBOM generation to package.json; test build time impact
- [ ] Configure R2 bucket for SBOM storage (if separate) or use existing
- [ ] Update deploy script to upload SBOM
- [ ] Configure Renovate Bot (GitHub App install; .renovaterc.json)
- [ ] Test Renovate on fork; verify auto-merge for patches
- [ ] Generate GPG keys for all developers; add to GitHub
- [ ] Add pre-push signature check (optional in dev, required in CI)
- [ ] Add deploy script signature verification
- [ ] Document emergency override procedure
- [ ] Enable Dependabot alerts (if not already)
- [ ] Write SUPPLY-CHAIN.md policy doc
- [ ] Run first production SBOM; verify attachment
- [ ] Audit: check that all commits on main are signed

## Success Criteria

- ✅ `npm run sbom` produces valid CycloneDX/SPDX JSON/XML
- ✅ SBOM uploaded to R2 with every deploy (verify `wrangler r2 list` shows recent files)
- ✅ All commits on `main` branch are GPG-signed (verified via `git log --show-signature`)
- ✅ Renovate Bot opens PRs for patch/minor updates; tests pass → auto-merge
- ✅ Pre-push hook runs `npm audit --audit-level=high`; fails on HIGH vulnerabilities
- ✅ `docs/security/SUPPLY-CHAIN.md` exists with SBOM, signing, Renovate policies
- ✅ Zero HIGH npm audit findings on `main` (continuous)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SBOM generation breaks build (tool incompatibility) | Med | Med | Pin tool version; test before CI integration |
| Renovate creates too many PRs (noise) | High | Low | Configure `prConcurrentLimit`; schedule daily batch |
| Auto-merge breaks prod (false-negative tests) | Low | High | Require 2 passing checks (unit + e2e); sample canary deploys |
| Developers lose GPG keys → blocked | Med | Med | Document key backup; allow admin recovery; emergency override |
| SBOM contains sensitive info (paths) | Low | Low | Use `--exclude` patterns; review before publish |

## Security Considerations

- SBOMs stored in R2 should be publicly readable (transparency) but not indexed by search engines
- Commit signing keys should have 1-year expiry; rotate annually
- Renovate Bot token should have minimal permissions (read repo, open PRs, merge)
- Vulnerability scanning must run on every push to catch new issues

## Next Steps

1. **Week 1:** SBOM tool PoC; add to build
2. **Week 2:** Renovate config; test on fork
3. **Week 3:** GPG key setup for team; signing enforcement
4. **Week 4:** Audit checks; SOC 2 evidence collection
