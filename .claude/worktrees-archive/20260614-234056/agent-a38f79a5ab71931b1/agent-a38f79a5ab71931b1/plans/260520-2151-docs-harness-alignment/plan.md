# Docs Harness Alignment — Sophia AI Factory

**Created:** 2026-05-20 21:51
**Status:** BACKFILL IN PROGRESS (canonical docs patched; remaining infra/history drift tracked)
**Owner:** Long Tho

---

## 1. Locked Goal

Re-align `docs/` to match the CAAMP harness installed via `AGENTS.md`, while reconciling silent codebase ↔ docs drift accumulated since 2026-03-27.

### Why now
- AGENTS.md harness was just installed → contract says canonical-5 docs live at `docs/` root.
- Drift suspicion: build/tests pass GREEN but several root docs untouched since Mar 27 while production shipped CF-direct deploy, NOWPayments, tier consolidation, etc. on 2026-05-03 → 2026-05-17.
- Dual-docs hazard discovered: `apps/sophia-ai-factory/docs/` (30+ files, more current) duplicates and partially contradicts root `docs/` (40+ files). One must become source of truth.

### Definition of Done
1. **Canonical-5 at `docs/` root** (project-overview-pdr, code-standards, codebase-summary, design-guidelines, system-architecture) reflect shipped reality, verified line-by-cluster against code.
2. **Domain subfolders** under `docs/`: `handover/`, `runbooks/`, `ops/`, `postmortems/`, `launch/`, `integration/`, `archive/`. All 35+ non-canonical files relocated.
3. **Stale-by-mtime + dead-by-drift** files moved to `docs/archive/` with a one-line reason stub in each.
4. **Dual-docs reconciled:** explicit policy on whether `apps/sophia-ai-factory/docs/` keeps app-internal SOPs only, or merges into root.
5. **Drift report per cluster** committed under `plans/260520-2151-docs-harness-alignment/research/`.
6. **No file moved or rewritten** until this plan is approved by Long.

---

## 2. Non-Goals
- Not rewriting code to match docs.
- Not touching `plans/` history.
- Not consolidating with other projects' docs (mekong, agencyos, etc.).
- Not adding new doc surfaces (gap-fill is a separate pass).

---

## 3. Doc Clusters & Audit Assignments

| Cluster | Root files | App-level overlap | Auditor |
|---|---|---|---|
| **A. Architecture & Build** | project-overview-pdr, system-architecture (42KB), codebase-summary (33KB), code-standards (19KB), design-guidelines (Mar 27 STALE), tech-debt (Mar 27 STALE), raas-license-gating (Mar 27 STALE) | ai-architecture-2026-update, code-standards-advanced-patterns, code-standards | researcher-A |
| **B. Handover / Client-facing** | handover/, client-handover-sop, customer-handover-runbook, credentials-handover, handover-documentation-index, sophia-factory-readme, faq, getting-started, pricing-and-tiers, troubleshooting, user-guide-visual, user-flow, user-journey-visual-guide, ui-flow-diagram | CLIENT-HANDOVER-PACKAGE-v2, contributor-handover, handover/ | researcher-B |
| **C. Ops / Runbooks** | admin-ops/, observability-runbook, secret-rotation-runbook, disaster-recovery, sophia-activation-runbook, support-escalation, telegram-bot-guide, telegram-bot-setup, webhook-configuration-guide, sophia-local-mode-*, cloud-infrastructure | dev-sops, dr-drill-260518, escalation-contacts, gitlab-migration-runbook, infra-hardening, ingestion-service, load-testing-runbook, nowpayments-configuration, GO-LIVE-DEPLOYMENT-GUIDE, deployment-checklist, deployment-guide | researcher-C |
| **D. Postmortems, Launch, Roadmap** | postmortems/, postmortem-template, launch/, project-changelog (201KB), development-roadmap (50KB) | known-issues, legacy/ | researcher-D |
| **E. Integration & ADRs** | sophia-mekong-integration, architecture-decisions/ | compliance/, migrations/, a11y-baseline, asvs-l2-checklist, load-test-260518 | researcher-E |

---

## 4. Phases

