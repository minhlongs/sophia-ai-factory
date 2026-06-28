# GitLab Migration Runbook

**Status:** prep complete (commit TBD), execution pending user.
**Date:** 2026-04-29
**Trigger:** GitHub Actions disabled at user level for `longtho638-jpg`. Migration target: gitlab.com.

---

## TL;DR

GH Actions blocked → migrate CI/CD to GitLab while keeping CF Workers stack. Code mirror to GitLab, push deploys via `.gitlab-ci.yml`. Cron stays OFF GitLab (free tier 400 min/mo insufficient) — use Upstash QStash free tier instead.

**Estimated effort:** 45–60 minutes, blocked only on user actions (signup, secret paste).

---

## What's already prepared (in this commit)

- `.gitlab-ci.yml` at git root — replicates `Tests & Deploy` (quality + deploy) + optional D1 backup.
- This runbook documenting the steps below.

## What user must do (manual, 6 steps)

### 1. Create GitLab account + project

```
1. Sign up at https://gitlab.com (use a different email than GH if possible)
2. Verify phone (mandatory for free CI minutes)
3. Create new project: Settings → New project → Create blank project
   - Name: sophia-ai-factory
   - Visibility: Private (or Public, your call)
   - DO NOT initialize with README (we'll push existing repo)
```

Note URL of project, e.g. `https://gitlab.com/<username>/sophia-ai-factory`.

### 2. Configure CI/CD variables

GitLab UI → Settings → CI/CD → Variables → Expand → Add variable.

| Key | Type | Mask | Protect | Value |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Variable | ✅ | ✅ | from CF Dashboard → My Profile → API Tokens (use existing or rotate) |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | ✅ | ✅ | from CF Dashboard → right sidebar |
| `SENTRY_AUTH_TOKEN` | Variable | ✅ | ✅ | from sentry.io → Auth Tokens |
| `SENTRY_ORG` | Variable | ❌ | ✅ | e.g. `agencyos` |
| `SENTRY_PROJECT` | Variable | ❌ | ✅ | e.g. `sophia-ai-factory` |

**"Protected"** = only available on protected branches (main + tags). Keep on for production secrets.

### 3. Push existing code to GitLab

```bash
cd /Users/macbook/projects/sophia-ai-factory

# Add GitLab as a second remote (don't replace GH yet)
git remote add gitlab https://gitlab.com/<username>/sophia-ai-factory.git

# Push all branches + tags
git push gitlab --all
git push gitlab --tags

# Verify
git remote -v
```

### 4. Wait for first pipeline

GitLab UI → CI/CD → Pipelines. Should auto-fire from the push to main.

Expected stages:
- ✅ `quality`: lint + build + test + audit (~3-5 min)
- ✅ `deploy`: opennext build + sentry upload + wrangler deploy (~5-7 min)

If failures: drill into job logs, fix, re-push.

### 5. Setup Upstash QStash for cron (replaces GH cron workflows)

Free tier: 500 messages/day = enough for every-5-min cron + daily backups.

```
1. Sign up at https://console.upstash.com (free tier no card)
2. Console → QStash → Schedules → Create
3. For each cron, configure:
```

| Schedule | Endpoint | Cron | Headers |
|---|---|---|---|
| Video status sync | `https://sophia.agencyos.network/api/cron/video-status-sync` | `*/5 * * * *` | `Authorization: Bearer <CRON_SECRET>` |
| Sophia ingestion | `https://sophia.agencyos.network/api/ingestion/trigger` | `0 2 * * *` | `Authorization: Bearer <CRON_SECRET>` + body `{"networks":["clickbank","shareasale"]}` |
| Uptime self-check | `https://sophia.agencyos.network/api/cron/uptime-check` | `*/5 * * * *` | `Authorization: Bearer <CRON_SECRET>` |
| Daily rollups (dunning, reminders, email-drip, error-digest) | each respective `/api/cron/*` URL | per existing wrangler.toml | same Bearer |

Tip: QStash dashboard shows delivery status + retry on failure (better than GH Actions for cron).

### 6. Switch primary remote (when comfortable)

```bash
# Option A (KEEP GH as backup, GitLab as primary)
git remote rename origin github
git remote rename gitlab origin

# Option B (DELETE GH entirely — only after GitLab proven stable for 1+ week)
git remote remove github
# Then optionally archive/delete GH repo via UI
```

Update CI badges, webhooks, and any external services pointing to GH.

---

## Trade-offs vs staying on GitHub

| Aspect | GitHub | GitLab |
|---|---|---|
| Free CI minutes | 2000/mo private (unlimited public) | 400/mo (free tier) |
| Marketplace (actions) | massive | smaller, less curated |
| Copilot integration | yes | no (GitLab Duo separate paid) |
| PR/MR UX | GH PRs more polished | GitLab MRs more powerful (built-in pipelines view) |
| Cron CI | `on: schedule:` in YAML | Schedules via UI only |
| Deploy keys / OIDC | mature | mature |
| Self-host runner | optional | optional (recommended for >400 min) |

**Realistic concern:** if `longtho638-jpg` was flagged on GH for legitimate reasons, the GitLab account may also be flagged. Mitigations:
- Use a different email + verified phone on GitLab
- Avoid rapid mass-create activity in first 30 days
- Verify phone immediately after signup

---

## Rollback

If GitLab proves problematic and GH gets reactivated:

```bash
# Switch back to GH primary
git remote rename origin gitlab
git remote rename github origin
```

`.gitlab-ci.yml` and `.github/workflows/*.yml` can coexist — they're independent.

---

## Self-hosted runner (cost-saver, optional)

If 400 min/mo runs out and Upstash QStash isn't enough, self-host a runner on a Mac/Linux machine:

```bash
# Mac (homebrew):
brew install gitlab-runner
gitlab-runner register --url https://gitlab.com/ --token <project-runner-token>
# Pick "shell" or "docker" executor
gitlab-runner run
```

Free, but requires the machine to be online. Suitable for a home lab or Mac mini left running.

---

## Unresolved questions

1. Is the GH account block due to Actions abuse heuristic OR something the user did (e.g., spammy commits)? If the latter, GitLab will likely flag too.
2. Does Sophia have any GH-specific integrations (PR bots, Copilot Workspace, GitGuardian on GH) that need re-wiring on GitLab?
3. Should we mirror GitLab → GitHub once both are active (write to GitLab primary, mirror to GH for visibility)? Built-in GitLab feature (Settings → Repository → Mirroring).
