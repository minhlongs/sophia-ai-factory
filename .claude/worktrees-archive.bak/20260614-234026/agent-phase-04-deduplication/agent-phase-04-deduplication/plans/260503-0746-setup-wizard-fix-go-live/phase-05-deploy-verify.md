# Phase 05 — Deploy + Verify Production GREEN

## Context Links

- Binh Pháp CI/CD: `~/.claude/rules/binh-phap-cicd.md` (mandatory verification pipeline)
- Browser discipline: `~/.claude/CLAUDE.md` Rule 13 (CC CLI must browser-test checkout)
- Phase 04 must be GREEN before this phase starts

## Overview

- **Priority:** P0 (go-live gate)
- **Status:** pending
- **ETA:** 45m
- **Brief:** Push commits → poll ALL GitHub Actions jobs (Lint+Build+Test → Deploy CF Workers) → curl prod health → browser test setup-wizard + checkout flow.

## Key Insights

- Project uses CI deploy (NOT direct `wrangler deploy`) — GH Actions only path
- Must check EVERY job in run, not just `gh run list -L 1` (deploy job often runs after build)
- Production verification ≠ HTTP 200 alone — must verify deployed SHA matches HEAD
- Browser test = mandatory per Rule 13 (no "push and done")

## Requirements

**Functional:**
- All GH Actions jobs: success
- Production `/api/version` returns shortSha matching `git rev-parse HEAD`
- Magic-link → /setup-wizard works on production
- Checkout button → NOWPayments redirect works (per tier)

**Non-functional:**
- Verification report follows mandated format (Rule binh-phap-cicd Bước 3)
- Total wait time ≤ 8 min (CI MAX_ATTEMPTS=16 × 30s)

## Architecture

```
git push origin main
  ↓
GitHub Actions trigger
  ├── Job: Lint+Build+Test (must succeed first)
  └── Job: Deploy to Cloudflare Workers (depends on prev)
  ↓
Cloudflare Workers production live
  ↓
Verify:
  ├── HTTP curl /api/version       → SHA matches
  ├── HTTP curl /setup-wizard      → 307 (cold) — expected
  ├── Browser cold visit            → 307 to /login
  ├── Browser magic-link consume    → /setup-wizard 200 + VN strings
  └── Browser checkout per tier     → NOWPayments redirect
```

## Related Code Files

- No code changes here — Phase 05 is verification only.
- `.github/workflows/*.yml` (verify CI matrix)
- `apps/sophia-ai-factory/wrangler.jsonc` (verify deploy config)
- `apps/sophia-ai-factory/src/app/api/version/route.ts` (returns shortSha)

## Implementation Steps

### Sub-Phase 05A: Push

```bash
cd /Users/macbook/projects/sophia-ai-factory
git status                          # verify clean tree (only intended commits)
git log --oneline -5                # confirm Phase 02 + 03 commits
git push origin main
COMMIT_SHA=$(git rev-parse HEAD)
echo "Pushed: $COMMIT_SHA"
```

### Sub-Phase 05B: Poll ALL CI Jobs

```bash
RUN_ID=$(gh run list --commit "$COMMIT_SHA" --json databaseId,workflowName -q '.[0].databaseId')
echo "Run ID: $RUN_ID"

MAX_ATTEMPTS=16; ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  RUN_STATUS=$(gh run view "$RUN_ID" --json status,conclusion -q '"\(.status):\(.conclusion)"')
  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS — $RUN_STATUS"
  case "$RUN_STATUS" in
    completed:success) echo "✅ ALL JOBS GREEN!"; break ;;
    completed:failure|completed:cancelled) echo "❌ FAILED"; gh run view "$RUN_ID" --log-failed; exit 1 ;;
    *) sleep 30 ;;
  esac
done

# enumerate every job
gh run view "$RUN_ID" --json jobs -q '.jobs[] | "\(.name): \(.conclusion)"'
```

### Sub-Phase 05C: Production HTTP + SHA

