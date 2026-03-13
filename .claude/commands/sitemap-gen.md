---
description: 🗺️ Sitemap Gen — XML Sitemap, Video Sitemap, Auto Crawl
argument-hint: [--domain=example.com] [--max-pages=1000]
---

**Think harder** để sitemap gen: <$ARGUMENTS>

**IMPORTANT:** Sitemap PHẢI valid XML, updated regularly, submitted to search engines.

## Sitemap XML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-03-04</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2026-03-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

## Sitemap Generation Script

```typescript
// scripts/generate-sitemap.ts
import { SitemapStream } from 'sitemap';
import { createWriteStream } from 'fs';

const links = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/about', changefreq: 'monthly', priority: 0.8 },
  { url: '/products', changefreq: 'weekly', priority: 0.9 },
  { url: '/blog', changefreq: 'daily', priority: 0.7 },
];

async function generateSitemap() {
  const stream = new SitemapStream({ hostname: 'https://example.com' });
  const writeStream = createWriteStream('public/sitemap.xml');
  stream.pipe(writeStream);

  links.forEach(link => stream.write(link));
  stream.end();

  console.log('✅ Sitemap generated!');
}

generateSitemap();
```

## Next.js Sitemap

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://example.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://example.com/blog',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];
}
```

## Related Commands

- `/robots-check` — Robots.txt validation
- `/seo-audit` — SEO audit
- `/meta-audit` — Meta tags audit
