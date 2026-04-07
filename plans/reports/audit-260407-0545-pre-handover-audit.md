# Pre-Handover Codebase Audit — sophia-ai-factory

**Date:** 2026-04-07 05:45 UTC
**Branch:** claude/audit-codebase-zXeLo
**Scope:** Read-only audit. No fixes applied.

## Summary
Monorepo root `sophia-ai-factory` contains 4 apps under `apps/` (`84tea`, `sophia-ai-factory`, `sophia-proposal`, `sophia-video-bot`) plus a Next.js 15 root project. Structure is messy: root `package.json` is also a Next app ("sophia-ai-factory" v1.0.0) while `apps/sophia-ai-factory/` is another Next app — naming collision. Root `.env.example` still lists deprecated PayPal/Gumroad and a `mekong_lean` DB URL unrelated to Sophia. No real secrets committed (only placeholder `sk-ant-...` in docs/env.example).

---

## P0 — Blockers (fix before handover)

1. **Root/app naming collision.** Root `package.json#name = "sophia-ai-factory"` and `apps/sophia-ai-factory/` both exist as Next.js apps. Non-tech CEO will not know which to run. Decide: promote one, delete/rename other.
2. **Root `.env.example` mismatch with Sophia stack.** Lists PayPal, Gumroad, `mekong_lean` DB, SMTP — contradicts CLAUDE.md (Polar.sh primary, Supabase). Will confuse client during Setup Wizard onboarding. File: `.env.example`.
3. **`.antigravity/` telemetry directory committed.** `./.antigravity/telemetry/events_v2.json` — IDE artifact, should not ship to client. Also `GEMINI.md`, `.agent/`, `.opencode/` leak non-Claude tooling. Clean before handover.
4. **`apps/sophia-video-bot/` is empty scaffold** (only `pyproject.toml`). Either remove or document as placeholder. A handover containing an empty app is unprofessional.
5. **Supabase migrations directory is ambiguous** — root `supabase/migrations/` has 5 files including `migration-stripe-support.sql` (loose naming) mixing with dated `26…` files; unclear which app owns them.

## P1 — Customer Experience

1. **Bilingual docs gap.** Sophia handover rule mandates VI+EN. Root README / HANDOFF unchecked in this audit — verify `apps/sophia-ai-factory/HANDOFF.md`, `CERTIFICATION.md`, `CONTRIBUTING.md` are bilingual. (Not read in this pass.)
2. **Legacy payment providers in env sample** (PayPal/Gumroad/Stripe) while rules say Polar.sh is primary. Client will ask "do I need PayPal?" — strip to Polar-only + optional Stripe.
3. **Stray root screenshots** `checkout-verify-0{1..6}-*.png` inside `apps/sophia-ai-factory/` root — should be in `docs/` or `.gitignore`'d. Clutters handover bundle.
4. **Multiple CLAUDE.md / AGENTS.md / GEMINI.md** across apps — inconsistent agent rules per app. Consolidate or clearly scope.
5. **`plans/` directory has 19 files referencing `antigravity`** — internal dev artifacts shipping to client. Move out of repo or into a `.internal/` folder.
6. **`FULL_MIGRATION.sql`** at `apps/sophia-ai-factory/` root — dangerous to leave top-level; client may run blindly. Move under `supabase/migrations/` with dated name, or docs/.

## P2 — Hygiene

1. `.claude/commands-archived/` still present — tooling noise, exclude from handover tarball.
2. `GEMINI.md` at repo root — non-Claude guidance file; remove for Claude-only handover.
3. `apps/sophia-proposal/` ships both `package.json` and `package-lock.json` while root uses (presumably) a different lockfile. Verify single package manager.
4. `next.config.mjs` at root while apps have their own `next.config.*` — confirm root Next app is intended, otherwise delete root Next setup.
5. `.agent/`, `.opencode/` dirs — alternative agent ecosystems, not needed for client.
6. `apps/84tea/` — unclear relationship to Sophia product. Document or move out.
7. Root `.env.example` variable `RAAS_LICENSE_SECRET` & `mekong_lean` DB refer to a different/older product ("mekong_lean"). Stale.
8. No `.env` or committed secrets detected — ✅ clean. Only placeholder `sk-ant-...` strings in docs (benign).
9. `supabase/migrations/migration-stripe-support.sql` naming inconsistent with dated pattern — rename.
10. `apps/sophia-ai-factory/src/components/settings/sections/api-keys-section.tsx:78` uses literal `'sk-ant-...'` as placeholder — fine (UI hint), no action needed.

---

## Structure Observed
```
./                          ← Next.js 15 app (name: sophia-ai-factory v1.0.0)
├── apps/
│   ├── 84tea/              ← Next.js (unclear relation)
│   ├── sophia-ai-factory/  ← Next.js (duplicate name w/ root)
│   ├── sophia-proposal/    ← Next.js + Cloudflare (open-next.config.ts)
│   └── sophia-video-bot/   ← Python scaffold (empty, only pyproject.toml)
├── supabase/migrations/    ← 5 SQL files, mixed naming
├── plans/                  ← ships internal planning artifacts
├── .antigravity/           ← IDE telemetry (should not ship)
├── .agent/ .opencode/      ← non-Claude tooling
├── .env.example            ← stale (mekong_lean, PayPal)
├── GEMINI.md
└── package.json            ← Next 15.5.14, React 18.3.1, Polar, Supabase, Radix, TanStack
```

## Secret Scan Result
✅ No real API keys, tokens, or DB credentials committed. All `sk-ant-` matches are placeholder strings in docs/env examples/UI hints.

## Top 3 Recommended Fix Order
1. Resolve root vs `apps/sophia-ai-factory/` duplication (P0 #1).
2. Rewrite root `.env.example` to match actual Sophia stack (P0 #2).
3. Purge `.antigravity/`, `GEMINI.md`, `.agent/`, `.opencode/`, `commands-archived/`, and internal `plans/` from handover bundle (P0 #3 + P1 #5 + P2 #1-5).

## Unresolved Questions
1. Is the root Next app intended as the production app, or is `apps/sophia-ai-factory/` the real one?
2. Does client need `84tea` and `sophia-proposal` apps, or only `sophia-ai-factory`?
3. Is `sophia-video-bot` Python scaffold planned for handover or should be removed?
4. Which Supabase project owns the root `supabase/migrations/` — root app or `apps/sophia-ai-factory/`?
5. Should `plans/` and `docs/` directories be included in client handover, or stripped as internal?
6. Is `FULL_MIGRATION.sql` already applied on the production Supabase instance?
