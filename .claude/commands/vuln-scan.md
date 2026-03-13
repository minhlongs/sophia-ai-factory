---
description: 🔍 Vulnerability Scanner — Automated Security Scanning, CVE Detection
argument-hint: [target: code|deps|infra|web|all]
---

**Think harder** để scan vulnerabilities: <target>$ARGUMENTS</target>

**IMPORTANT:** Run scans in isolated environment — DO NOT scan production directly.

## Vulnerability Scanner Matrix

| Tool | Type | Target | Speed | Accuracy |
|------|------|--------|-------|----------|
| `npm audit` | SCA | Dependencies | Fast | Medium |
| `Snyk` | SCA | Dependencies | Medium | High |
| `Semgrep` | SAST | Code | Fast | High |
| `Nuclei` | DAST | Web/API | Medium | High |
| `OWASP ZAP` | DAST | Web | Slow | High |
| `Trivy` | Container | Docker | Fast | High |

## Scanner Commands

### `deps` — Dependency Scan
```bash
# NPM Audit (built-in)
npm audit --audit-level=high --json > reports/npm-audit.json

# Snyk (comprehensive)
npx snyk test --severity-threshold=high --json > reports/snyk-deps.json

# GitHub Advisory Database
gh api /repos/{owner}/{repo}/code-scanning/alerts
```

### `code` — Code Scan (SAST)
```bash
# Semgrep (recommended)
semgrep --config "p/typescript" --config "p/security" \
  --json --output reports/semgrep.json src/

# ESLint Security
npx eslint --plugin eslint-plugin-security \
  --format json --output-file reports/eslint-security.json src/

# CodeQL (if configured)
codeql database analyze codeql-db/ \
  --format=csv --output=reports/codeql.csv
```

### `web` — Web Application Scan (DAST)
```bash
# OWASP ZAP baseline
zap-baseline.py \
  -t https://agencyos.network \
  -r reports/zap-baseline.html \
  -J reports/zap-baseline.json

# ZAP full scan (longer)
zap-full-scan.py \
  -t https://agencyos.network \
  -r reports/zap-full.html

# Nuclei (template-based)
nuclei \
  -u https://agencyos.network \
  -t exposures/cves/ \
  -severity critical,high \
  -json-export reports/nuclei.json
```

### `infra` — Infrastructure Scan
```bash
# Nmap vulnerability scan
nmap --script vuln,exploit agencyos.network \
  -oX reports/nmap-vuln.xml

# Masscan (fast port discovery)
masscan -p1-65535 agencyos.network \
  --rate=1000 -oL reports/masscan.txt

# SSL Labs API
curl -s "https://api.ssllabs.com/api/v3/analyze?host=agencyos.network" \
  | jq '.endpoints[].grade'
```

### `all` — Comprehensive Scan
```bash
#!/bin/bash
# Full vulnerability scan suite

echo "=== Dependency Scan ==="
npm audit --audit-level=high --json > reports/deps.json

echo "=== Code Scan ==="
semgrep --config auto --json --output reports/code.json src/

echo "=== Web Scan ==="
nuclei -u https://agencyos.network \
  -severity critical,high,medium \
  -json-export reports/web.json

echo "=== Infrastructure Scan ==="
nmap --script vuln agencyos.network \
  -oX reports/infra.xml

echo "=== Summary ==="
echo "Reports generated in reports/"
ls -la reports/
```

## Nuclei Templates

### Custom Template for AgencyOS
```yaml
id: agencyos-security-checks
info:
  name: AgencyOS Custom Security Checks
  author: AgencyOS Security
  severity: info

requests:
  # Security Headers Check
  - method: GET
    path:
      - "{{BaseURL}}"
    matchers-condition: and
    matchers:
      - type: word
        name: strict-transport-security
        words:
          - "Strict-Transport-Security"
        part: header

      - type: word
        name: content-security-policy
        words:
          - "Content-Security-Policy"
        part: header
```

## Vulnerability Severity Classification

| Severity | CVSS Score | Response Time | Examples |
|----------|------------|---------------|----------|
| `Critical` | 9.0-10.0 | 24 hours | RCE, SQL injection, auth bypass |
| `High` | 7.0-8.9 | 7 days | XSS, CSRF, IDOR |
| `Medium` | 4.0-6.9 | 30 days | Info disclosure, missing headers |
| `Low` | 0.1-3.9 | 90 days | Banner disclosure, verbose errors |

## Automated Scan Workflow

```yaml
# .github/workflows/security-scan.yml
name: Security Scanning

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: NPM Audit
        run: npm audit --audit-level=high

      - name: Semgrep Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security
            p/typescript

      - name: Snyk Test
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

## CI/CD Integration

### GitHub Security Tab
```bash
# Upload scan results to GitHub Security
gh api \
  -X POST \
  /repos/{owner}/{repo}/code-scanning/sarifs \
  -f "commit_sha=$(git rev-parse HEAD)" \
  -f "ref=refs/heads/main" \
  -f "sarif=$(base64 -i results.sarif)" \
  -f "checkout_uri=https://github.com/{owner}/{repo}"
```

## Vulnerability Database

```bash
# Search CVE database
curl -s "https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=nodejs" \
  | grep -o 'CVE-[0-9]*-[0-9]*' | head -20

# NVD API (requires API key)
curl -s "https://services.nvd.nist.gov/rest/json/cves/2.0" \
  -H "apiKey: $NVD_API_KEY" \
  -d '{"keywordSearch": "express"}'
```

## Report Generation

```bash
# Consolidate all reports
node scripts/generate-security-report.js \
  --deps reports/deps.json \
  --code reports/code.json \
  --web reports/web.json \
  --output reports/security-summary.md

# Generate PDF (optional)
pandoc reports/security-summary.md -o reports/security-summary.pdf
```

## Related Commands

- `/security-audit` — Full security audit
- `/secret-detect` — Secret detection
- `/audit-permissions` — Permission audit
