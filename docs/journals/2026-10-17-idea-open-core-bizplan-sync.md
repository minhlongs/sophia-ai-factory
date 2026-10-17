# Technical Journal: Deep Update of `/idea` Pipeline & Company Blueprint to Open-Core Model

**Date:** 2026-10-17  
**Scope:** `.claude/commands/idea.md`, `.agents/skills/idea/SKILL.md`, `.mekong/company.json`, `plans/company-blueprint/*`, `GOAL.md`, `BUSINESS_MODEL.md`  

---

## 1. Context & Problem

Although the Sophia AI Factory codebase was restructured into a dual-licensed Open-Core architecture (`Apache-2.0` Community Core + `Sophia Commercial / FSL-1.1` Managed Cloud & Enterprise `RAAS_LICENSE_KEY`), the `/idea` command, `.agents/skills/idea/SKILL.md` skill, `.mekong/company.json` files, `plans/company-blueprint/plan.md`, `GOAL.md`, and `BUSINESS_MODEL.md` still contained pre-Open-Core closed-source assumptions (and `apps/sophia-ai-factory/.mekong/company.json` + `apps/sophia-ai-factory/plans/company-blueprint/plan.md` were stale June/July snapshots).

---

## 2. Changes Delivered

1. **Command & Skill Synchronization (`.claude/commands/idea.md`, `.agents/skills/idea/SKILL.md`):**
   - Upgraded `/idea` to evaluate ideas across the 3 Open-Core runtime editions (`community`, `cloud`, `enterprise`), PLG GitHub top-of-funnel adoption, and signed HMAC Workspace Portability (`/api/open-core/portability`).
   - Replaced deprecated payment references with canonical **NOWPayments (USDT)** and **PayOS** billing (`BASIC $199/mo`, `PREMIUM $399/mo`, `ENTERPRISE $799/mo`, `MASTER $4,999`).
2. **Company Profile Unification (`.mekong/company.json` & `apps/sophia-ai-factory/.mekong/company.json`):**
   - Unified both root and app-scoped `company.json` files to `2026-10-17` with full `open_core_architecture` metadata (`editions`, `conversion_funnel`, `telemetry_beacon`), Direct Social Publisher capabilities, and honest `$0 MRR / 0 paying customers` baseline.
3. **25-Step Open-Core Blueprint (`plans/company-blueprint/plan.md` & `tasks.md`):**
   - Refreshed all 25 steps across `[Business]`, `[Agentic]`, and `[Governance]` layers to integrate Open-Core dual-licensing, PLG community-to-cloud conversion, secret hygiene (`secretlint` + `gitleaks`), and cryptographic Merkle audit verification.
4. **Constitution & Business Model (`GOAL.md` & `BUSINESS_MODEL.md`):**
   - Reconciled `GOAL.md` with canonical GitHub Actions CI/CD deployment (`.github/workflows/deploy.yml` + `/api/version` SHA parity) and documented the Dual-Funnel Sales & PLG Conversion motion in `BUSINESS_MODEL.md`.