- **Phase 0 — Research swarm (IN PROGRESS):** 5 parallel auditors produce drift reports → `research/cluster-{A..E}-drift.md`.
- **Phase 1 — Synthesis & approval (NEXT):** I read all 5 reports, finalize move-list + rewrite-list + archive-list, ship for Long approval.
- **Phase 2 — Reshape:** Execute `git mv` into domain subfolders. One commit. No content changes.
- **Phase 3 — Rewrite canonical-5:** Update each of the 5 root docs from drift findings. One commit per file.
- **Phase 4 — Archive + stubs:** Move stale to `archive/` with reason stub. One commit.
- **Phase 5 — Dual-docs decision:** Apply the policy from Phase 1. Either merge app-docs into root, or write `apps/sophia-ai-factory/docs/README.md` declaring its scope.
- **Phase 6 — Verify:** `pnpm run build` GREEN, internal links resolve, AGENTS.md references match files on disk.

---

## 5. Success Criteria
- `ls docs/*.md` returns exactly the canonical-5 (plus `README.md` index).
- `find docs -maxdepth 2 -name "*.md" -mtime +60` returns 0 (or only `archive/`).
- Every Mar 27 file is either rewritten or in `archive/` with reason.
- Dual-docs policy documented in root `docs/README.md`.
- This plan's checklist all `[x]`.

---

## 6. Risk & Mitigations
- **R1:** Moving docs breaks internal links/cross-references → Phase 2 includes `grep -r "docs/<oldpath>"` sweep.
- **R2:** Auditor reports contradict each other on dual-docs source of truth → escalate to Long at Phase 1 gate.
- **R3:** project-changelog.md (201KB) and development-roadmap.md (50KB) are too large to rewrite → keep as-is in `docs/`; only verify last-30-days entries match git log.

---

## 7. Open Questions (for Phase 1 approval gate)
- Q1: `apps/sophia-ai-factory/docs/` — merge into root, or scope-restrict to app-internal SOPs?
- Q2: Canonical-5 includes `design-guidelines.md` — Sophia has minimal UI surface; keep or replace with `deployment-guide.md`?
- Q3: project-changelog.md (201KB) — split by quarter into `docs/changelog/{2026-Q1,Q2,...}.md`?

---

# APPENDIX — Phase 1 Synthesis (APPROVAL GATE)

**Status:** AWAITING LONG APPROVAL. No file touched until each section below is ACK.
**Inputs:** 5 cluster drift reports (research/cluster-{A,B,C,D,E}-*.md).

## A. Consolidated Move-List (Phase 2 reshape)

Single `git mv` commit, no content changes. Target shape:

```
docs/
├── README.md                       # NEW — index + dual-docs policy
├── project-overview-pdr.md         # canonical-5 (rewritten in Phase 3)
├── code-standards.md               # canonical-5
├── codebase-summary.md             # canonical-5
├── design-guidelines.md            # canonical-5 (REPLACED by app version — see Q2)
├── system-architecture.md          # canonical-5
├── handover/                       # client-facing (bilingual)
│   ├── client-handover-sop.md
│   ├── customer-handover-runbook.md
│   ├── credentials-handover.md
│   ├── handover-documentation-index.md
│   ├── sophia-factory-readme.md
│   ├── faq.md
│   ├── getting-started.md
│   ├── pricing-and-tiers.md
│   ├── troubleshooting.md
│   ├── user-guide-visual.md
│   ├── user-flow.md
│   ├── user-journey-visual-guide.md
│   └── ui-flow-diagram.md
├── runbooks/                       # operator playbooks
│   ├── observability-runbook.md
│   ├── secret-rotation-runbook.md
│   ├── disaster-recovery.md        # REWRITE L36 (git push → CF-direct)
│   ├── sophia-activation-runbook.md# REWRITE Phase 1-5 (dead refs)
│   ├── support-escalation.md
│   ├── telegram-bot-guide.md       # RECONCILE cmd-list with setup
│   ├── telegram-bot-setup.md
│   └── webhook-configuration-guide.md  # ARCHIVE (Stripe/Polar legacy)
├── ops/
│   ├── admin-ops/                  # existing subdir → move as-is
│   └── cloud-infrastructure.md
├── postmortems/                    # rename → incidents/ ? (Q6)
│   ├── postmortem-template.md
│   └── (existing pm files)
├── launches/
│   └── _drafts/                    # current launch/ is DRAFT-only
├── changelog/                      # Q3 split
│   ├── 2026-Q2.md
│   ├── 2026-Q1.md
│   └── archive/
├── roadmap/
│   └── development-roadmap.md
├── integration/
│   └── sophia-mekong-integration.md
├── adrs/                           # was architecture-decisions/
│   ├── README.md                   # NEW — index (0001-0007)
│   └── 0007-*.md
└── archive/                        # see C below
    └── (stale files w/ reason stub)
```

