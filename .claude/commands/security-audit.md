---
description: 🔒 Security Audit — Vulnerability Scan, Penetration Testing, Compliance
argument-hint: [scope: full|web|api|infra|code|quick]
---

**Think harder** để thực hiện security audit: <scope>$ARGUMENTS</scope>

**IMPORTANT:** ONLY run on systems you own or have explicit permission to test.

## Security Audit Framework

### OWASP Top 10 Coverage

| ID | Vulnerability | Detection Method |
|----|---------------|------------------|
| A01 | Broken Access Control | AuthZ testing |
| A02 | Cryptographic Failures | TLS/cipher scan |
| A03 | Injection | SQLi, XSS, Command injection tests |
| A04 | Insecure Design | Architecture review |
| A05 | Security Misconfiguration | Config audit |
| A06 | Vulnerable Components | Dependency scan |
| A07 | Auth Failures | Brute force, session testing |
| A08 | Data Integrity | Hash verification |
| A09 | Logging Failures | Log audit |
| A10 | SSRF | Request forgery tests |

## Audit Scopes

### `full` — Comprehensive Audit (4-8 hours)
```bash
# Full security audit checklist
1. External reconnaissance
2. Web application testing
3. API security testing
4. Infrastructure review
5. Code review (SAST)
6. Dependency audit
7. Configuration audit
8. Report generation
```

### `web` — Web Application Audit (2-4 hours)
```bash
# OWASP ZAP scan
zap-baseline.py -t https://agencyos.network -r zap-report.html

# Nikto scan
nikto -h https://agencyos.network -output nikto-report.txt

# Manual testing
- XSS vectors
- CSRF tokens
- Session management
- Access control
```

### `api` — API Security Audit (2-3 hours)
```bash
# Rate limiting test
for i in {1..100}; do
  curl -s -H "Authorization: Bearer $TOKEN" \
    https://api.agencyos.network/v1/health
done

# AuthZ testing
# Try accessing other users' resources
curl -H "Authorization: Bearer $USER1_TOKEN" \
  https://api.agencyos.network/v1/users/$USER2_ID

# Input validation
curl -X POST https://api.agencyos.network/v1/missions \
  -H "Content-Type: application/json" \
  -d '{"data": "<script>alert(1)</script>"}'
```

### `infra` — Infrastructure Audit (2-3 hours)
```bash
# SSL/TLS scan
nmap --script ssl-enum-ciphers -p 443 agencyos.network

# Port scan
nmap -sV -sC agencyos.network

# DNS audit
dig agencyos.network ANY
nslookup agencyos.network

# Header analysis
curl -sI https://agencyos.network | grep -E "^(HTTP|X-|Content-|Strict)"
```

### `code` — Code Security Review (2-4 hours)
```bash
# SAST with Semgrep
semgrep --config auto --error .

# Secret detection
gitleaks detect --source . --verbose

# Hardcoded credentials
grep -r "password\|secret\|api_key\|token" src/ --include="*.ts" --include="*.js"
```

### `quick` — Quick Security Scan (30 min)
```bash
# Quick checklist
npm audit --audit-level=high
semgrep --config auto --quiet .
grep -r "TODO.*security\|FIXME.*security" .
curl -sI https://agencyos.network | grep -i "x-frame\|xss\|csp"
```

## Security Scanners

### 1. Dependency Audit
```bash
# NPM audit
npm audit --audit-level=high --json > npm-audit.json

# Snyk (more comprehensive)
snyk test --severity-threshold=high

# GitHub Dependabot
# Check: https://github.com/{repo}/security/dependabot
```

### 2. SAST (Static Analysis)
```bash
# Semgrep
semgrep --config "p/typescript" --error src/

# ESLint security plugin
npx eslint --plugin eslint-plugin-security src/

# SonarQube (if configured)
sonar-scanner -Dsonar.projectKey=agencyos
```

### 3. DAST (Dynamic Analysis)
```bash
# OWASP ZAP
zap-cli quick-scan --spider -s http://localhost:3000

# SQLMap (for SQL injection testing)
sqlmap -u "http://localhost:3000/api/users?id=1" --batch

# XSS testing
xsstrike -u "http://localhost:3000/search?q=test"
```

### 4. Infrastructure Scanning
```bash
# Nmap comprehensive
nmap -sS -sV -O -A --script vuln agencyos.network

# Masscan (fast port scan)
masscan -p1-65535 agencyos.network --rate=1000

# Nuclei (vulnerability scanner)
nuclei -u https://agencyos.network -t exposures,cves,misconfiguration
```

## Security Headers Checklist

| Header | Value | Status |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | ⚪ |
| `Content-Security-Policy` | `default-src 'self'` | ⚪ |
| `X-Frame-Options` | `DENY` | ⚪ |
| `X-Content-Type-Options` | `nosniff` | ⚪ |
| `X-XSS-Protection` | `1; mode=block` | ⚪ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ⚪ |
| `Permissions-Policy` | `geolocation=(), microphone=()` | ⚪ |

## Authentication Security

```bash
# Test password policy
curl -X POST https://api.agencyos.network/auth/register \
  -d '{"email":"test@test.com","password":"123"}'
# Expected: 400 (password too weak)

# Test rate limiting
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://api.agencyos.network/auth/login \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Expected: 429 after 5 attempts

# Test JWT expiration
# Decode token and check exp claim
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .exp
```

## Report Template

```markdown
# Security Audit Report

**Date:** 2026-03-04
**Scope:** Web Application + API
**Auditor:** AgencyOS Security

## Executive Summary
- Critical: 0
- High: 2
- Medium: 5
- Low: 8

## Findings

### HIGH-001: Missing Rate Limiting on Login
**Location:** POST /api/auth/login
**Impact:** Brute force attacks possible
**Remediation:** Implement rate limiting (5 attempts/minute)

### MEDIUM-002: CSP Header Missing
**Location:** All pages
**Impact:** XSS attacks not fully mitigated
**Remediation:** Add Content-Security-Policy header

## Appendix
- Full Nmap output: `reports/nmap-scan.txt`
- ZAP report: `reports/zap-report.html`
- Semgrep output: `reports/semgrep.json`
```

## Related Commands

- `/vuln-scan` — Vulnerability scanning
- `/secret-detect` — Secret detection
- `/audit-permissions` — Permission audit
