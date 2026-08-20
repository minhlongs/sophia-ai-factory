# Incident Response Playbook

> **Bilingual:** English (primary) + Vietnamese (operational phrases)
> **Audience:** Solo operator (non-technical CEO)
> **Last verified:** 2026-08-19 against production codebase

---

## Severity Classification

**Phan loai muc do nghiem trong**

| Severity | Definition | Response Time | Example |
|---|---|---|---|
| **P0 — Critical** | Production down or protected flow broken | **15 minutes** | Setup Wizard fails, Telegram bot dead, payments not processing, site returns 500 |
| **P1 — High** | Major feature degraded but workaround exists | **1 hour** | Slow page loads, intermittent API errors, Sentry error spike, admin route blocked |
| **P2 — Medium** | Minor feature issue, no user impact | **24 hours** | Cosmetic bug, non-critical cron failure, documentation outdated |

**Vietnamese:**
- **P0 — Nghiem trong:** San xuong production bi loi hoac luong duoc bao ve bi gãy. Phan ung trong 15 phut.
- **P1 — Cao:** Tinh nang lon bi giam chat luong nhung co cach xu ly thay the. Phan ung trong 1 gio.
- **P2 — Trung binh:** Loi nho, khong anh huong nguoi dung. Phan ung trong 24 gio.

---

## P0 Response Procedure (15 minutes)

**Quy trinh xu ly P0 (15 phut)**

### Step 1: Acknowledge (1 min)
```
Xac nhan (1 phut)
```

Say out loud or in notes: "Incident acknowledged. Starting P0 response."

### Step 2: Identify scope (3 min)
```
Xac dinh pham vi (3 phut)
```

Run immediately:
```bash
# Is the site responding at all?
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health

# What version is live?
curl -s https://sophia.agencyos.network/api/version | grep shortSha

# What is the local version?
cd apps/sophia-ai-factory && git rev-parse HEAD | cut -c1-8
```

**Record:**
- Is /api/health returning 200? (yes/no)
- What is the live SHA?
- When did the issue start? (check Sentry timestamp)

### Step 3: Check if deploy-related (2 min)
```
Kiem tra co lien quan den trien khai khong (2 phut)
```

```bash
# When was last deploy?
git log --oneline -3
```

If the issue started within 30 minutes of a deploy → **rollback immediately**:
```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "P0 rollback: <reason>" --yes
```

If NOT deploy-related → continue to Step 4.

### Step 4: Live log triage (5 min)
```
Phan tich nhat ky truc tuyen (5 phut)
```

```bash
npx wrangler tail sophia-ai-factory --format=pretty
```

Look for:
- Error messages mentioning which route is failing
- D1 connection errors
- Circuit breaker opening on an external service
- Memory/timeout errors

### Step 5: Apply fix or escalate (4 min)
```
Ap dung sua loi hoac chuyen cap (4 phut)
```

- If you can identify the fix (e.g., environment variable missing) → fix and deploy
- If fix is unclear → rollback, then investigate offline
- **Never leave production broken while debugging**

**Vietnamese:** Neu ban co the xac dinh nguyen nhan → sua va trien khai ngay. Neu khong ro → thu hoi ngay, sau do dieu tra offline. Khong de production bi loi khi dang debug.

---

## P1 Response Procedure (1 hour)

**Quy trinh xu ly P1 (1 gio)**

### Step 1: Acknowledge and assess (5 min)
```
Xac nhan va danh gia (5 phut)
```

- Check Sentry for the specific error
- Check Cloudflare Worker logs: `npx wrangler tail sophia-ai-factory --format=pretty`
- Determine: Is this affecting all users or a subset?

### Step 2: Check protected flows (10 min)
```
Kiem tra luong duoc bao ve (10 phut)
```

Manually verify each protected flow still works:
1. **Setup Wizard:** Open `/vi/setup-wizard` → can you enter an API key?
2. **Telegram Bot:** Send `/status` to @Sophia_Bbot → does it respond?
3. **Payments:** Check `/dashboard/admin/billing/summary` → is data present?

