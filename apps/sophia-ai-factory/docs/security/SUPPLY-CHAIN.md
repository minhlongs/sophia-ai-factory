# Supply Chain Security Policy

## Overview

This policy defines the supply chain security controls for the Sophia AI Factory project. It applies to all code commits and production deployments to `main` branch.

## Scope

- All commits to `main` branch
- All production deployments via `npm run deploy:full`
- All dependency updates (via Renovate Bot)
- All developers and operators with push/deploy access

---

## Controls

| Control | Enforcement Point | Verification |
|---------|-------------------|--------------|
| SBOM generation | Deploy script (`deploy-with-sha.sh`) | `.sbom/sbom-<sha>.json` exists and is uploaded to R2 |
| SBOM retention | R2 bucket `BACKUPS_BUCKET` (30-day lifecycle) | Object stored under `sbom/` prefix |
| Commit signing | Pre-push hook + deploy script | `git log --show-signature` shows valid signature |
| Dependency updates | Renovate Bot (`.renovaterc.json`) | PRs opened automatically; auto-merge for patches |
| Vulnerability blocking | Pre-push hook | `npm audit --audit-level=high` exits 0 |

---

## SBOM (Software Bill of Materials)

### Purpose
Maintain an inventory of all dependencies (direct and transitive) for each production release.

### Tool
`@cyclonedx/bom` — generates CycloneDX JSON format.

### Generation
- Command: `npm run sbom`
- Output: `.sbom/sbom-<git-short-sha>.json`
- Timing: Run automatically during `npm run deploy:full` after build completes

### Upload
- Destination: R2 bucket `BACKUPS_BUCKET`
- Key prefix: `sbom/`
- Retention: 30 days (via bucket lifecycle policy)

### Contents
- Components: all npm packages from `package-lock.json`
- Metadata: package name, version, purl coordinates, licenses
- Tools: cyclonedx-bom version

---

## Commit Signing

### Requirement
All commits pushed to `main` **must** be GPG-signed.

### Verification
- Pre-push hook: `scripts/supply-chain/verify-signed-commits.mjs`
- Deploy-time: same script runs before deploying to production

### Valid signature statuses
- `G` — good signature
- `U` — good signature, key validity not checked
- `X` — expired key (still cryptographically valid)
- `Y` — expired key (key validity not checked)
- `R` — revoked key (still cryptographically valid)

Invalid statuses (block deploy): `B` (bad), `D` (missing key), and any other.

### Setup
See `docs/security/commit-signing-guide.md`

---

## Dependency Updates

### Automation
Renovate Bot automatically:
- Checks for updated dependencies every ~3 hours
- Creates PRs for compatible version updates
- Auto-merges `minor` and `patch` releases (no breaking changes)
- Groups related packages (Next.js + React)

### Configuration
`.renovaterc.json` — see `docs/security/renovate-bot-setup.md`

### Manual overrides
To pin a dependency at a specific version, add to `packageRules` with `"enabled": false`.

---

## Vulnerability Scanning

### Threshold
HIGH severity vulnerabilities (CVE score ≥7.0) block pre-push and deploy.

### Command
`npm audit --audit-level=high`

### Blocking behavior
- Pre-push hook: exits 1, aborting push
- Deploy script: exits 2, aborting deployment

### Remediation
- Run `npm audit fix` to apply safe patches
- Review remaining HIGH vulns; assess risk and justify if left unpatched
- Update Renovate configuration to prioritize security updates

---

## Emergency Override Procedures

### Pre-push bypass (avoid unless hotfix)
```bash
git push origin main --no-verify
```
**Document:** Reason for bypass in PR description or commit message.

### Deploy bypasses

| Bypass | Env var | Use case | Documentation required |
|--------|----------|----------|------------------------|
| Unpushed commits | `ALLOW_UNPUSHED_DEPLOY=1` | Hotfix from detached HEAD | Yes |
| D1 migrations | `SKIP_D1_MIGRATIONS=1` | Emergency rollback | Yes |
| SBOM generation | `SKIP_SBOM=1` | Offline deploy | Optional |
| Signature check | `SKIP_SIGNATURE_CHECK=1` | Lost GPG key | Yes (immediate key recovery) |
| Tests | `SKIP_TESTS=1` | Critical outage | Yes |
| Attestation | `SKIP_ATTESTATION=1` | Single operator | Yes (SOC 2 CC6.1) |

All bypasses are logged in deploy output. Record:
- Date/time
- Operator identity
- Reason
- Plan to restore compliance

---

## Incident Response

### HIGH vulnerability discovered in production
1. Assess exploitability (CVSS, reachability)
2. Apply patch or implement mitigating controls
3. Deploy fix with bypass if necessary; revert bypass after fix
4. Document in post-incident review

### Unsigned commit found on main
1. Revert commit or re-commit with `git commit -S --amend`
2. If revert: create a new signed commit explaining
3. Block future occurrences via pre-push hook (already enforced)

### SBOM upload failure
1. Check R2 credentials (`wrangler.toml` bindings, `BACKUPS_BUCKET` defined)
2. Retry deploy
3. If persistent, document and proceed; SBOM can be generated post-deploy and uploaded manually

---

## Compliance Mapping

| Framework | Control | Implementation |
|-----------|---------|----------------|
| SOC 2 CC6.1 | Change management with approval | Deploy attestation (2-operator signature) |
| SOC 2 CC7.1 | Monitoring of infrastructure | Sentry + Cloudflare logs |
| ISO 27001 A.12.6 | Technical vulnerability management | `npm audit` + Renovate |
| NIST 800-53 SI-2 | Flaw remediation | Automated patching via Renovate |
| NIST 800-53 SR-2 | Supply chain protection | SBOM + commit signing |

---

## Review and Updates

This policy is reviewed quarterly or after any supply-chain incident. Update paths:
- Add new tooling → update SBOM section
- Change dependency manager → update Renovate config
- Revise threshold (HIGH → MEDIUM) → document risk acceptance

**Owner:** Platform Engineering team  
**Last updated:** 2026-06-17 (Phase 06 implementation)
