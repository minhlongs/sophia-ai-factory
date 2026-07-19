# Code Review — Phase 4G-BYOK Foundations

**Scope:** 7 files (1 migration, 3 lib modules, 3 test files). Foundations only — no caller migration.
**Tests:** 1282 pass (+33). **Build:** exit 0. **LOC:** crypto 105 / store 128 / resolver 38 — tất cả ≤200.

## Score: 9.7/10 — SHIP (auto-approve)

0 Critical · 0 High · 2 Low · 2 Nits

---

## Security Audit (crypto hot-path)

| Concern | Verdict |
|---|---|
| IV uniqueness | ✅ `crypto.getRandomValues(12)` per encrypt; không cache; test `IV randomness` confirm |
| Auth tag | ✅ AES-GCM via SubtleCrypto — tag integral, không bypass được (test `tamper flip byte` + `flip IV` + `rotated master key`) |
| Key confusion | ✅ `importKey` duy nhất, `AES-GCM/256`, `extractable=false`, usages `[encrypt,decrypt]` |
| Malformed input | ✅ `packed.length <= IV_BYTES` guard trước `.slice` (test `too-short payload`) |
| Empty plaintext | ✅ `BYOK_ENCRYPT_EMPTY` throw trước khi tiêu IV entropy |
| Master-key rotation | ✅ Cũ blob throw (AEAD) — behavior đúng với "rotation = mass invalidation" v1 |
| Plaintext hygiene | ✅ Không logging trong 3 module; test assert ciphertext không chứa plaintext bytes |
| SQL injection | ✅ 4/4 query dùng `.prepare(...).bind(...)`; không string-interp user input |
| Timing attacks | ✅ Không cần — GCM decrypt authenticated, 1 code path |

## Findings

### Low-1 — IV collision horizon chưa document (defensive)
`byok-crypto.ts` không nêu ngưỡng an toàn của random 12-byte IV (NIST SP 800-38D: ~2³² encrypts per master key trước khi rủi ro va chạm đáng kể). Volume Sophia hiện tại cực kỳ xa ngưỡng đó, nhưng thêm 1 dòng docstring `// Safe < 2^32 encrypts per master key (NIST SP 800-38D §8.3)` sẽ khóa lại decision cho reviewer tương lai. Non-blocking.

### Low-2 — `getUserApiKey` nuốt cả D1 errors lẫn decrypt errors chung path
Hợp lý theo contract ("all failures → null → fallback to env"), nhưng mất tín hiệu quan sát: master-key invalid (ops error) không phân biệt với row missing (happy path). Đề xuất — non-blocking — 1 metric counter `byok_decrypt_failures_total{reason}` trong lần wire caller đầu tiên. KISS cho v1, ghi nhận debt.

### Nit-1 — Docstring vs test nhẹ nhau về "master key rotation mid-flight"
`resolve-user-api-key.ts` comment nói "rotate master key → blob unreadable" là đúng, test `rotated master key` cũng khóa. OK, chỉ là gợi ý ghi warning vào migration 0011 header (`-- Rotating BYOK_MASTER_KEY invalidates all rows; plan envelope re-encryption for v2.`).

### Nit-2 — `ByokProvider` type không export từ resolver để caller tiện import
`resolve-user-api-key.ts:38` đã re-export `ByokProvider` — tốt. Nhưng `isByokEnabled` thiếu docstring về semantics "strict '1'" (dù test đã cover). Thêm 1 dòng.

## Positive

- **AEAD đúng chuẩn**: GCM bundled tag, không tự build HMAC.
- **`extractable=false` trên CryptoKey** — chặn xuất key plaintext qua debug.
- **Test tamper matrix đầy đủ**: flipped ciphertext byte + flipped IV byte + short payload + key rotation.
- **Round-trip test dùng in-memory captured blob** (store test:78-97) — kiểm tra thật sự encrypt→persist→decrypt chứ không mock vòng ngoài.
- **DRY**: `getD1Raw` từ `resolve-org-id` (verified `resolve-org-id.ts:15`) — nhất quán với Phase 4F.1.
- **Unicode safe**: test `'sk-📡 émoji and açcénts €'` — bắt được bug TextEncoder/Decoder sai.
- **Scope lock tuyệt đối**: 0 callers touched, workflow-stepper + crons giữ env path. Đúng với "foundations only" contract.

## Unresolved Questions

1. **Master-key rotation strategy v2**: envelope encryption (data-key per row encrypted bằng master) vs re-encrypt job? Quyết định trước khi BYOK_ENABLED=1 cho real users.
2. **Admin UI set/clear** (listUserApiKeyProviders đã sẵn cho "future UI") — phase nào land? Nếu chưa có path set key hợp lệ thì `encryptApiKey` chưa có call-site production.
3. **Audit log** cho set/clear/rotate — có cần row trong `signals_events` hay `user_api_key_audit` riêng? Nên scope vào phase wire đầu tiên.

---

**Ship. Ghi Low-1/Low-2 vào backlog, chưa cần block merge.**
