# Key Rotation Runbook

**Document ID:** RUN-KEY-ROTATION-001  
**Effective Date:** 2026-06-17  
**Review Date:** 2026-09-17 (Quarterly)  
**Owner:** Platform Ops  
**Scope:** Rotate encryption keys for BYOK credentials and re-encrypt stored secrets safely.

---

## 1. Why This Exists

Key rotation limits the blast radius if an encryption key is ever exposed. This runbook describes how to rotate the master key for Sophia AI Factory, re-encrypt all stored credentials, and verify the process end to end.

**Mục tiêu:** giới hạn rủi ro nếu khóa mã hóa bị lộ, đồng thời bảo đảm tất cả dữ liệu đã mã hóa vẫn đọc được sau khi xoay khóa.

---

## 2. Pre-Rotation Checklist

1. Confirm `BYOK_MASTER_KEY` is set in the current environment.
2. Confirm `key_versions` table exists and contains at least one active version.
3. Confirm the admin user has recent authentication challenge (`admin_challenge_token`).
4. Confirm Inngest is reachable and jobs are not paused.
5. Confirm D1 database is healthy and backups are available.

**Kiểm tra trước khi xoay khóa:**
1. Xác nhận `BYOK_MASTER_KEY` đã được đặt.
2. Xác nhận bảng `key_versions` tồn tại và có ít nhất một phiên bản active.
3. Xác nhận admin đã xác thực gần đây qua `admin_challenge_token`.
4. Xác nhận Inngest hoạt động bình thường.
5. Xác nhận D1 database ổn định và đã có backup.

---

## 3. Rotation Steps

### 3.1 Trigger rotation from admin endpoint

```bash
curl -X POST https://sophia.agencyos.network/api/admin/keys/rotate \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_challenge_token=<token>" \
  -d '{"reason":"scheduled quarterly rotation"}'
```

Expected response:
```json
{
  "success": true,
  "keyVersion": 2,
  "oldVersion": 1,
  "dualDecryptWindowMs": 604800000,
  "message": "Key rotation queued. Re-encryption will run asynchronously."
}
```

### 3.2 Monitor Inngest job

Check the Inngest dashboard for `key.rotation.requested` and confirm:
- Job completed successfully
- `userApiKeys`, `providerCredentials`, `platformCredentials` counts are non-negative
- No failed retries remain

### 3.3 Verify key version table

```sql
SELECT key_type, version, is_active, rotated_at
FROM key_versions
ORDER BY version DESC;
```

Expected:
- The new version is `is_active = 1`
- The old version is `is_active = 0` (set after re-encrypt completes)
- `rotated_at` timestamp populated for old version

### 3.4 Verify credential rows

```sql
SELECT COUNT(*) FROM user_api_keys WHERE key_version = <NEW_VERSION>;
SELECT COUNT(*) FROM user_provider_credentials WHERE key_version = <NEW_VERSION>;
SELECT COUNT(*) FROM platform_credentials WHERE key_version = <NEW_VERSION>;
```

Expected:
- All eligible rows have been updated to the new version after the re-encrypt job completes.
- No rows remain on old version unless explicitly excluded (e.g., null key_version).

---

## 4. Verification

### 4.1 Read-path verification

Pick one known credential and verify it can still be decrypted through the normal application path.

```bash
# Use the application's existing read endpoint or internal admin tool
curl -H "Authorization: Bearer <admin-token>" \
  https://sophia.agencyos.network/api/admin/.../credentials
```

Expected:
- Credential returns successfully
- No auth-tag failures
- No `BYOK_DECRYPT_VERSION_UNSUPPORTED` errors

### 4.2 Log verification

Check logs for:
- `[key-rotation] Starting re-encrypt job`
- `[key-rotation] Re-encrypt job complete`

Expected:
- No error logs from `key-rotation-reencrypt`
- No `D1 database binding not available`
- No `BYOK_MASTER_KEY_MISSING`

### 4.3 Rollback verification

If the new version is not safe, immediately disable the new version and restore the old one:

```sql
UPDATE key_versions
SET is_active = 0
WHERE version = <NEW_VERSION>;

UPDATE key_versions
SET is_active = 1
WHERE version = <OLD_VERSION>;
```

Then re-run the read-path verification.

---

## 5. Rollback

### 5.1 Immediate rollback

1. Stop any further rotation jobs.
2. Set the previous key version back to `is_active = 1`.
3. Set the new version to `is_active = 0`.
4. Re-run credential read-path verification.

### 5.2 If re-encryption partially completed

1. Stop the Inngest job if still running.
2. Identify rows with the new version.
3. Re-encrypt those rows back to the old version using the same re-encryption job logic.
4. Confirm all rows are readable with the old version.

### 5.3 If a credential cannot be decrypted

1. Mark that row as `disabled` or `revoked` depending on the credential type.
2. Notify the user to re-enter the credential.
3. Continue re-encrypting the remaining rows.
4. Do not roll back the whole rotation unless multiple rows fail.

---

## 6. Post-Rotation Checks

- Confirm `key_versions` has exactly one active version.
- Confirm no credentials remain on the old version unless explicitly excluded.
- **Confirm the 7-day dual-decrypt window is enforced** (check `byok-crypto.ts` constant).
- Confirm monitoring has no new errors for 30 minutes.
- Document rotation in `docs/project-changelog.md` with keyVersion and reason.

**Sau khi xoay khóa:**
- Xác nhận chỉ có một phiên bản active trong `key_versions`.
- Xác nhận không còn credential nào ở phiên bản cũ nếu không có lý do ngoại lệ.
- **Xác nhận cửa sổ dual-decrypt 7 ngày được tôn trọng** (kiểm tra constant `DUAL_DECRYPT_WINDOW_MS`).
- Xác nhận monitoring không có lỗi mới trong 30 phút.
