/**
 * Production-Safe Mission Preflight Checklist — Sophia AI Factory (Root Facade).
 *
 * Implements ESCROW-1 & Phase 5: Production-safe preflight verification
 * before a creative mission starts execution.
 *
 * Checks all 7 fail-closed gates:
 * 1. auth: user is authenticated
 * 2. ownership: user belongs to/owns workspace
 * 3. entitlement: user has active tier / sufficient MCU balance
 * 4. credential: BYOK key configured and non-empty
 * 5. capability: provider capability matches required capability (e.g. AI_IMAGE / AI_VIDEO)
 * 6. storage: R2 bucket or storage subsystem is operational
 * 7. queue: Inngest client/queue subsystem is ready
 *
 * Layer: tree (domain reusable logic — depends only on seed and tree).
 *
 * @module tree/mission/preflight-check
 */

export * from './preflight';
