# Sophia Deploy Plan - 260312-1148

**Goal:** Deploy Sophia AI Factory to Cloudflare Pages - GREEN production

---

## Execution Strategy (Parallel)

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Build (Sequential - Prerequisite)             │
│  - npm run build                                        │
│  - Verify .next output                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 2: Deploy (Parallel)                             │
│  ┌───────────────┬───────────────┬───────────────┐     │
│  │ Deploy Front  │ Deploy API    │ Deploy Chat   │     │
│  │ (/)           │ (/api/*)      │ (/chat)       │     │
│  └───────────────┴───────────────┴───────────────┘     │
│  - wrangler pages deploy .next                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 3: Verify (Sequential)                           │
│  - Check deployment status                              │
│  - Smoke test all routes                                │
│  - Verify HTTP 200                                      │
└─────────────────────────────────────────────────────────┘
```

---

## File Ownership

| Phase | Agent | Files |
|-------|-------|-------|
| Build | fullstack-developer | `.next/`, `package.json` |
| Deploy | fullstack-developer | `wrangler.json`, Cloudflare API |
| Verify | tester | Production URLs, curl tests |

---

## Deployment Commands

```bash
# Phase 1: Build
npm run build

# Phase 2: Deploy
npx wrangler pages deploy .next --project-name=sophia-proposal --branch=main

# Phase 3: Verify
curl -I https://sophia-proposal.pages.dev
```

---

## Success Criteria

- Build: exit code 0
- Deploy: wrangler exit 0
- Verify: HTTP 200 all routes
- No errors in deployment logs

---

## Rollback Plan

If deploy fails:
1. Check wrangler logs
2. Fix issues
3. Redeploy
4. Or rollback via Cloudflare dashboard
