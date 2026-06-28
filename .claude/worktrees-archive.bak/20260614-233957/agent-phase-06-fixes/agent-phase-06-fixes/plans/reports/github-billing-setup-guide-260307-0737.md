# GitHub Billing Setup - Hướng dẫn khắc phục

**Date:** 2026-03-07
**Issue:** GitHub Actions blocked do failed payments/spending limit
**Impact:** Không thể deploy Phase 5 Analytics Dashboard

---

## 🔴 Hiện trạng

| Check | Status |
|-------|--------|
| Code commit | ✅ `79b9306` (ready) |
| CI/CD Pipeline | ❌ BLOCKED |
| Production | ⚠️ Stale (chưa deploy) |

**Error:**
```
The job was not started because recent account payments have failed
or your spending limit needs to be increased.
```

---

## ✅ Các bước khắc phục (5-10 phút)

### Bước 1: Truy cập Billing Settings

```
URL: https://github.com/organizations/longtho638-jpg/settings/billing
```

Hoặc:
1. Vào GitHub.com
2. Click avatar → Settings
3. Billing & plans → Plans and usage

---

### Bước 2: Kiểm tra & Cập nhật Payment Method

**Billing & plans → Payment information**

1. Click "Add payment method" hoặc "Edit"
2. Thêm thẻ tín dụng/debit:
   - Visa, Mastercard, American Express
   - PayPal (alternative)
3. Đảm bảo thẻ:
   - ✅ Còn hạn
   - ✅ Có đủ funds
   - ✅ Billing address đúng

**Lưu ý:** GitHub charge USD, nếu dùng thẻ VN cần enabled international transactions.

---

### Bước 3: Thanh toán Invoice tồn đọng

**Billing & plans → Invoices**

1. Xem danh sách invoices
2. Tìm invoice có status "Overdue" hoặc "Payment failed"
3. Click "Pay" → Confirm payment
4. Chờ email xác nhận (1-2 phút)

---

### Bước 4: Kiểm tra Spending Limits

**Billing & plans → Billing overview**

Kiểm tra:
- **Spending limit:** Nếu "Reached" → cần increase hoặc wait next cycle
- **GitHub Actions included:** Free tier = 2,000 minutes/tháng
- **Packages storage:** Free 500MB

**Để tăng spending limit:**
1. Scroll xuống "Spending limits"
2. Click "Edit"
3. Increase limit (e.g., $50 → $100)
4. Save changes

---

### Bước 5: Verify GitHub Actions được enable lại

**Sau khi thanh toán xong, chờ 5-10 phút rồi check:**

```bash
# Check CI/CD status
gh run list -L 1

# Expected: Status = "queued" hoặc "in_progress"
```

Hoặc vào GitHub Actions:
```
URL: https://github.com/longtho638-jpg/sophia-ai-factory/actions
```

Nếu thấy "Queued" hoặc "Running" → ✅ SUCCESS!

---

## 🚀 Deploy Phase 5 Analytics

### Option A: CI/CD tự động (Recommended)

Sau khi billing fixed, GitHub Actions tự động re-run:

```bash
# Watch deployment progress
gh run watch

# Or check logs
gh run view --log
```

**Estimated time:** 3-5 phút sau khi billing fixed

---

### Option B: Manual Deploy via Vercel CLI (Workaround)

Nếu cần deploy gấp trong lúc chờ billing fix:

```bash
cd apps/sophia-ai-factory
npx vercel --prod
```

**Lưu ý:** Cách này bypass GitHub Actions, chỉ dùng cho emergency.

---

## ✅ Verify Deployment Success

### 1. Check Production URL

```bash
curl -sI "https://sophia-ai-factory.vercel.app" | head -3
# Expected: HTTP 200
```

### 2. Test Analytics Dashboard

Open browser:
```
https://sophia-ai-factory.vercel.app/dashboard/analytics
```

**Expected:**
- Redirect to login nếu chưa auth
- Dashboard hiển thị nếu đã login (admin)

### 3. Test API Endpoints

```bash
# Usage metrics
curl "https://sophia-ai-factory.vercel.app/api/analytics/usage?start=0&end=9999999999"

# Revenue metrics
curl "https://sophia-ai-factory.vercel.app/api/analytics/revenue?period=last_30_days"

# License metrics
curl "https://sophia-ai-factory.vercel.app/api/analytics/licenses?status=active"
```

**Expected:** JSON response với metrics data

---

## 📊 Post-Deployment Checklist

Sau khi deploy thành công, verify:

- [ ] Analytics dashboard loads correctly
- [ ] Usage charts render (AreaChart, PieChart, BarChart)
- [ ] Date range picker works
- [ ] Tier filter works (admin only)
- [ ] CSV export works (PREMIUM+ tiers)
- [ ] RBAC enforced (customers see own data only)
- [ ] ROI calculator displays metrics
- [ ] All 6 metrics cards show data

---

## 🆘 Troubleshooting

### "Still blocked after payment"

- Wait 10-15 minutes for GitHub to process
- Refresh billing page
- Check email for payment confirmation
- Contact GitHub Support: https://support.github.com/contact/billing

### "Actions minutes exhausted"

- Wait for next billing cycle (monthly reset)
- Upgrade to GitHub Pro ($4/month = 3,000 minutes)
- Purchase additional minutes

### "Vercel deploy failed"

- Check Vercel dashboard: https://vercel.com/dashboard
- Review build logs
- Ensure env vars synced (INTERNAL_WEBHOOK_SECRET, CRON_SECRET, etc.)

---

## 📞 Support Resources

- GitHub Billing Docs: https://docs.github.com/en/billing
- Vercel Deploy Docs: https://vercel.com/docs/deployments
- Project Reports: `plans/reports/phase5-analytics-final-report-260307-0605.md`

---

**Estimated Total Time:** 10-15 phút (bao gồm payment processing)

**After fixed:** Phase 5 Analytics sẽ auto-deploy trong 3-5 phút! 🚀
