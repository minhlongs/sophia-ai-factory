# Sophia Production Deployment Guide

> Last Updated: 2026-03-12 | Status: GREEN ✅

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Run tests
pnpm vitest run

# 3. Build production
pnpm run build

# 4. Deploy to Cloudflare Pages
pnpm run deploy:cf
```

---

## Environment Setup

### Prerequisites

- Node.js 18+ (`node --version`)
- pnpm (`pnpm --version`)
- Wrangler CLI (`npx wrangler --version`)
- Cloudflare account (free tier)

### Environment Variables

Create `.env.local`:

```bash
# LLM Configuration (optional)
OLLAMA_BASE_URL=http://localhost:11434

# Python path for AGI-SOPS
PYTHON=python3
```

---

## Build Commands

| Command | Description | Output |
|---------|-------------|--------|
| `pnpm dev` | Development server | http://localhost:3000 |
| `pnpm build` | Production build | `.next/` directory |
| `pnpm start` | Production server | http://localhost:3000 |
| `pnpm lint` | ESLint check | Console output |
| `pnpm vitest run` | Run tests | Test results |
| `pnpm deploy:cf` | Deploy to Cloudflare | Production URL |

---

## Deployment Pipeline

### Option 1: Manual Deploy

```bash
# Build first
pnpm run build

# Deploy .next folder to Cloudflare Pages
pnpm run deploy:cf
```

### Option 2: Git Push (Recommended)

```bash
# Push to main branch
git push origin main

# → GitHub Actions triggers
# → Cloudflare Pages auto-deploys
```

### Deploy Verification

After deploy, verify:

1. **Homepage**: https://sophia-ai-factory.vercel.app
2. **Chat**: https://sophia-ai-factory.vercel.app/chat
3. **API**: `curl https://sophia-ai-factory.vercel.app/api/generate`

---

## Production Checklist

Before each deploy:

- [ ] Tests pass: `pnpm vitest run`
- [ ] Build passes: `pnpm run build`
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] .env.local not committed

After deploy:

- [ ] Homepage loads (HTTP 200)
- [ ] All routes respond
- [ ] No console errors
- [ ] API endpoints work

---

## Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next node_modules/.cache

# Reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild
pnpm run build
```

### Tests Fail

```bash
# Run with verbose output
pnpm vitest run --reporter=verbose

# Run specific test file
pnpm vitest run app/lib/utils.test.ts
```

### Deploy Fails

```bash
# Check Wrangler login
npx wrangler whoami

# Check Pages config
npx wrangler pages project list
```

---

## Monitoring

### Production URLs

| Environment | URL | Status |
|-------------|-----|--------|
| Production | https://sophia-ai-factory.vercel.app | ✅ Live |
| Staging | Deploy previews | On PR |

### Health Checks

```bash
# Homepage
curl -I https://sophia-ai-factory.vercel.app

# API endpoint
curl -X POST https://sophia-ai-factory.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```

---

## Rollback

If production issue:

```bash
# 1. Revert last commit
git revert HEAD

# 2. Push to trigger redeploy
git push origin main

# 3. Or use Vercel dashboard to rollback
```

---

## Support

- **Docs:** `/docs` folder
- **Issues:** GitHub Issues
- **Team:** AgencyOS
