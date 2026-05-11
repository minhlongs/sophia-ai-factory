# INC-2026-02 — GitHub Actions disabled at account level → deploy doctrine change

## Metadata

| Field | Value |
|---|---|
| **Incident ID** | `INC-2026-02` |
| **Title** | GitHub Actions disabled at user level (free-tier minutes exhausted); CI/CD pipeline non-functional |
| **Date / Ngày** | 2026-05-03 |
| **Detected at / Phát hiện** | 2026-05-03 (first failed-to-start workflow run after push) |
| **Resolved at / Khắc phục** | 2026-05-03 (CF-direct doctrine adopted after 5 successful manual deploys) |
| **Duration / Thời gian** | ~hours of triage + same-day permanent workaround |
| **Severity / Mức độ** | P1 — CI pipeline down, but deploy path still available via wrangler CLI |
| **Customer impact / Ảnh hưởng** | 0 production downtime. Engineering velocity: manual deploys required for ~hours |
| **Authors / Người viết** | @longtho638 |
| **Status / Trạng thái** | published |

---

## 1. Summary / Tóm Tắt

### English

The `longtho638-jpg` GitHub account had Actions disabled at user level (free-tier minutes exhausted or account-review trigger). The `Tests & Deploy` workflow could not run, blocking the canonical push-to-main → CI → deploy flow. After 5 successful manual `npm run deploy:full` invocations (Cloudflare Workers wrangler CLI) confirmed the path worked, the team adopted CF-direct deploys as the permanent canonical doctrine rather than restore CI. Workflow archived as `.github/workflows/test.yml.disabled`. This trade simplicity + zero CI dependency for the burden of manual deploys.

### Tiếng Việt

Tài khoản `longtho638-jpg` bị GitHub vô hiệu hóa Actions ở mức user (hết free-tier hoặc bị review). Workflow `Tests & Deploy` không chạy được, chặn flow chuẩn push-to-main → CI → deploy. Sau 5 lần `npm run deploy:full` (wrangler CLI Cloudflare Workers) thành công xác nhận path hoạt động, team quyết định lấy CF-direct làm doctrine canonical vĩnh viễn thay vì khôi phục CI. Workflow lưu trữ tại `.github/workflows/test.yml.disabled`. Trade-off: đơn giản hơn + không phụ thuộc CI, nhưng phải deploy thủ công.

---

## 2. Timeline / Diễn Biến (UTC)

| Time | Event |
|---|---|
| `~2026-05-03 morning` | Push to main → `Tests & Deploy` workflow does not start (no run row appears) |
| `~2026-05-03 +1h` | Triage: confirmed via `gh api` that Actions is disabled at the user account level |
| `~2026-05-03 +2h` | Decision: rather than upgrade GitHub plan, validate CF-direct path manually |
| `~2026-05-03 +2-4h` | 5 successful manual deploys: `d84f3a6e`, `e53c7dd2`, `aafd1ba4`, `0520585b`, `f418f3df`. Each verified via `/api/version` SHA match |
| `~2026-05-03 +4h` | Workflow `test.yml` renamed → `.disabled`. CLAUDE.md updated with new doctrine. Verify rule `.claude/rules/sophia-deploy-verify.md` written |
| `~2026-05-03 +5h` | First commits land under new doctrine; pattern stabilizes |

---

## 3. Root Cause — 5 Whys

| # | Question | Answer |
|---|---|---|
| 1 | Why did `Tests & Deploy` workflow stop firing? | GitHub Actions was administratively disabled on the `longtho638-jpg` account |
| 2 | Why was it disabled? | Free-tier minutes exhausted (or account-review automation triggered) |
| 3 | Why were free-tier minutes exhausted? | The repo's CI ran builds + tests + deploy on every push to main, consuming ~3–8 min × ~hundreds of pushes/month. Single-developer repo on free tier had no headroom |
| 4 | Why was the workflow running so heavily? | Build + test + deploy all bundled in one workflow that ran on every push; preview deploys for PRs amplified it |
| 5 | Why did we depend on free tier instead of a paid plan or alternate CI? | Account economics decision — paid GitHub plan exceeded marginal value at this stage; alternate CI (GitLab, CircleCI) introduces another dependency |

**Root cause statement:** Free-tier GitHub Actions has insufficient runway for an active single-developer Cloudflare Workers project; depending on it created a single point of failure with no graceful degradation path until CF-direct was validated.

---

## 4. What Went Well

- **Decisive shift:** instead of paying to restore CI, the team validated a simpler manual path within hours
- **Production stayed up:** zero customer impact during the transition
- **Doctrine documented immediately:** `.claude/rules/sophia-deploy-verify.md` + CLAUDE.md updates landed same-day
- **SHA-match verification:** `/api/version` endpoint exists, making "is the new code actually live?" a trivial curl check

## 5. What Went Wrong

- No prior contingency plan for CI outage — discovery happened on a push that needed to ship
- The build+test+deploy bundling magnified minute consumption; preventable with split workflows
- No usage alert from GitHub before the disable — we found out only when workflows stopped firing

## 6. Where We Got Lucky

- Wrangler CLI worked first try with existing secrets (no extra setup needed)
- The OpenNext build was already invoking wrangler under the hood for `deploy:full`; the path was already exercised locally
- The decision happened during a quiet customer-traffic window, leaving room to validate

---

## 7. Action Items

| # | Action | Owner | Due | Type |
|---|---|---|---|---|
| 1 | Add CF-direct doctrine to `.claude/rules/sophia-deploy-verify.md` (authoritative) | @longtho638 | 2026-05-03 | Mitigate (done) |
| 2 | Document the 5 proof-of-path commits in CLAUDE.md historical note | @longtho638 | 2026-05-03 | Mitigate (done) |
| 3 | Keep `.github/workflows/test.yml.disabled` for fast restore if GitHub plan ever upgraded | @longtho638 | 2026-05-03 | Mitigate (done) |
| 4 | If CI is restored: split test workflow (free-tier minutes-cheap) from deploy workflow (kept on wrangler) | @longtho638 | future | Prevent |
| 5 | Operator monitor: weekly check that `/api/version` SHA matches `git rev-parse HEAD` after most recent merge to main | @longtho638 | 2026-05-15 | Detect |

---

## 8. Customer Comms

- [ ] Status page incident — N/A (no production impact)
- [x] Internal: doctrine change documented in CLAUDE.md + `sophia-deploy-verify.md`

---

## 9. References

- Doctrine doc: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- Archived workflow: `apps/sophia-ai-factory/.github/workflows/test.yml.disabled`
- CLAUDE.md historical note: `apps/sophia-ai-factory/CLAUDE.md` § "Historical Note: GitHub Actions"
- Proof-of-path commits: `d84f3a6e`, `e53c7dd2`, `aafd1ba4`, `0520585b`, `f418f3df`
- Version endpoint: `https://sophia.agencyos.network/api/version`

---

## Author Checklist

- [x] Blameless tone — no person named as cause
- [x] Timeline UTC, accurate to nearest hour (sub-hour granularity unavailable retroactively)
- [x] 5-Whys reaches a system/process root cause (CI plan economics + bundling)
- [x] Every action item has owner + due date
- [x] Customer impact quantified (0 production impact)
- [x] Filed in `docs/postmortems/` + indexed in README
