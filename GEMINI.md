# 📌 GIAO VIỆC CC CLI PROTOCOL (PHẢI ĐỌC TRƯỚC KHI GIAO VIỆC!)

## Two-Call Mandate - PHẢI TÁCH 2 BƯỚC

```
Bước 1: Gửi command (KHÔNG có \n ở cuối)
Bước 2: Gửi Enter riêng (\n)
```

## Workflow Chuẩn ClaudeKit

```
1. /plan:hard "task description"  ← cho task phức tạp
2. /cook <plan_dir>               ← sau khi plan xong
3. npm run build                  ← verify
4. Browser verify                 ← xác thực visual
```

## KHÔNG ĐƯỢC

- ❌ Gửi task dài không dùng /plan:hard
- ❌ Gửi command + Enter cùng 1 lần
- ❌ Tin báo cáo mà không verify

---

## CC CLI PROXY RULE (Added 2026-02-04)

**CC CLI DÙNG PROXY - KHÔNG BLOCK KHI CONTEXT COMPACT!**

- CC CLI đang dùng Antigravity Proxy, KHÔNG phải API hãng trực tiếp
- Khi context compact 0% hoặc "Compacting conversation..." → KHÔNG cần đợi, gửi Enter ngay để kick tiếp tục
- CC CLI tưởng đang call API hãng nên dừng, nhưng Proxy không bị rate limit như vậy
- Luôn gửi input ngay khi thấy CC CLI dừng ở trạng thái idle

## VERIFICATION RULE (Added 2026-02-03)

**KHÔNG TIN BÁO CÁO - PHẢI XÁC THỰC!**

- Khi CC CLI hoặc bất kỳ agent nào báo cáo "hoàn thành", PHẢI tự verify bằng browser/tools
- Kiểm tra production site trực tiếp trước khi báo cáo "giao khách được"
- Đừng bao giờ chỉ tin output text - phải xác thực visual/functional