App-side (`apps/sophia-ai-factory/docs/`) keeps operator/engineering files unchanged pending Q1:
- compliance/, migrations/, legacy/, known-issues.md, dev-sops.md, dr-drill-260518.md, escalation-contacts.md, gitlab-migration-runbook.md, infra-hardening.md, ingestion-service.md, load-testing-runbook.md, nowpayments-configuration.md, GO-LIVE-DEPLOYMENT-GUIDE.md, deployment-checklist.md, deployment-guide.md, a11y-baseline.md, asvs-l2-checklist.md, load-test-260518.md, CLIENT-HANDOVER-PACKAGE-v2.md, contributor-handover.md, handover/

## B. Canonical-5 Rewrite-List (Phase 3)

One commit per file. Drift findings sourced from cluster reports.

| File | Drift fix |
|---|---|
| `project-overview-pdr.md` | Tier enum BASIC/PREMIUM/ENTERPRISE/MASTER (uppercase); add CF-direct deploy doctrine; NOWPayments primary + PayOS backup (not Polar); ASVS-L2 status 94%. |
| `codebase-summary.md` | Add seed/tree/forest/land 4-layer; add CF-direct `npm run deploy:full` flow; 117 migrations as of 2026-05-19; remove GH-Actions references. |
| `design-guidelines.md` | REPLACE Mar 27 Deep Space draft with shipped Geist token set from app version (or DEMOTE — Q2). |
| `system-architecture.md` | Add CF-direct deploy gates (build → wrangler → curl SHA); add cron Bearer auth path; tier-gate matrix; doctrine ceiling 87.5/100 note. |
| `code-standards.md` | Minimal touch: pin canonical import paths from `.claude/rules/development-rules.md`; banned imports list; no `:any`. |

## C. Archive-List (Phase 4)

Each → `docs/archive/` with one-line `_REASON.md` stub.

- `tech-debt.md` (Mar 27, content closed by 2026-05 consolidation)
- `raas-license-gating.md` (Mar 27, never shipped — license gating not in roadmap)
- `ai-architecture-2026-update.md` (Feb 7, superseded by codebase-summary rewrite)
- `webhook-configuration-guide.md` (Stripe/Polar legacy — Sophia uses NOWPayments)
- `CLIENT-HANDOVER-PACKAGE.md` v1 (deprecated by v2 in app/)
- `sophia-local-mode-*.md` (33-day stale — confirm dead vs alive per Q4)
- Original root `design-guidelines.md` if Q2 = replace with app version

## D. Dual-Docs Policy (Phase 5)

Proposed split (subject to Q1):

- **Root `docs/`** = customer-facing + cross-project layer (handover, runbooks operators must read, postmortems, ADRs, changelog, roadmap, integration). Bilingual VI-EN where customer-facing.
- **App `apps/sophia-ai-factory/docs/`** = engineering-internal layer (compliance evidence, migration phase notes, load-test raw data, dev-sops, GO-LIVE checklist). EN only.
- Each gets a `README.md` declaring scope so future contributors don't dual-write.

## E. Approval-Gate Questions

| # | Question | Recommended |
|---|---|---|
| Q1 | Merge app/docs into root, or keep app/docs as engineering-internal layer? | **Keep split** (cleaner separation, app docs already lean operator) |
| Q2 | Canonical-5 includes `design-guidelines.md` — replace with `deployment-guide.md` (CF-direct deploy is higher-value)? | **Replace** — Sophia UI surface tiny; deploy doctrine high-value |
| Q3 | Split `project-changelog.md` (201KB) by quarter into `docs/changelog/`? | **Yes** — load time + LLM context win |
| Q4 | `sophia-local-mode-*.md` — alive feature or archive? | Need fact: is local-mode still demo-ed to clients? |
| Q5 | `support@mekongmind.com` hardcoded in 18 files (Cluster E) — open refactor task now or backlog? | **Backlog** — separate from docs alignment scope |
| Q6 | Rename `postmortems/` → `incidents/` to match SRE convention? | **Optional** — defer if low value |

