# Migration Note — sophia-backend (Python)

**Migrated:** 2026-04-29 from `mekong-cli/apps/sophia-factory/backend/`
**Status:** ⚠️ **LEGACY REFERENCE — NOT INTEGRATED**

---

## Stack Mismatch Warning

Per `~/projects/sophia-ai-factory/CLAUDE.md`, the canonical Sophia stack is:

- Next.js 16 + **D1 (Cloudflare)** + **Better Auth** + **NOWPayments**
- **Polar.sh REJECTED** for this product

This Python backend uses:

- **OpenAI** + **Supabase pgvector** + **FastAPI**

→ **Stack mismatch.** Do NOT wire into the main app without re-architecture.

## Why Migrated Here

- Single-monorepo principle (consolidate all sophia-* apps under one repo)
- Source kept reachable in case business logic from `proposal_generator.py` / `brand_voice.py` needs to be **ported to TypeScript Edge Functions** later

## Decision Pending (User)

1. **Port to TypeScript** + run on Cloudflare Workers (align with canon stack)
2. **Keep as separate Python service** + deploy on different infra (Render/Fly)
3. **Deprecate** entirely (logic re-implemented elsewhere)

## Source Files

- `ai_client.py` (4.5K) — OpenAI wrapper
- `brand_voice.py` (6K) — RAG over brand voice corpus
- `main.py` (11.5K) — FastAPI entrypoint
- `proposal_generator.py` (6.7K) — Core proposal logic
- `requirements.txt` — pip deps

## Backup

`~/plans/260429-2040-sophia-consolidation/backups/sophia-factory-mekong-260429.tar.gz`
sha256: `92bef5520d1d6d366efd480015dce505f0be5d863db461c4d2a04d6e87e5fb7b`
