# Brainstorm Report: E3/E4 Hardening Closure

**Date:** 2026-07-02 | **Project:** Sophia AI Factory | **Status:** ✅ Design Approved

---

## Problem Statement

Enterprise hardening roadmap (E3 OpenTelemetry, E4 BYOK Key Rotation) is 90%+ implemented in code but not closed — OTel production hasn't been activated, BYOK rotation lacks admin UI and auto-rotation schedule. These open items block the roadmap from showing 100% complete and leave production observability gap.

## Scout Findings

- **E3 OTel:** Code wired at `src/seed/telemetry/opentelemetry-setup.ts`, staging verified on sophia-ai-factory-staging (100% sampling, traces confirmed flowing). Blocked only by `HONEYCOMB_API_KEY` secret.
- **E4 BYOK Rotation:** Core implementation complete — `byok-crypto.ts` (AES-GCM, key versioning, dual-decrypt 7d window), Inngest job `key-rotation-reencrypt.ts` (275 LOC), Admin API `POST /api/admin/keys/rotate` (Zod validated, audit logged). Missing: staging test execution, admin UI trigger, auto-rotation cron.

## Evaluated Approaches

Other options considered but deferred: Security Sweep (145 CVEs), Client-Ready UX (nav/login fix), In-App Guide (/guide route). E3/E4 chosen as most impactful for roadmap completeness with smallest scope.

## Recommended Plan: 4 Phases

### Phase 1: OTel Production (~15 min)

- Set `HONEYCOMB_API_KEY` via `wrangler secret put`
- Deploy with 1% samplerate config (already in `.env.production.example`)
- Verify `/api/version` SHA match + traces flow to Honeycomb production dataset
- Update roadmap status to ✅ COMPLETE

### Phase 2: BYOK Rotation Admin UI (~2-3 hr)

New page at `/dashboard/admin/byok-rotation`:

- **RotationButton** — trigger `POST /api/admin/keys/rotate`, confirm dialog, toast result
- **VersionHistoryTable** — reads `key_versions` table, shows version number, created_at, deployed_at, status
- **StatusLog** — recent rotation events from audit log
- Admin tier gate (existing pattern from other admin pages)

### Phase 3: Auto-Rotation Cron (~1 hr)

- Inngest scheduled function: `0 0 1 */3 *` (every 90 days)
- Check `key_versions`: if current version age > 90 days, trigger `key.rotation.requested`
- Audit log at each step
- Notification via existing logger (no new channel)

### Phase 4: Verify + Deploy (~30 min)

- `npm test`: all tests pass (incl key-rotation tests)
- `npm run build`: 0 errors
- Deploy via `npm run deploy:full`
- Verify SHA match at `https://sophia.agencyos.network/api/version`

## Files

| Action | File |
|--------|------|
| Modify | `src/forest/inngest/functions/key-rotation-reencrypt.ts` (add cron handler) |
| Modify | `src/forest/inngest/functions/index.ts` (export new function) |
| Modify | `docs/development-roadmap.md` (update status E3/E4 to complete) |
| Create | `src/app/[locale]/dashboard/admin/byok-rotation/page.tsx` |
| Create | `src/app/[locale]/dashboard/admin/byok-rotation/components/rotation-button.tsx` |
| Create | `src/app/[locale]/dashboard/admin/byok-rotation/components/version-table.tsx` |

## Out of Scope

- Encryption logic changes (already working)
- New notification channels (Slack, Telegram)
- Configurable rotation schedule (cron hardcoded to 90 days)
- Key rotation for publishing tokens (`token-crypto.ts` has separate key)

## Risks & Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Inngest cron misses schedule after CF Workers deploy | Low | Event is idempotent; re-trigger via admin UI |
| OTel 1% samplerate too low for debugging | Low | Can bump via env var without redeploy |
| Admin UI exposes rotation to wrong role | Low | Tier gate enforced (admin only, existing pattern) |

## Next Steps

1. Invoke `/ck:plan` to generate implementation plan with phases
2. Execute phases sequentially (P1 ops → P2 code → P3 code → P4 verify)
3. Close roadmap for E3/E4

## Unresolved Questions

- None — scope and approach agreed.
