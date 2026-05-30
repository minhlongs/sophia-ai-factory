# Rollback Plan — 2026-05-30

## Quick Rollback (< 2 minutes)

### Option A: Wrangler rollback to previous version

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --config wrangler.toml
```

Previous version: `0e61f531-e1c2-4c10-a8ba-a8389285e9dd` (2026-05-30T03:27:30Z)

### Option B: Git revert + redeploy

```bash
cd /Users/macbook/projects/sophia-ai-factory
git revert 449cecc6 --no-edit
cd apps/sophia-ai-factory
npm run deploy
```

## Risk Assessment

| Change | Rollback Risk | Notes |
|---|---|---|
| XSS fix (sop-preview) | ✅ Safe to rollback | Restores vulnerability but no data impact |
| Timestamp fix (ms→s) | ⚠️ Low risk | New marketplace entries after deploy use seconds; rollback would create ms entries again |
| N+1 → batch query | ✅ Safe | Performance regression only |
| i18n translations | ✅ Safe | English hardcoded strings restored |
| Creator detail page | ✅ Safe | 404 returns |
| Publish button wiring | ✅ Safe | Button disappears |
| getD1 null guard | ✅ Safe | Different error page on null |
| Duplicate test deletion | ✅ Safe | Test file restored (no prod impact) |

## Monitoring

After deploy, monitor for 30 minutes:
1. **Cloudflare Dashboard** → Workers → sophia-ai-factory → Requests/Errors
2. **D1 Dashboard** → sophia-raas-db → Read/Write counts
3. **Error rates** → Should stay at baseline (~0.1%)

## Contact

- **Deploy author**: Antigravity CLI
- **Commit**: `449cecc6`
- **PR**: N/A (direct to main)