If ANY protected flow is broken → **escalate to P0** (see above).

### Step 3: Investigate root cause (20 min)
```
Dieu tra nguyen nhan goc (20 phut)
```

- Check Sentry stack trace for the specific error
- Check if error correlates with a specific route or user action
- Check D1 query performance if slowness is reported

### Step 4: Implement fix (20 min)
```
Trien khai sua loi (20 phut)
```

- Fix the issue in code
- Run `npm test` to verify no regression
- Run `npm run build` to verify no TypeScript errors
- Deploy: `npm run deploy:full`
- Verify SHA match

### Step 5: Document (5 min)
```
Ghi nhan (5 phut)
```

Add entry to `docs/project-changelog.md` with:
- What happened
- Root cause
- Fix applied
- Time to resolution

---

## P2 Response Procedure (24 hours)

**Quy trinh xu ly P2 (24 gio)**

### Step 1: Create GitHub issue (5 min)
```
Tao issue GitHub (5 phut)
```

Include:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshot if UI-related

### Step 2: Schedule fix (during next work session)
```
Len lich sua loi (trong phien lam viec tiep theo)
```

- Add to your work queue
- Fix during next coding session
- No urgency required

---

## Communication Template

**Mau thong bao**

### Internal (for yourself or future reference)

```
INCIDENT: [P0/P1/P2] — [Brief description]
STARTED: [Timestamp]
SCOPE: [What is affected]
ROOT CAUSE: [Known or "investigating"]
ACTION TAKEN: [What you did]
RESOLVED: [Timestamp or "ongoing"]
FOLLOW-UP: [What needs to happen next]
```

### Customer-facing (if needed, via Telegram or email)

```
Subject: Sophia AI Factory — Service Disruption Notice

Hi [Customer Name],

We detected a temporary issue with [feature]. The issue started at [time]
and was resolved at [time]. All your data is safe.

If you experience any issues, please contact us via Telegram.

Thank you for your patience.
— Sophia AI Factory Team
```

**Vietnamese version:**

```
Chu de: Sophia AI Factory — Thong bao nghiem tr dich vu

Xin chao [Ten khach hang],

Chung toi phat hien mot van de tam thoi voi [tinh nang]. Van de bat dau
luc [thoi gian] va da duoc giai quyet luc [thoi gian]. Du lieu cua ban
an toan.

Neu ban gap bat ky van de nao, vui long lien he qua Telegram.

Cam on ban da kien nhan.
— Doi ngu Sophia AI Factory
```

---

## Protected Flow Quick Reference

**Tham chieu nhanh luong duoc bao ve**

These flows MUST NOT be broken. If any is broken, it is always P0.

| Flow | How to Test | What to Check |
|---|---|---|
| Setup Wizard | Open `/vi/setup-wizard` | Can enter API keys, form submits |
| Telegram Bot | Send `/status` to @Sophia_Bbot | Bot responds within 5 seconds |
| Payment (NOWPayments) | Check admin billing summary | Recent IPNs processed, tiers active |

---

## Escalation Matrix

**Bang chuyen cap**

| Situation | Action |
|---|---|
| Protected flow broken | P0 → Rollback immediately |
| Site returns 500 on all routes | P0 → Rollback immediately |
| Slow page loads (not broken) | P1 → Investigate, fix in 1 hour |
| Sentry error spike (>10/min) | P1 → Investigate, may need rollback |
| Cosmetic bug | P2 → Create issue, fix later |
| External service down (OpenRouter, etc.) | P1 → Circuit breaker should handle; monitor |
| D1 connection issues | P0 → Check Cloudflare status page |

---

## Post-Incident Checklist

**Danh sach kiem tra sau su co**

After any P0 or P1 incident is resolved:

- [ ] Document what happened in `docs/project-changelog.md`
- [ ] Verify all protected flows still work
- [ ] Run `npm test` to confirm no regression
- [ ] Check Sentry 24 hours later — has the error stopped?
- [ ] If the incident revealed a code gap → create GitHub issue
- [ ] If rollback was used → schedule redeploy with the fix
