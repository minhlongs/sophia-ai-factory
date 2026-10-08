# Social Direct Publisher & OAuth Vault Tech Stack

**Date:** 2026-10-08 | **System:** Sophia AI Factory | **Status:** Approved Architecture

---

## 1. Core Principles
- **BYOK (Bring Your Own Keys):** Client provides platform credentials (Google Cloud, Meta App, TikTok Developer) or connects via multi-tenant OAuth with encrypted token vault.
- **Edge Native:** Runs on Cloudflare Workers / Next.js 16 App Router using Web Crypto API (`crypto.subtle`) for AES-256-GCM and HKDF (RFC 5869).
- **Asynchronous & Resilient:** Multi-step video chunking, container polling, and pacing executed exclusively via Inngest durable workflows.
- **Zero `:any` & Clean Architecture:** 4-layer architecture (`seed` → `tree` → `land` / `forest`). Max 200 LOC per file.

---

## 2. Layer & Component Stack

| Layer | Responsibility | Key Modules |
|---|---|---|
| **`seed` (Core Types & Security)** | Cryptographic vault, DB schemas, platform API types, D1 migrations | `src/seed/security/oauth-token-vault.ts`<br>`src/seed/types/social-publisher-types.ts` |
| **`tree` (Domain Logic & Pacing)** | Pacing policies, jitter calculator, chunking stream calculators, status adapters | `src/tree/social/publisher/platform-adapters.ts`<br>`src/tree/social/publisher/pacing-engine.ts` |
| **`land` (Data Access & DB Relays)** | Platform credentials store, publish job history, token refresh OCC locking | `src/land/social/platform-credentials-store.ts`<br>`src/land/social/publish-job-store.ts` |
| **`forest` (Inngest & Server Actions)** | Multi-platform publishing orchestrator, status polling, Server Actions for UI | `src/forest/inngest/functions/social-direct-publish-job.ts`<br>`src/forest/actions/social-publisher-actions.ts` |

---

## 3. Technology Choices & Protocols

### 3.1 OAuth Cryptographic Vault
- **Encryption:** AES-256-GCM with 96-bit random IV and 128-bit authentication tag.
- **Key Derivation:** HKDF (HMAC-SHA256) with 32-byte per-channel random salt and dynamic info tag: `social-vault:${userId}:${platform}:${channelId}`.
- **Storage Envelope:** D1 SQLite table `oauth_token_vault` with optimistic concurrency locking for atomic refresh.

### 3.2 Platform Publishing Protocols
- **YouTube Shorts:** YouTube Data API v3 Resumable Upload protocol (5 MiB chunks, multiple of 256 KiB). Snippet tagged with `#Shorts` and 9:16 vertical ratio.
- **Meta Instagram Reels:** Instagram Graph API 3-step async container pattern (Public Cloudflare R2 URL → `rupload` status polling → `media_publish`).
- **TikTok Content Posting API v2:** Chunked binary upload (5MB-64MB) with `video.publish` (Direct Post) and `video.upload` (Creator Inbox fallback).

### 3.3 Anti-Detection Pacing & Guardrails
- **Daily Caps:** TikTok (3-5), YouTube Shorts (4-8), Instagram (3-5).
- **Cooldown Interval:** 180 minutes minimum between posts on the same channel.
- **Staggered Jitter:** Base 45 min + Uniform Random(0, 45 min) = 45-90 min cross-platform delay.
- **Fail-Closed Circuit Breaker:** Immediate tripping to `OPEN` on revoked auth; automatic channel hold on copyright/community guideline strikes.

---

## 4. Verification & Testing Strategy
- Unit tests for HKDF key derivation, AES-GCM vault encrypt/decrypt round-trip, and token expiration handling.
- Deterministic simulation of platform chunk slicing and resumable HTTP header assembly.
- Inngest function step mocking with zero fake delays in tests.
- 100% green tests in Vitest with zero lint errors.
