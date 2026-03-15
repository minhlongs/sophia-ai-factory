# Marketing Constitution - Universal Marketing Command

> **HIẾN PHÁP MARKETING** - Áp dụng cho mọi dự án từ Antigravity IDE

## Cú Pháp

```
/marketing [task] [--location=LOCATION] [--business=BUSINESS_NAME]
```

## Tasks Chính

### 1. Bootstrap Marketing Plan

```
/marketing bootstrap --location="Sa Đéc, Đồng Tháp" --business="Cơm Ánh Dương"
```

Output:

- `plans/marketing/MARKETING_STRATEGY.md`
- `plans/marketing/SOCIAL_MEDIA_CONTENT_CALENDAR.md`
- `plans/marketing/PROMOTIONAL_CAMPAIGNS.md`
- `plans/marketing/MARKETING_ASSETS.md`
- `plans/marketing/SEO_LOCAL_MARKETING.md`
- `plans/marketing/METRICS_AND_KPIS.md`

### 2. Create Posts

```
/marketing posts [platform] [count]
```

Platforms: facebook, zalo, tiktok, instagram
Output: `marketing/content/posts/{platform}_posts.md`

### 3. Google My Business Setup

```
/marketing gmb --location="LOCATION"
```

Output: `marketing/gmb/business_profile.md`

### 4. Loyalty Program

```
/marketing loyalty
```

Output: `marketing/loyalty/discount_codes.md`

### 5. Print Materials

```
/marketing print [menu|flyer|banner]
```

Output: `marketing/print/{type}_text.md`

## Nguyên Tắc Cốt Lõi (ĐIỀU 50 MARKETING)

### 🎯 Mục Tiêu

- Tạo content **READY-TO-USE** (copy-paste ngay)
- Localize đúng **địa điểm cụ thể**
- **Hashtags** phù hợp địa phương
- **SEO keywords** cho local search

### 📍 Localization Rules

```yaml
# PHẢI thay đổi theo địa điểm:
- City/Province name
- Quận → Phường (nếu tỉnh nhỏ)
- Local landmarks
- Local Facebook groups
- TikTok hashtags
- SEO keywords
```

### 📊 KPIs Mặc Định

| Metric         | Month 1 | Month 3 | Month 6 |
| -------------- | ------- | ------- | ------- |
| Orders         | 50-100  | 150-200 | 300+    |
| FB Followers   | 500     | 2,000   | 5,000   |
| Google Reviews | 10      | 30      | 100     |
| Repeat Rate    | 15%     | 25%     | 35%     |

### 💰 Budget Template (VND)

```
Setup (one-time): 10-20M
- Brand design: 3-5M
- Photography: 2-3M
- Website: 5-10M

Monthly: 15-25M
- Facebook Ads: 8-10M
- Zalo Ads: 4-6M
- TikTok: 3-5M
- SEO/Google: 2-4M
```

## Folder Structure Output

```
project/
├── plans/marketing/           # Strategy docs
│   ├── MARKETING_STRATEGY.md
│   ├── SOCIAL_MEDIA_CONTENT_CALENDAR.md
│   ├── PROMOTIONAL_CAMPAIGNS.md
│   ├── MARKETING_ASSETS.md
│   ├── SEO_LOCAL_MARKETING.md
│   └── METRICS_AND_KPIS.md
└── marketing/                 # Executable assets
    ├── content/posts/
    │   └── facebook_posts.md
    ├── gmb/
    │   └── business_profile.md
    ├── loyalty/
    │   └── discount_codes.md
    └── print/
        └── menu_text.md
```

## Quick Examples

### F&B Restaurant

```bash
/marketing bootstrap --location="Sa Đéc, Đồng Tháp" --business="Cơm Ánh Dương"
/marketing posts facebook 10
/marketing gmb
/marketing loyalty
/marketing print menu
```

### SaaS Product

```bash
/marketing bootstrap --location="Global" --business="AgencyOS"
/marketing posts linkedin 10
/marketing seo --keywords="AI agent platform"
```

### E-commerce

```bash
/marketing bootstrap --location="Vietnam" --business="ShopXYZ"
/marketing posts instagram 15
/marketing ads facebook
```

## Integration với Claudekit

Sử dụng cùng các commands khác:

- `/code` để implement
- `/scout` để analyze codebase
- `/git` để commit + push
- `/ship` để deploy

## ĐIỀU 50: MISSION SUCCESS

> Không hỏi, EXECUTE!
> Tạo assets thực tế, không chỉ plan!
> Git commit + push khi hoàn thành!

---

**Created:** 2026-01-31
**Author:** Antigravity AI Team
**Version:** 1.0.0
