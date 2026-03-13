# Deployment Map - Mekong CLI Apps

**Generated:** 2026-03-12 13:52
**Scan Scope:** `/apps/` directory

---

## Summary

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Cloudflare Native | 7 | 21% |
| ⚠️ Vercel (needs migration) | 2 | 6% |
| ❓ No Deploy Config | 24 | 73% |
| **Total** | **33** | 100% |

---

## Apps Detail

### ✅ Cloudflare Native (Ready)

| App Name | Deploy Target | Deploy Script | Status |
|----------|---------------|---------------|--------|
| **algo-trader** | Cloudflare Workers | `npm run build:worker` → `wrangler dev` | ✅ Ready |
| **anima119** | Cloudflare Pages | `npm run deploy` → `wrangler pages deploy` | ✅ Ready |
| **apex-os** | Cloudflare Workers | `wrangler.toml` present | ✅ Ready |
| **com-anh-duong-10x** | Cloudflare Pages | `npm run deploy` → `wrangler pages deploy` | ✅ Ready |
| **openclaw-worker** | Cloudflare Workers | `npm run deploy` → `wrangler deploy` | ✅ Ready |
| **raas-gateway** | Cloudflare Workers | `npm run deploy` → `wrangler deploy` | ✅ Ready |
| **sophia-proposal** | Cloudflare Pages | `npm run deploy:cf` → `wrangler pages deploy` | ✅ **LIVE** |
| **well** | Cloudflare Workers | `wrangler.toml` present | ✅ Ready |

### ⚠️ Vercel (Needs Migration)

| App Name | Current Config | Deploy Script | Action Required |
|----------|----------------|---------------|-----------------|
| **well/admin-panel** | `vercel.json` | None detected | ⚠️ Migrate to CF Pages |

### ❓ No Deploy Config (24 apps)

| App Name | Framework | Recommended Action |
|----------|-----------|-------------------|
| admin | Unknown | Add wrangler config |
| agencyos-landing | Unknown | Add wrangler config |
| agencyos-web | Unknown | Add wrangler config |
| agi-sops | Python | N/A (Python app) |
| analytics | Unknown | Add wrangler config |
| antigravity-cli | CLI | N/A (CLI tool) |
| api | Unknown | Add wrangler config |
| dashboard | Unknown | Add wrangler config |
| developers | Unknown | Add wrangler config |
| docs | Unknown | Static site |
| engine | Unknown | Add wrangler config |
| gemini-proxy-clone | Unknown | Add wrangler config |
| landing | Unknown | Add wrangler config |
| project | Unknown | Add wrangler config |
| raas-demo | Unknown | Add wrangler config |
| raas-gateway-cli | CLI | N/A (CLI tool) |
| sa-dec-flower-hunt | Unknown | Add wrangler config |
| saas-dashboard | Unknown | Add wrangler config |
| starter-template | Unknown | Template app |
| tasks | Unknown | Add wrangler config |
| vibe-coding-cafe | Unknown | Add wrangler config |
| web | Unknown | Add wrangler config |
| worker | Unknown | Add wrangler config |

---

## Migration Actions

### Priority 1: Vercel → Cloudflare

**well/admin-panel**
```bash
cd apps/well/admin-panel
# 1. Add wrangler.toml
# 2. Update package.json:
#    "deploy": "npm run build && npx wrangler pages deploy dist"
# 3. Remove vercel.json
```

### Priority 2: Add Deploy Configs

Recommended for active projects:
1. **agencyos-web** - Main product
2. **agencyos-landing** - Marketing site
3. **dashboard** - Admin interface
4. **api** - Backend services

---

## Deployment Standards

### Cloudflare Pages (Frontend)

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "npm run build && npx wrangler pages deploy dist --project-name=APP_NAME"
  }
}
```

### Cloudflare Workers (Backend/API)

```toml
# wrangler.toml
name = "APP_NAME"
main = "src/index.ts"
compatibility_date = "2024-01-01"
```

```json
{
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  }
}
```

---

## Notes

- **sophia-proposal**: Deployed to Cloudflare Pages ✅
  - URL: https://sophia.agencyos.network
  - Static export (API routes disabled)

- **com-anh-duong-10x**: Already using Cloudflare Pages ✅
  - Deploy script: `npx wrangler pages deploy dist`

- **anima119**: Using OpenNext.js for CF ✅
  - Deploy script: `npx opennextjs-cloudflare`

---

## Unresolved Questions

1. Should we migrate all 24 "No Deploy Config" apps to Cloudflare?
2. Which apps are actively used vs deprecated?
3. Should we create a standard `wrangler.toml` template for new apps?
