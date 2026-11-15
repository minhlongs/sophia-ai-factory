# 01 — GITHUB BASELINE & PULL REQUEST STATUS (G0 / G1)
# ĐƯỜNG CƠ SỞ GITHUB, NHÁNH NGUỒN & TRẠNG THÁI CÁC PULL REQUEST

- **Verification Time (UTC):** `2026-11-15T05:50:00Z`
- **Repository:** `https://github.com/minhlongs/sophia-ai-factory`
- **Integration Worktree:** `/Users/macbook/sophia-ai-factory/.claude/worktrees/zen-design-release-readiness-07-3`
- **Integration Branch:** `audit/sophia-zen-design-release-readiness`
- **Gate Verdict:** **PASS**

---

## 1. Tóm tắt Tiếng Việt / English Summary

**🇻🇳 Tiếng Việt:**
Cổng G0 đã truy vấn trực tiếp máy chủ GitHub (`git fetch origin --prune`, `gh pr list --state all`) và biên sản xuất `https://sophia.agencyos.network/api/version`. Kết quả xác thực:
1. Nhánh thiết kế `design/sophia-zen-design-os-v1` (checkpoint báo cáo `b3338a256408ef194cc63cb6fcbe6dcc27ca718c`, đỉnh nhánh `b0a721c5e2239a8e20ef7bcf1c2c1b5f5504d30d`) đã được gộp dạng **squash-merge** lên `main` qua **PR #155** (`db28aa614a9bc257cad1a10983eb0df043ab4f8a`).
2. Sau PR #155, **PR #171** (`feat/sophia-genesis-activation-funnel`) được gộp lên `main` tạo thành đỉnh `origin/main` hiện tại là `27107209d63a4861c6657cbc0f480a3fb1143280` (khớp từng ký tự `shortSha: "27107209"` trên Cloudflare Workers lúc `2026-11-15T00:30:11Z`).
3. Do đó, ứng viên tích hợp **không phát lại các bản vá cũ của Zen Design OS** lên `main`, mà khởi tạo nhánh sạch từ `27107209d63a4861c6657cbc0f480a3fb1143280`, giữ nguyên toàn bộ logic bảo mật/kinh doanh của PR #160, #163, #165, #168, #171 và đóng kín các khe hở hậu gộp.

**🇬🇧 English:**
Gate G0 inspected live GitHub state (`git fetch origin --prune`, `gh pr list --state all`) and live production `/api/version`. `design/sophia-zen-design-os-v1` (checkpoint `b3338a256408ef194cc63cb6fcbe6dcc27ca718c`, tip `b0a721c5e2239a8e20ef7bcf1c2c1b5f5504d30d`) was squash-merged in **PR #155** (`db28aa614a9bc257cad1a10983eb0df043ab4f8a`), followed by **PR #171** (`27107209d63a4861c6657cbc0f480a3fb1143280`, live `shortSha: "27107209"`). The integration branch `audit/sophia-zen-design-release-readiness` starts directly from `27107209d63a4861c6657cbc0f480a3fb1143280` without duplicating commits or regressing newer `main` logic.

---

## 2. Exact Ancestry & Commit Ledger

```text
673ec911be317233c7e6cb961bdca9d2097e210f  (merge-base of origin/main and design/sophia-zen-design-os-v1)
├── design/sophia-zen-design-os-v1 (20 commits, 184 files cumulative: 88 A, 96 M)
│   ├── 4d23ddb386f499b7627f2c828a1b80c81c6a3382  (1st Zen commit: 36 files)
│   ├── b3338a256408ef194cc63cb6fcbe6dcc27ca718c  (Reported 07.1/07.2 checkpoint: 104 files vs 4d23ddb38; 132 vs merge-base)
│   └── b0a721c5e2239a8e20ef7bcf1c2c1b5f5504d30d  (Current local + remote tip of design/sophia-zen-design-os-v1)
│
└── origin/main progression
    ├── PR #150, #160 (3c2084456...), #163 (1cffe446b...), #165 (0a76ecd2f...), #168 (d785888a73696065852f0de26f58e53334bcff1e)  [Pre-Zen main: 64 files]
    ├── db28aa614a9bc257cad1a10983eb0df043ab4f8a  [PR #155 squash-merge of Zen Design OS v1.0 — 184 files]
    └── 27107209d63a4861c6657cbc0f480a3fb1143280  [PR #171 squash-merge of Genesis 1-key BYOK & Paid Pilot — 52 files]  <-- CURRENT origin/main
            └── audit/sophia-zen-design-release-readiness (ZEN 07.3 Release Candidate)
```

---

## 3. Relevant Pull Requests Table

| PR | State | Head Branch | Merge Commit SHA | Merged At (UTC) | Scope Relevance |
|---:|---|---|---|---|---|
| **#171** | `MERGED` | `feat/sophia-genesis-activation-funnel` | `27107209d63a4861c6657cbc0f480a3fb1143280` | `2026-11-14T18:50:34Z` | 1-key BYOK router, `ValidationReceiptCard`, 14d Paid Pilot banner, TikTok compliance fields — harmonized for Dual-Theme + browser CSRF |
| **#155** | `MERGED` | `design/sophia-zen-design-os-v1` | `db28aa614a9bc257cad1a10983eb0df043ab4f8a` | `2026-11-14T15:09:43Z` | Zen Design OS v1.0 dual-theme tokens, nonce CSP, BYOK rate-limit bucket |
| **#168** | `MERGED` | `fix/issue-164-webhook-middleware-hardening` | `d785888a73696065852f0de26f58e53334bcff1e` | `2026-11-14T13:55:29Z` | Telegram payload guards & `webhook` rate-limit bucket — preserved intact |
| **#165** | `MERGED` | `fix/issue-162-inngest-csrf-gate` | `0a76ecd2ffa9455a9e3f7f8bf135017038935f98` | `2026-11-14T13:12:32Z` | Inngest server-to-server CSRF exemption — preserved intact |
| **#163** | `MERGED` | `fix/issues-158-159-webhook-middleware-reachability` | `1cffe446b431201f73bb0c4798ac857221259e30` | `2026-11-14T10:58:51Z` | PayOS IPN & Telegram webhook reachability — preserved intact |
| **#160** | `MERGED` | `fix/youtube-provenance-block-gates` | `3c208445699f086820b422908091f9a0ba1663c4` | `2026-11-14T09:43:56Z` | YouTube synthetic-media provenance block — preserved intact |
| **#167, #161, #156, #151** | `OPEN` | Independent feature branches | — | — | Out of scope for Zen Design OS 07.3; untouched |

---

## 4. Worktree & Stash Preservation Proof (G1)

- All **76 pre-existing worktrees** (including `/Users/macbook/sophia-ai-factory`, `/Users/macbook/.gemini/antigravity/scratch/sophia-zen-design-os-v1`, and all Genesis/BYOK worktrees) and the shared `git stash` stack were left completely untouched.
- Every edit, build, Playwright run, and local commit was executed strictly inside `/Users/macbook/sophia-ai-factory/.claude/worktrees/zen-design-release-readiness-07-3`.