---

**NEXT ACTION:** Long answers Q1-Q6. On ACK, Phase 2 reshape begins.

---

# APPENDIX 2 — Execution Decisions (post-approval 2026-05-20)

**Approvals:** Q1 keep split · Q2 replace design-guidelines→deployment-guide · Q3 split changelog by quarter · Q4–Q6 defer.

**Scope adjustment for Phase 2 (reshape):**
Grep showed 100+ live cross-references to `docs/<file>.md` paths from `.opencode/agents/*.md`, `.claude/commands/*.md`, `.opencode/skills/*/SKILL.md`, app code, and READMEs. A bulk `git mv` reshape would cascade-break templates that are not in scope for this pass.

**Adopted execution (KISS):**
- **Phase 2 SOFT:** No bulk `git mv`. Instead write `docs/README.md` as a **domain-grouped index** giving the virtual structure (handover/, runbooks/, ops/, etc.) by listing current flat-file paths under each domain heading. Future moves can happen per-file as cross-refs are updated.
- **Phase 3:** Rewrite canonical-5 in place. Promote `deployment-guide.md` (NEW at root, sourced from app version) into canonical-5; demote `design-guidelines.md` → archive.
- **Phase 4:** Physically move 7 stale files → `docs/archive/` with `_REASON.md` stubs. These have low/zero live cross-refs.
- **Phase 5:** Write `apps/sophia-ai-factory/docs/README.md` declaring engineering-internal scope.
- **Phase 6:** `pnpm build` (in app dir) GREEN + `grep` link sweep for the 7 moved files only.

**Reason:** The harness contract is satisfied by canonical-5 being correct + a docs/README.md index. Physical relocation is incremental tech-debt cleanup that can ship per-file later without blocking AGENTS.md alignment.

---

# APPENDIX 3 — 2026-05-21 Continuation Pass

**Status:** Current-state backfill pass complete; broader docs harness cleanup remains active. See `reports/260521-docs-backfill-current-state.md`.

**Completed this pass:**
- Re-read project/app rules and README before edits.
- Verified current app package/deploy/backup/migration facts from code.
- Patched public/root docs that still described live GitHub Actions auto-deploy, Next.js 15, stale test counts, or GitHub Actions backup as current behavior.
- Deep-refreshed `docs/cloud-infrastructure.md` from current `wrangler.toml`, D1/R2 bindings, backup route, and CF-direct deploy flow.
- Patched operator runbooks that still treated GitHub Actions secrets/rollback as canonical instead of optional auxiliary workflows.
- Updated cron escalation docs from the current `wrangler.toml` + `scripts/inject-scheduled-handler.mjs` mapping and recorded unmapped cron-pattern drift.
- Marked historical migration docs as non-current execution guides where they referenced missing artifacts and old Vercel/GitHub deploy flows.
- Aligned customer-facing pricing, FAQ, handover, terms, refund, welcome-email, and ROI guide tier tables to `UNIFIED_TIERS`.
- Patched generated handover tier content so Master billing is one-time/lifetime and prices/billing terms derive from `UNIFIED_TIERS`.
- Ran `git diff --check`, focused internal-link check, and stale-phrase sweeps on touched docs.
- Ran focused handover generator tests and app type-check after the generator patch.
- Optimized `.claude/scripts/validate-docs.cjs`; full current docs validation now completes in warn-only mode.

**Still open:**
- Decide whether historical launch copy mentioning Stripe Connect remains history or moves to archive.
- Decide whether to fix the unmapped `wrangler.toml` cron patterns (`error-digest`, `heartbeat`, `llm-cache-purge`, `wallet-rebuild`, `affiliate-scout`) in code or document them as intentionally external.
- Decide whether docs validator warnings from changelog/history docs should be filtered by severity or moved to archive-only validation.
