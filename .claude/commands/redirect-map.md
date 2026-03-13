---
description: 🔀 Redirect Map — 301 Redirects, URL Rewrites, Migration Mapping
argument-hint: [--check] [--generate]
---

**Think harder** để redirect map: <$ARGUMENTS>

**IMPORTANT:** Redirects PHẢI 301 (permanent), preserve SEO, avoid chains.

## Redirect Map Structure

```json
{
  "redirects": [
    {
      "source": "/old-page",
      "destination": "/new-page",
      "permanent": true,
      "statusCode": 301
    },
    {
      "source": "/blog/:slug",
      "destination": "/articles/:slug",
      "permanent": true,
      "statusCode": 301
    },
    {
      "source": "/products/:category/:id",
      "destination": "/shop/:id",
      "permanent": true,
      "statusCode": 301
    }
  ]
}
```

## Next.js Redirects

```typescript
// next.config.js
module.exports = {
  async redirects() {
    return [
      {
        source: '/old-page',
        destination: '/new-page',
        permanent: true,
      },
      {
        source: '/blog/:slug',
        destination: '/articles/:slug',
        permanent: true,
      },
      {
        source: '/products/:category/:id',
        destination: '/shop/:id',
        permanent: true,
      },
    ];
  },
};
```

## Apache .htaccess

```apache
# === 301 Redirects ===
Redirect 301 /old-page /new-page
Redirect 301 /blog /articles

# === Rewrite Rules ===
RewriteEngine On
RewriteRule ^products/([^/]+)/([0-9]+)$ /shop/$2 [R=301,L]

# === Preserve Query String ===
RewriteRule ^legacy-page$ /new-page [R=301,QSA,L]
```

## Nginx Redirects

```nginx
# === Simple Redirect ===
location = /old-page {
    return 301 /new-page;
}

# === Regex Redirect ===
location ~ ^/products/([^/]+)/([0-9]+)$ {
    return 301 /shop/$2;
}

# === Domain Redirect ===
server {
    listen 80;
    server_name old-domain.com;
    return 301 https://new-domain.com$request_uri;
}
```

## Related Commands

- `/sitemap-gen` — Sitemap generation
- `/robots-check` — Robots.txt validation
- `/seo-audit` — SEO audit
