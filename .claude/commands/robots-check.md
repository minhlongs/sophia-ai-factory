---
description: 🤖 Robots Check — Robots.txt Validation, Crawl Rules, Sitemap Reference
argument-hint: [--domain=example.com] [--fix]
---

**Think harder** để robots check: <$ARGUMENTS>

**IMPORTANT:** Robots.txt PHẢI đúng syntax, allow essential pages, reference sitemap.

## Robots.txt Structure

```txt
# === Basic Template ===
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: /*?*
Disallow: /*.pdf$

# === Crawl Delay ===
Crawl-delay: 10

# === Sitemap Location ===
Sitemap: https://example.com/sitemap.xml

# === Google Specific ===
User-agent: Googlebot
Allow: /
Crawl-delay: 5

# === Block Bad Bots ===
User-agent: AhrefsBot
User-agent: SemrushBot
Disallow: /
```

## Validation Commands

```bash
# === Fetch Robots.txt ===
curl https://example.com/robots.txt

# === Validate Syntax ===
npx robots-parser "https://example.com/robots.txt"

# === Test URL Access ===
node -e "
const RobotsParser = require('robots-parser');
const parser = RobotsParser('https://example.com/robots.txt', \`
User-agent: *
Disallow: /admin/
Sitemap: https://example.com/sitemap.xml
\`);
console.log(parser.isAllowed('https://example.com/admin'));
console.log(parser.isAllowed('https://example.com/products'));
"
```

## Next.js Robots

```typescript
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/private/'],
    },
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```

## Related Commands

- `/sitemap-gen` — Sitemap generation
- `/seo-audit` — SEO audit
- `/meta-audit` — Meta tags audit
