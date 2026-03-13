# Vercel References Scan Report

**Generated:** 2026-03-12 14:05
**Scan Scope:** `apps/`, `packages/`

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| **Vercel in node_modules** | 100+ | ✅ No action needed (Next.js dependency) |
| **Vercel config files** | 0 | ✅ None in active projects |
| **.env.vercel-check files** | 0 | ✅ None found |
| **Vercel deploy scripts** | 0 | ✅ Already migrated |

---

## Findings

### 1. Node Modules (Next.js Dependencies)

Vercel references found in `node_modules` là expected behavior:

```
apps/*/node_modules/next/dist/compiled/@vercel/nft/
apps/*/node_modules/next/dist/compiled/@vercel/og/
apps/*/node_modules/next/dist/compiled/@vercel/routing-utils/
apps/*/node_modules/eslint-config-next/package.json (has vercel dep)
```

**Action:** ❌ None required - these are Next.js internal dependencies

### 2. Active Projects Status

| App | Deploy Target | Status |
|-----|---------------|--------|
| sophia-proposal | Cloudflare Pages | ✅ Migrated |
| com-anh-duong-10x | Cloudflare Pages | ✅ Already CF |
| anima119 | Cloudflare Pages | ✅ Already CF |
| algo-trader | Cloudflare Workers | ✅ Already CF |
| openclaw-worker | Cloudflare Workers | ✅ Already CF |
| raas-gateway | Cloudflare Workers | ✅ Already CF |
| well | Cloudflare Workers | ✅ Already CF |
| apex-os | Cloudflare Workers | ✅ Already CF |

### 3. Vercel Config Files Found

| Path | Status |
|------|--------|
| `.archive/newsletter-saas/vercel.json` | 🗄️ Archived (no action) |
| `mekong/infra/templates/vercel-app/vercel.json` | 📦 Template (keep for reference) |
| `.claude/worktrees/*/vercel.json` | 🌳 Git worktree artifacts (auto-cleanup) |

### 4. Environment Files

- **No `.env.vercel*` files found** ✅
- `.env.production` files exist but contain app config (not Vercel-specific)

---

## Conclusion

**🎉 GOOD NEWS: No migration needed!**

Tất cả các apps trong monorepo đã được cấu hình deploy sang Cloudflare:

1. **Next.js apps** dùng `@vercel/*` packages → Đây là dependencies chính thức của Next.js, **KHÔNG CẦN THAY ĐỔI**

2. **Deploy scripts** → Tất cả đã dùng `wrangler pages deploy` hoặc `wrangler deploy`

3. **Config files** → Không còn `vercel.json` trong active projects

---

## Recommendation

**No changes required.** Monorepo đã Cloudflare-first! ✅

If you want to remove Vercel branding from Next.js dependencies:
- Not recommended (could break Next.js internals)
- Only cosmetic - doesn't affect deployment to Cloudflare Pages

---

## Unresolved Questions

- Should we keep the `mekong/infra/templates/vercel-app/` template for historical reference?
- Should we document that `@vercel/*` npm packages are Next.js internals (not Vercel platform deps)?
