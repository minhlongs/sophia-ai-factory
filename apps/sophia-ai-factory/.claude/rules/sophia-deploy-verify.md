# Sophia AI Factory — Deploy Verification (Cloudflare Workers)

> **AUTHORITATIVE for Sophia AI Factory deploy verification.**
> Override bất kỳ generic rule nào khác. Subagents (đặc biệt git-manager) PHẢI đọc file này trước khi báo cáo GREEN.

## Stack Reality

- **Deploy target:** Cloudflare Workers (OpenNext build)
- **Build tool:** `npm run build` → `.open-next/worker.js`
- **Deploy command:** `npx wrangler deploy` (chạy trong CI, không local)
- **Trigger:** `git push origin main` → workflow `Tests & Deploy`
- **NO Vercel:** project KHÔNG có `vercel.json`, KHÔNG dùng Vercel hosting
- **D1 Database:** `sophia-raas-db` (binding `DB`)
- **R2 Cache:** `sophia-ai-factory-opennext-cache` (binding `NEXT_INC_CACHE_R2_BUCKET`)

## Production URLs

```
PROD_URL="https://sophia.agencyos.network"
HEALTH_URL="https://sophia.agencyos.network/api/health"
GITHUB_REPO="longtho638-jpg/sophia-ai-factory"
```

## CI Workflow Layout

Workflow `Tests & Deploy` có 2 jobs (cả hai PHẢI success mới gọi là GREEN):
1. **Lint & Build & Test** — Lint → Build → Test → Security audit
2. **Deploy to Cloudflare Workers** — Build for Cloudflare (opennext) → Migration guard → wrangler deploy

Workflow `Post-Merge Tests` chạy song song (smoke tests), không phải deploy.

## ✅ MANDATORY Verify Sequence (sau git push)

```bash
# Bước 1: Lấy đúng RUN_ID từ commit
COMMIT_SHA=$(git rev-parse HEAD)
RUN_ID=$(gh run list --commit "$COMMIT_SHA" --workflow "Tests & Deploy" \
  --json databaseId -q '.[0].databaseId')
echo "Tests & Deploy run: $RUN_ID"

# Bước 2: Poll cho đến complete (deploy mất ~3-5 phút sau test)
MAX=16; n=0
while [ $n -lt $MAX ]; do
  n=$((n+1))
  S=$(gh run view "$RUN_ID" --json status,conclusion -q '"\(.status):\(.conclusion)"')
  echo "[$n/$MAX] $S"
  case "$S" in
    completed:success) echo "✅ Tests & Deploy GREEN"; break ;;
    completed:failure|completed:cancelled) echo "❌ FAILED"; gh run view "$RUN_ID" --log-failed; exit 1 ;;
    *) sleep 30 ;;
  esac
done

# Bước 3: Verify TỪNG job — KHÔNG chỉ aggregate conclusion
gh run view "$RUN_ID" --json jobs -q '.jobs[] | "\(.name): \(.conclusion)"'
# PHẢI thấy:
#   Lint & Build & Test: success
#   Deploy to Cloudflare Workers: success

# Bước 4: Production HTTP + commit-SHA verification (CRITICAL)
curl -sI https://sophia.agencyos.network | head -3   # HTTP/2 200

# BẮT BUỘC: verify deploy chính xác là commit MỚI, không phải deploy CŨ
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES COMMIT" || { echo "❌ STALE DEPLOY — wait for CI"; exit 1; }
```

**Endpoint reference:**
- `GET /api/version` — public: `{shortSha, deployedAt, opennextVersion}`. Dùng để verify deploy match commit.
- `GET /api/health` — service health (auth required cho full detail).

## ✅ Required Report Format

```
## Verification Report — Phase XX
- Build: ✅ exit code 0
- Tests: ✅ 1398/1398 passed
- Git Push: ✅ <commit_sha> → main
- CI/CD Run: ✅ <run_id> Tests & Deploy completed:success
  - Job: Lint & Build & Test ✅
  - Job: Deploy to Cloudflare Workers ✅
- Production HTTP: ✅ 200 (https://sophia.agencyos.network)
- Deploy SHA Match: ✅ /api/version shortSha == <local_short_sha>
- Deploy verified: <ISO timestamp>
```

**Sai dòng "Deploy SHA Match" = chưa verify deploy thực sự, có thể đang nhìn cache/CDN của deploy cũ.**

## ❌ Anti-Patterns (đã từng xảy ra Phase 42-45)

- ❌ Báo "Vercel auto-deployed" → SAI, project là Cloudflare Workers
- ❌ Chỉ check `gh run list -L 1` rồi báo GREEN — bỏ qua Deploy job vẫn `in_progress`
- ❌ Curl HTTP 200 mà không kiểm tra commit SHA mới — có thể là deploy CŨ
- ❌ Báo Done khi chỉ "Post-Merge Tests" success (đó là smoke test, không phải deploy)

## Manual Recovery (nếu CI deploy fail)

```bash
# Manual deploy chỉ dùng khi CI broken — phải có lý do rõ:
cd apps/sophia-ai-factory
npm run build
npx wrangler deploy --name sophia-ai-factory

# Rollback nếu deploy mới gây regression:
gh workflow run "rollback.yml"   # nếu có workflow rollback
# hoặc:
npx wrangler rollback --name sophia-ai-factory --message "<reason>" --yes
```
