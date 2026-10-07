# SOPHIA AI FACTORY — DATA OWNERSHIP & R2 STORAGE FORENSICS AUDIT
**Document Version:** 1.0.0  
**Scope:** Cloudflare R2, Cloudflare D1, `src/tree/mission/artifact-vault.ts`, `src/forest/inngest/functions/account-delete-finalize-cron.ts`  
**Auditor:** Supreme Codebase Forensic Auditor (Adversarial Zero-Trust)  

---

## 1. Executive Summary

Sophia AI Factory enforces strict customer data ownership, ensuring zero cross-tenant data leakage and clean data disposal upon account termination.

### Data Ownership Verdict: **GREEN (Zero Cross-Tenant Leakage)**

---

## 2. Cloudflare R2 Storage Partitioning

### 2.1 Key Namespacing Schema
All media assets, audio tracks, and exported video blueprints stored in Cloudflare R2 follow a deterministic tenant-isolated path structure:

```
tenants/{tenantId}/missions/{missionId}/assets/{trackType}_{assetId}.{ext}
```

- **Prefix Enforcement:** R2 access functions in `src/tree/mission/artifact-vault.ts` require a valid `tenantId` parameter. Direct key traversal or guessing is impossible without possessing a valid signed retrieval token associated with that specific tenant.
- **Signed URL Expiration:** Public media URLs use temporary time-bound signed URLs with maximum 60-minute TTLs.

### 2.2 Cross-Tenant Key Enumeration Defense
- Database lookup on `artifacts` table always binds `WHERE tenant_id = ?`.
- Even if an attacker guesses the R2 object key of another tenant, API endpoints serving media files verify that the authenticated caller belongs to the tenant matching the key prefix before issuing signed reads.

---

## 3. Account Deletion & Data Purge (GDPR / Data Sovereignty)

### 3.1 Hard Deletion Cascade
When a customer requests account deletion via `account-delete-finalize-cron.ts`:
1. **D1 Metadata Prune:** Deletes records across `user`, `user_profiles`, `user_api_keys`, `missions`, `mission_checkpoints`, `artifacts`, and `subscriptions`.
2. **R2 Asset Disposal:** Initiates batched R2 delete operations for all keys prefixed with `tenants/${tenantId}/`.
3. **KV Cache Purge:** Clears cached auth sessions, quota buckets, and rate-limit counters in Cloudflare KV.

### 3.2 Orphan Asset Mitigation
- Any artifact upload that fails during mission processing is cleaned up by the mission recovery manager.
- Unreferenced R2 objects are swept by periodic storage lifecycle rules.
