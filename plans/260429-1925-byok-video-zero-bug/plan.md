# Sophia AI Factory — BYOK Video Auto-Gen Zero-Bug

**Date:** 2026-04-29 19:25 PT
**Mode:** /bootstrap --auto --parallel
**Goal:** Khách tự nhập key → tạo video tự động full flow ZERO BUG → production live
**Domain:** sophia.agencyos.network

## Audit Summary (4 parallel scout reports)

**Critical blockers identified:**

| # | Layer | Blocker | Severity |
|---|-------|---------|----------|
| 1 | Build | 4 TS errors: Sentry `hideSourceMaps` typo + missing `qrcode`/`otpauth` deps | 🔴 CI blocked |
| 2 | BYOK Wiring | `ServiceFactory.getVideoService()` không nhận `userId` → luôn dùng env key | 🔴 BYOK fake |
| 3 | BYOK Wiring | `getHeyGenClient()` singleton hardcode `process.env.HEYGEN_API_KEY` | 🔴 |
| 4 | Setup Wizard | `/api/setup/save` chỉ validate, KHÔNG lưu key vào D1 | 🔴 |
| 5 | Setup Wizard | Step 2 thiếu HeyGen + MuAPI fields (chỉ OpenRouter+ElevenLabs+D-ID) | 🟡 |
| 6 | Cron | `video-status-sync` không có schedule trong `wrangler.jsonc` crons | 🟡 |
| 7 | Storage | Video chỉ link HeyGen URL (expire 30d), R2 copy chưa wire | 🟡 |
| 8 | Deploy | CI stuck 19h, prod behind 5 commits → manual `wrangler deploy` cần | 🔴 |

## Phase Map (with dependencies)

| Phase | Description | Deps | Parallel Group |
|-------|-------------|------|----------------|
| 01 | Fix 4 TS errors + add missing deps (qrcode, otpauth) | — | Foundation |
| 02A | ServiceFactory + clients accept `userId`, async resolve via `resolveUserApiKey` | 01 | Group A |
| 02B | `/api/setup/save` persist keys + add HeyGen/MuAPI to wizard step 2 | 01 | Group A |
| 04 | Add `*/5 * * * *` cron + wire `video-storage-service` to R2 copy | 01 | Group A |
| 03 | Pass `userId` from API routes (`/api/heygen/create-video` etc.) to factory | 02A | Group B |
| 05 | Tests + `tsc --noEmit` + `wrangler deploy` + browser smoke (Rule 13) | 02B+03+04 | Final |

## Key Constraints

- Stack: Next.js 16 + Cloudflare Workers + D1 + Better Auth + NOWPayments
- `BYOK_MASTER_KEY` env required (AES-GCM-256 base64 32-byte)
- Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER (uppercase only)
- Zero `:any`, zero `console.log` in production code
- Polar.sh REJECTED — DO NOT use
- App code lives in `apps/sophia-ai-factory/`
- Manual deploy ONLY (CI stuck, GitHub-side bug)

## Success Criteria (100/100)

- [ ] Build: 0 TS errors, 0 lint blockers, OpenNext build success
- [ ] Tests: 100% pass (1564+ baseline maintained)
- [ ] BYOK wiring: ServiceFactory accepts userId end-to-end
- [ ] Setup Wizard: keys saved to `user_api_keys` after submit
- [ ] Wizard has HeyGen field
- [ ] Cron `video-status-sync` scheduled `*/5 * * * *`
- [ ] R2 video copy active
- [ ] `wrangler deploy` success → production HEAD matches local
- [ ] `/api/health` returns `healthy` (not `degraded`)
- [ ] Browser smoke: signup → wizard with test keys → generate video → see result

## Phase Files

- [phase-01-fix-build-blockers.md](./phase-01-fix-build-blockers.md)
- [phase-02a-byok-service-wiring.md](./phase-02a-byok-service-wiring.md)
- [phase-02b-setup-wizard-persistence.md](./phase-02b-setup-wizard-persistence.md)
- [phase-03-api-route-userid.md](./phase-03-api-route-userid.md)
- [phase-04-cron-and-storage.md](./phase-04-cron-and-storage.md)
- [phase-05-deploy-and-verify.md](./phase-05-deploy-and-verify.md)

## Reports Index

`reports/` will contain agent reports as work completes.

## Open Questions (will resolve in flight)

- `BYOK_MASTER_KEY` đã set trong CF Worker secrets chưa? (nếu chưa → BYOK encryption sẽ fail at runtime)
- HeyGen + ElevenLabs + OpenRouter — wizard có nên test key bằng cách call API endpoint trước khi save?
- Wizard step 2 nên giữ D-ID hay drop (nếu không dùng)?
- R2 public URL — đã set custom domain chưa, hay chỉ dùng `r2.dev` URL?