```bash
PROD="https://sophia.agencyos.network"
HEAD_SHA=$(git rev-parse --short=8 HEAD)

# Verify deploy fresh
DEPLOY_SHA=$(curl -s "$PROD/api/version" | python3 -c "import sys,json; print(json.load(sys.stdin)['shortSha'])")
echo "HEAD: $HEAD_SHA  |  Deployed: $DEPLOY_SHA"
[ "$HEAD_SHA" = "$DEPLOY_SHA" ] && echo "✅ Fresh deploy" || { echo "❌ Stale deploy"; exit 1; }

# Cold visit (expect 307)
curl -sI "$PROD/setup-wizard" | head -3
```

### Sub-Phase 05D: Browser Test (PER RULE 13)

Open browser, test each:

**Test 1 — Cold visit /setup-wizard**
- URL: `https://sophia.agencyos.network/setup-wizard`
- Expect: redirect to /login (307 chain → 200 login page)
- Status: ☐ pass / ☐ fail

**Test 2 — Magic-link → /setup-wizard**
- Admin: create handover, send magic link to test email
- Click link → expect: /setup-wizard loads (NOT 307 to /login)
- Verify: page shows VN strings (no "Ai Keys", "Launch" placeholders)
- DevTools cookie: `__Secure-better-auth.session_token` present
- Status: ☐ pass / ☐ fail

**Test 3 — Checkout flow (each tier: BASIC, PREMIUM, ENTERPRISE, MASTER)**
- From /setup-wizard or /pricing → click checkout for tier
- Expect: redirect to NOWPayments (or PayOS) checkout page
- Verify URL contains expected payment provider domain
- Screenshot proof per tier
- Status BASIC: ☐  PREMIUM: ☐  ENTERPRISE: ☐  MASTER: ☐

**Test 4 — wrangler tail clean**
```bash
cd apps/sophia-ai-factory
npx wrangler tail --format=pretty &
TAIL_PID=$!
# leave running 5 min during browser tests
# Ctrl+C or kill $TAIL_PID after
```
- Verify: zero `[better-auth-session] getSession failed` during tests
- Status: ☐ pass / ☐ fail

### Sub-Phase 05E: Final Report (MANDATED FORMAT)

```
## Verification Report — Sophia setup-wizard fix
- Build: ✅ exit code 0
- Tests: ✅ [N] tests passed
- Lint: ✅ 0 errors
- Git Push: ✅ [commit_hash] → main
- CI/CD Run: ✅ [run_id] completed:success
- Job: Lint & Build & Test ✅
- Job: Deploy to Cloudflare Workers ✅
- Production HTTP /api/version: ✅ 200, shortSha=[X] matches HEAD
- Production HTTP /setup-wizard (cold): ✅ 307 (expected)
- Browser Test: Cold visit ✅ | Magic-link ✅ | Checkout BASIC/PREMIUM/ENTERPRISE/MASTER ✅
- wrangler tail: ✅ zero session errors
- Timestamp: [actual_time]
```

## Todo List

- [ ] git push origin main
- [ ] Capture commit SHA
- [ ] Poll CI run all jobs GREEN
- [ ] Enumerate jobs via `gh run view --json jobs`
- [ ] Curl /api/version verify fresh deploy
- [ ] Browser test 1: cold visit
- [ ] Browser test 2: magic-link flow
- [ ] Browser test 3a-3d: checkout per tier (4 tiers)
- [ ] wrangler tail observation 5 min
- [ ] Capture screenshots for proof
- [ ] Write verification report (mandated format)

## Success Criteria

- ALL CI jobs GREEN
- Deployed SHA matches HEAD
- Browser tests 1-4 ALL pass
- Verification report complete in mandated format

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CI deploy job fails after build success | Med | High | `gh run view --log-failed` → debug → fix → re-push |
| Stale deploy (CI green but old code live) | Low | High | `/api/version` SHA check catches this |
| Magic-link expires mid-test | Med | Low | Generate fresh link before each test |
| Checkout redirect fails for one tier | Med | Med | Document failing tier; rollback if blocker |
| `wrangler tail` shows residual errors from old sessions | Med | Low | Filter timestamp ≥ deploy time |

## Security Considerations

- Use test email account for magic-link tests (not customer)
- Capture screenshots WITHOUT exposing real tokens
- Revoke test handover after verification

## Next Steps

- ALL GREEN → Phase 06 (finalize: docs + tag)
- ANY RED → rollback or fix-forward (assess severity)
- If browser test reveals new bug → file as new phase, do NOT report done
