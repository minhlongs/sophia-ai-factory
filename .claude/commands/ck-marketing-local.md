# Marketing Local - Local Business Bundle

> **Binh Pháp Ch.10 地形 (Terrain):** "Biết địa hình, trăm trận trăm thắng - Know terrain, win all battles"

## Skills Activated

- `schema-markup` (LocalBusiness)
- `seo-audit` (local focus)
- `content-strategy` (local content)
- `social-content` (local social)

## Vietnam Market Focus

- Đặc thù thị trường tỉnh/thành
- Zalo/Facebook local groups
- Google My Business setup
- Local SEO keywords

## Syntax

```bash
/marketing-local setup --business="..." --location="..."
/marketing-local gmb --action=[create|optimize|posts]
/marketing-local schema --type=[Restaurant|Store|Service]
/marketing-local seo --audit
/marketing-local social --platforms=[facebook|zalo]
```

## When to Use

- Setup local business marketing
- Optimize Google My Business
- Create local SEO strategy
- Target specific geographic area

## Google My Business Setup

### Basic Information

```markdown
**Business Name:** [Exact legal name]
**Category:**

- Primary: [main category]
- Secondary: [additional categories]

**Address:** [Full address with Phường/Quận/Tỉnh]
**Service Area:** [List of Phường/Quận served]
**Phone:** [Primary hotline]
**Website:** [URL]
**Hours:** [Operating hours]
```

### Description Template

```markdown
**Short (250 chars):**
[Business Name] - [Main service] tại [Location].
[Key USP]. [Price range]. [Service area]. Đặt ngay!

**Long (750 chars):**
[Business Name] chuyên [service] tại [Location] với cam kết [promise].

🍚 [Feature 1]
✅ [Feature 2]
💰 [Pricing info]
🚚 [Delivery info]
📍 Phục vụ: [Service areas]

Thích hợp cho: [Target customers].
[CTA]
```

### GMB Posts Schedule

```markdown
Monday: Menu highlight
Wednesday: Behind-the-scenes
Friday: Promotion/offer
Sunday: Customer testimonial
```

## Local SEO Keywords

### Keyword Patterns

```markdown
[service] + [location]
cơm văn phòng Sa Đéc
ship cơm Đồng Tháp

[service] + gần đây
cơm gần đây
quán ăn gần tôi

[service] + [qualifier]
cơm ngon Sa Đéc
cơm giá rẻ Đồng Tháp
```

### Vietnamese Geo-Keywords

```markdown
# City Level

[service] [thành phố/tỉnh]

# District Level

[service] [quận/phường]

# Neighborhood

[service] gần [landmark]
```

## Local Schema Markup

### Restaurant Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Cơm Ánh Dương",
  "image": "[logo_url]",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[địa chỉ]",
    "addressLocality": "Sa Đéc",
    "addressRegion": "Đồng Tháp",
    "addressCountry": "VN"
  },
  "telephone": "+84-xxx-xxx-xxx",
  "priceRange": "35,000đ - 50,000đ",
  "servesCuisine": "Vietnamese",
  "openingHours": "Mo-Fr 10:00-14:00, 17:00-20:00"
}
```

### LocalBusiness Schema

```json
{
  "@type": "LocalBusiness",
  "name": "[Business Name]",
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": {
      "@type": "GeoCoordinates",
      "latitude": 10.2908,
      "longitude": 105.7585
    },
    "geoRadius": "10000"
  }
}
```

## Local Social Strategy

### Facebook Local

```markdown
**Groups to Join:**

- Ăn vặt [City]
- Hội đồng hương [City]
- [City] Review
- Ship đồ ăn [Province]

**Posting Strategy:**

- Share helpful content (not just promo)
- Respond quickly to comments
- Use local hashtags
```

### Zalo Business

```markdown
**Setup:**

1. Create Zalo Official Account
2. Add menu as catalog
3. Enable order via chat
4. Auto-reply setup

**Engagement:**

- Quick response (< 5 mins)
- Order confirmation
- Delivery updates
- Feedback collection
```

### Local Hashtags

```markdown
#CơmSaĐéc
#QuánĂnĐồngTháp
#ShipCơmSaĐéc
#ĐồngThápFoodDelivery
#SaĐécĂnGì
```

## Local Review Strategy

### Request Template

```
Cảm ơn anh/chị đã ủng hộ Cơm Ánh Dương! 🙏

Nếu hài lòng với bữa ăn, xin anh/chị dành 1 phút để lại review giúp nhà mình trên Google nhé:
[GMB Review Link]

Mỗi review là động lực lớn cho bếp! ❤️
```

### Review Response Templates

```markdown
**5-star:**
Cảm ơn [tên] đã tin tưởng ủng hộ! Rất vui vì [tên] hài lòng.
Hẹn gặp lại [tên] trong những bữa ăn tiếp theo! 🙏

**Negative:**
Xin lỗi [tên] về trải nghiệm chưa tốt.
[Acknowledge issue]. Mình sẽ [fix].
Xin liên hệ [phone] để bếp khắc phục ngay nhé!
```

## Local Competitor Analysis

```bash
/marketing-local analyze --competitor="[competitor name]"
```

Output:

```markdown
| Metric        | Us  | Competitor | Gap    |
| ------------- | --- | ---------- | ------ |
| GMB Rating    | 4.5 | 4.7        | -0.2   |
| Reviews       | 50  | 120        | -70    |
| Response Time | 2h  | 30m        | Slower |
| FB Followers  | 500 | 2000       | -1500  |
```

## Output Format

```markdown
## Local Marketing Setup: [Business Name]

### Location Details

- Address: [full address]
- Coords: [lat, long]
- Service Area: [list of areas]

### GMB Optimization

- [ ] Claim listing
- [ ] Complete all fields
- [ ] Add photos (10+)
- [ ] First 5 reviews
- [ ] Weekly posts started

### Local SEO

- Primary keywords: [list]
- Schema added: [type]
- Citations needed: [list]

### Social Presence

| Platform | Status | Followers | Action |
| -------- | ------ | --------- | ------ |

### Review Strategy

- Current: [X] reviews, [Y] rating
- Target: [X] reviews, [Y] rating
- Timeline: [weeks]
```

## Related Commands

- `/marketing-seo` - Full SEO audit
- `/marketing-copy` - Local content
- `/marketing-growth` - Local growth tactics

## ĐIỀU 50

> Know your terrain → Dominate your area
> Biết địa hình, trăm trận trăm thắng!
