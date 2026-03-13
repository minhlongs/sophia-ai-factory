# Sophia Domain Configuration Report

**Date:** 2026-03-12 12:25
**Domain:** sophia.agencyos.network

---

## Current Status

### DNS Configuration ✅

| Record | Value | Status |
|--------|-------|--------|
| A | 172.67.197.42 | ✅ Cloudflare |
| A | 104.21.76.154 | ✅ Cloudflare |

DNS đang trỏ Cloudflare proxy.

### Vercel Assignment ❌

Domain `sophia.agencyos.network` đang được assigned vào **project khác** (không phải sophia-proposal).

---

## Required Actions

### Option 1: Transfer Domain (Recommended)

1. **Vercel Dashboard** → Domains
2. Tìm domain `sophia.agencyos.network`
3. Click **Transfer** → Chọn project `sophia-proposal`
4. Confirm transfer

### Option 2: Re-add Domain

1. **Remove domain** khỏi project hiện tại
2. **Add domain** vào project sophia-proposal:
   ```bash
   npx vercel domains add sophia.agencyos.network
   ```

---

## Vercel DNS Records

Sau khi transfer thành công, cần update DNS:

### Nếu dùng Vercel Nameservers:
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

### Nếu giữ Cloudflare (recommended):
Thêm CNAME record:
```
Type: CNAME
Name: sophia
Value: cname.vercel-dns.com
Proxy: Enabled (Orange cloud)
```

Hoặc A records:
```
Type: A
Name: sophia
Value: 76.76.21.21 (Vercel IP)
```

---

## Verification

Sau khi config xong, verify:

```bash
# Check DNS propagation
nslookup sophia.agencyos.network

# Verify Vercel assignment
npx vercel domains ls

# Test production
curl -I https://sophia.agencyos.network
```

---

## Next Steps

1. **Transfer domain** về sophia-proposal project
2. **Update DNS records** (nếu cần)
3. **Verify SSL certificate** (tự động từ Vercel)
4. **Test production URL**

---

## Unresolved Questions

- Domain hiện đang assigned vào project Vercel nào?
- Ai có quyền admin để transfer domain?
