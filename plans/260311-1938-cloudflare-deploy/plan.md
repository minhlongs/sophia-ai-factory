# Plan: Deploy Sophia AI Factory to Cloudflare Pages

**Date:** 2026-03-11
**Priority:** HIGH
**Status:** READY

---

## Phases (Parallel Execution)

| Phase | Task | Parallel |
|-------|------|----------|
| 1 | Install Wrangler CLI | ✅ |
| 2 | Cloudflare Dashboard Setup | ✅ |
| 3 | GitHub Connection | ✅ |
| 4 | Deploy & Verify | ✅ |

---

## Phase 1: Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

---

## Phase 2: Cloudflare Dashboard Setup

1. Go to https://dash.cloudflare.com/?to=/:account/pages
2. Click "Create a project"
3. Project name: `sophia-proposal`

---

## Phase 3: GitHub Connection

1. Connect GitHub: `longtho638-jpg/mekong-cli`
2. Root directory: `apps/sophia-proposal`
3. Build command: `pnpm build`
4. Build output: `.next`

---

## Phase 4: Deploy & Verify

1. Add environment variables
2. Trigger first deploy
3. Verify all pages
4. Add custom domain (optional)

---

## Success Criteria

- [ ] Cloudflare Pages project created
- [ ] GitHub connected
- [ ] First deploy successful
- [ ] All pages accessible
- [ ] Custom domain configured (optional)

---

*Ready to execute.*
