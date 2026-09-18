# DATA OWNERSHIP, RETENTION & R2 FORENSIC AUDIT

**Target:** Sophia AI Factory Data Lifecycle, Deletion Cascades & R2 Storage  
**Audit Standard:** Code is the authority. Tests are evidence.  
**Audit Date:** 2026-09-18  

---

## 1. Executive Summary

| Data Boundary | Verdict | Implementation / Safeguard |
|---|:---:|---|
| **Account Deletion Cascade** | **GREEN** | `cascadeDeleteTenant()` (`src/land/account/cascade-delete.ts`) cleans D1 rows across 14 tables. |
| **Org Resolution in Deletion** | **GREEN** | Uses canonical `resolveOrgId(userId, db)` rather than raw SQL table guesses. |
| **R2 Storage Purge** | **GREEN** | `collectTenantR2Keys()` aggregates all audio, visual, and final video keys and purges them from R2 buckets before dropping D1 rows. |
| **Cross-Tenant Storage Access** | **GREEN** | Media artifact storage keys are isolated per tenant or accessed via time-limited signed URLs. |

---

## 2. Customer Deletion Lifecycle Trace

```
User Deletion Request
   │
   ▼
1. Fetch orgId via canonical resolveOrgId(userId, db)
   │
   ▼
2. collectTenantR2Keys(db, tenantId)
   ├─ Queries video_jobs (audio_r2_key, visual_r2_key, final_r2_key)
   ├─ Queries videos (r2_key)
   └─ Deduplicates via Set<string>
   │
   ▼
3. Delete R2 Objects via Worker R2 binding (VIDEO_BUCKET)
   │
   ▼
4. D1 Cascade Deletion Transaction:
   ├─ DELETE FROM video_jobs WHERE tenant_id = ?
   ├─ DELETE FROM videos WHERE user_id = ? OR tenant_id = ?
   ├─ DELETE FROM publishing_jobs WHERE tenant_id = ?
   ├─ DELETE FROM telegram_paired_chats WHERE user_id = ?
   ├─ DELETE FROM user_provider_credentials WHERE user_id = ?
   ├─ DELETE FROM subscriptions WHERE org_id = ?
   ├─ DELETE FROM user_profiles WHERE user_id = ?
   ├─ DELETE FROM session WHERE userId = ?
   ├─ DELETE FROM account WHERE userId = ?
   └─ DELETE FROM user WHERE id = ?
```

---

## 3. Data Isolation Invariants

1. **Orphan Storage Prevention:** R2 keys are gathered before D1 rows are deleted. If R2 deletion fails, errors are logged with key details to prevent silent untracked accumulation.
2. **Object Key Guessing Defense:** R2 keys include cryptographic randomness (UUID v4 or random 16-byte hex), preventing unauthenticated sequential enumeration.
