# PRD: Zero-Bug Development Pipeline

**Date:** 2026-07-04
**Project:** Sophia AI Factory
**Stage:** PMF→Early Scale
**Status:** GO ✅

---

## 1. Vision

Tự động chặn UI bugs (broken routes, 404, console errors, hardcoded colors) **trước** khi code lên production. Zero bug deploy — không cần đi fix sau.

## 2. Core Features

### Pre-Deploy Gate (`scripts/pre-deploy-gate.mjs`)

4 bước tự động, chạy trong `deploy-with-sha.sh`, **block deploy nếu FAIL**:

#### Step 1: Route Integrity Scan
```
Input:  grep -rn 'href="/' src/components/stitch/screens/ --include="*.tsx"
Output: Mỗi href → kiểm tra file page.tsx tồn tại trong src/app/[locale]/
Fail:   Nếu bất kỳ route nào không có page.tsx tương ứng
```

#### Step 2: agent-browser E2E Click-Through
```
Flow:   Mở site → landing render? → login form? → signup link? → pricing?
Tool:   agent-browser CLI (open → snapshot → click → snapshot)
Fail:   Nếu element không tìm thấy, 404 page xuất hiện, console errors
```

#### Step 3: Page Render Check
```
Input:  List 20+ critical URLs (/, /login, /pricing, /dashboard, /api/health, etc.)
Check:  Mỗi URL HTTP 200 (không 404/500)
Fail:   Nếu bất kỳ URL nào không 200
```

#### Step 4: CSS Variable Audit
```
Input:  git diff --cached (changed files)
Check:  Không có #6366F1, indigo-*, hardcoded hex colors trong changed files
Fail:   Nếu phát hiện hardcoded colors
```

## 3. Success Metrics

| Metric | Target |
|--------|--------|
| Bug lọt ra production | 0 (về UI/route) |
| Pre-deploy gate false positive rate | < 5% |
| Gate execution time | < 60s |
| Routes tested | ≥ 20 critical paths |

## 4. Agentic Architecture

- **agent-browser**: Tự động open browser, click, snapshot, verify element tồn tại
- **Script tự động**: Node.js script chạy agent-browser commands + parse kết quả
- **Tích hợp**: Gọi từ `scripts/deploy-with-sha.sh` trước wrangler deploy

## 5. Tech Stack

| Component | Tool |
|-----------|------|
| Script runtime | Node.js + exec |
| Browser automation | agent-browser CLI |
| Route scan | grep + fs.existsSync |
| HTTP check | fetch/curl |
| CSS audit | grep + git diff |
| Integration | deploy-with-sha.sh hook |

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| agent-browser flaky (timeout, network) | Retry 2 lần, fail only if consistent |
| Route scan false positive (dynamic routes) | Chỉ check static routes, skip [param] |
| Gate chậm (>60s) | Parallel execution steps |
| Developer bị chặn deploy vì false positive | `SKIP_PRE_DEPLOY_GATE=1` env var bypass |
