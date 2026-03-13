---
description: 🗑️ Cache Clear — App Cache, Browser Cache, CDN Purge
argument-hint: [--all|--app|--browser|--cdn]
---

**Think harder** để cache clear: <$ARGUMENTS>

**IMPORTANT:** Cache clear PHẢI có target, avoid clearing all in production.

## Application Cache

```bash
# === Node.js (npm cache) ===
npm cache clean --force
npm cache verify

# === Yarn Cache ===
yarn cache clean
yarn cache dir

# === Python pip Cache ===
pip cache purge
pip cache info

# === Composer Cache ===
composer clear-cache

# === .next Cache (Next.js) ===
rm -rf .next/cache

# === Build Cache ===
rm -rf node_modules/.cache
rm -rf .eslintcache
rm -rf .jest-cache
```

## Browser Cache (Dev)

```bash
# === Chrome DevTools ===
# Cmd+Shift+R (Mac) - Hard reload
# Ctrl+Shift+R (Win) - Hard reload
# Right-click reload icon - Empty cache and hard reload

# === Clear Service Workers ===
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
localStorage.clear();
sessionStorage.clear();
```

## CDN Purge

```bash
# === Cloudflare Purge ===
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# === Purge Specific URL ===
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://example.com/style.css"]}'

# === Vercel Cache Purge ===
vercel purge
```

## Related Commands

- `/deploy` — Deploy application
- `/monitor` — System monitoring
- `/build` — Build project
