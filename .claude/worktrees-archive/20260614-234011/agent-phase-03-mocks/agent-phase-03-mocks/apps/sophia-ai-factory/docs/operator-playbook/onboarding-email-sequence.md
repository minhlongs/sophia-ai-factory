# Customer Onboarding Email Sequence

> **Trigger:** New signup via landing page.
> **Brand voice locked:** Expert mentor, calm, anti-hype (per `brand-voice.md`).
> **Split-test branches:** Cohort A (Free 7d) vs Cohort B ($1 trial) per pricing decision.
> **Locales:** EN + VN (mirrored, not machine-translated).

---

## Sequence Overview

| Email | Trigger | Day | Cohort A (Free) | Cohort B ($1) |
|-------|---------|-----|-----------------|----------------|
| **E1** | Signup confirmed | 0 (instant) | Welcome + Setup Wizard CTA | Welcome + payment receipt + Setup Wizard CTA |
| **E2** | Setup Wizard complete | 0 (after wizard) | "Run first campaign" | "Run first campaign" |
| **E3** | First video shipped | Day 1-3 (event) | "Here's what's next" | "Here's what's next" |
| **E4** | Day 4 nudge | Day 4 | "Tools you might be ignoring" | "Tools you might be ignoring" |
| **E5** | Trial end approaching | Day 6 | **Upgrade urgency** | "What happens tomorrow" |
| **E6** | Trial ended / converted | Day 8 | Lock-out OR conversion offer | Auto-charge receipt OR cancel confirmation |
| **E7** | Re-engagement (lapsed) | Day 14 | "Come back" offer | "We miss you" |

**Total:** 7 emails. Free cohort gets stronger upgrade nudges. $1 cohort gets gentler since they already committed payment.

---

## E1 — Welcome (Signup Day 0)

### Cohort A (Free 7d)

**Subject (EN):** `Sophia is set up. Your first video is 5 minutes away.`
**Subject (VN):** `Sophia đã sẵn sàng. Video đầu tiên cách bạn 5 phút.`

**Body (EN):**
```
Hi [Name],

Your Sophia trial is active. 7 days, full access, no card on file.

Three things to do in the next 5 minutes:

1. Open the Setup Wizard → [link]
   You'll paste 4 API keys (OpenRouter, ElevenLabs, D-ID, NOWPayments).
   We'll guide you through where to get each one.

2. Once 4 green checkmarks → run your first campaign.
   Via Telegram (@Sophia_Bbot, send /campaign) or dashboard.

3. Watch your first video render in 3-5 minutes.

If you hit a snag at any step, reply to this email. We answer within hours.

— The Sophia team

P.S. Want to see what 5 creators built with Sophia? [Link to Article #7]
```

**Body (VN):**
```
Chào [Name],

Bản dùng thử Sophia của bạn đã active. 7 ngày, full access, không cần thẻ.

3 việc cần làm trong 5 phút tới:

1. Mở Setup Wizard → [link]
   Bạn sẽ dán 4 API key (OpenRouter, ElevenLabs, D-ID, NOWPayments).
   Sophia hướng dẫn bạn lấy từng key ở đâu.

2. Khi cả 4 đều ✅ → chạy chiến dịch đầu tiên.
   Qua Telegram (@Sophia_Bbot, gửi /campaign) hoặc dashboard.

3. Xem video đầu tiên render trong 3-5 phút.

Nếu gặp trục trặc bất kỳ bước nào, reply email này. Sophia trả lời trong vài giờ.

— Sophia team

P.S. Muốn xem 5 creators dùng Sophia thế nào? [Link Article #7]
```

### Cohort B ($1 trial)

**Subject (EN):** `Payment confirmed. Sophia is ready in 5 minutes.`
**Subject (VN):** `Đã nhận $1. Sophia sẵn sàng trong 5 phút.`

Same body structure as Cohort A, with payment receipt line inserted:

> Your $1 trial payment is confirmed. Trial active until [date+7]. We'll charge $60/mo on [date+8] unless you cancel.
> Đã xác nhận thanh toán $1. Trial active đến [date+7]. Sophia tự động charge $60/tháng vào [date+8] trừ khi bạn hủy.

Plus an extra closer line:
> Cancel anytime → [link to /dashboard/billing/cancel]
> Hủy bất kỳ lúc nào → [link]

---

## E2 — Setup Wizard Complete (event-triggered)

### Both cohorts (identical)

**Subject (EN):** `4 ✅. Run your first campaign.`
**Subject (VN):** `4 ✅. Chạy chiến dịch đầu tiên.`

**Body (EN):**
```
[Name],

All 4 API keys validated. You're ready.

Quickest path: send /campaign to @Sophia_Bbot on Telegram. Pick "video:create" → enter your niche/topic → watch.

Or via dashboard: [link to /dashboard/new-campaign]

First video typically takes 3-5 minutes. Cost: ~$0.50-$1.50 from your provider credits (Sophia doesn't charge for this — your BYOK keys do).

— Sophia team
```

**Body (VN):**
```
[Name],

Cả 4 API keys đã xác thực. Bạn đã sẵn sàng.

Cách nhanh nhất: gửi /campaign cho @Sophia_Bbot trên Telegram. Chọn "video:create" → nhập niche/topic → xem.

Hoặc qua dashboard: [link to /dashboard/new-campaign]

Video đầu tiên thường mất 3-5 phút. Chi phí: ~$0.50-$1.50 từ provider credits của bạn (Sophia không thu phí phần này — BYOK keys của bạn chi trả).

— Sophia team
```

---

## E3 — First Video Shipped (event-triggered)

### Both cohorts

**Subject (EN):** `Your first video shipped. Here's what's next.`
**Subject (VN):** `Video đầu tiên đã ship. Bước tiếp theo.`

**Body (EN):**
```
[Name],

Video link: [video_url]
Tracking URL: [tracking_url]
Render time: [X] minutes
Cost: $[X.XX]

Three things to do today:

1. Watch it. Honest assessment: is the voice OK? Script coherent? Lipsync acceptable?
   If anything's off, reply with timestamp — we'll diagnose.

2. Decide your niche commit: 1 topic, 10 videos in next 30 days.
   Article #3 has 5 niches with margin data → [link]

3. Set up affiliate signups (Amazon, ShareASale, niche-specific).
   Sophia generates content; affiliate networks convert it to revenue.

— Sophia team
```

**Body (VN):**
```
[Name],

Video link: [video_url]
Tracking URL: [tracking_url]
Thời gian render: [X] phút
Chi phí: $[X.XX]

3 việc cần làm hôm nay:

1. Xem nó. Đánh giá trung thực: voice OK chưa? Script mạch lạc? Lipsync chấp nhận được?
   Nếu có vấn đề, reply kèm timestamp — Sophia chẩn đoán.

2. Quyết định cam kết niche: 1 topic, 10 video trong 30 ngày tới.
   Article #3 có 5 niche với data margin → [link]

3. Đăng ký affiliate networks (Amazon, ShareASale, niche-specific).
   Sophia tạo content; affiliate networks chuyển thành doanh thu.

— Sophia team
```

---

## E4 — Day 4 Tools Nudge

### Both cohorts

**Subject (EN):** `Tools you might be ignoring (Sophia day 4)`
**Subject (VN):** `Tính năng bạn có thể đang bỏ qua (ngày 4)`

**Body (EN):**
```
[Name],

By day 4, most users have shipped 2-5 videos. Time to mention tools you might not have used yet:

→ **Bulk topic generation**: Paste a niche, Sophia returns 30 topic ideas.
  Dashboard → Tools → Bulk Topics

→ **lead:export mission**: Pull a target prospect list (Apollo BYOK).
  Send "/mission lead:export" to bot.

→ **Cost ledger**: See exact spend per video, per provider.
  Dashboard → Billing → Cost Ledger

→ **Caption translator**: Auto-translate your video captions to VN/EN/ES/FR.
  Mission step: video:create with `translate: vi` flag.

Reply with which of these would unblock you most — we'll write a 2-line how-to.

— Sophia team
```

**Body (VN):**
```
[Name],

Đến ngày 4, đa số users đã ship 2-5 video. Đến lúc kể tính năng bạn có thể chưa dùng:

→ **Bulk topic generation**: Paste niche, Sophia trả về 30 topic ideas.
  Dashboard → Tools → Bulk Topics

→ **lead:export mission**: Pull danh sách prospect target (Apollo BYOK).
  Gửi "/mission lead:export" cho bot.

→ **Cost ledger**: Xem spend chính xác mỗi video, mỗi provider.
  Dashboard → Billing → Cost Ledger

→ **Caption translator**: Tự động dịch captions video sang VN/EN/ES/FR.
  Mission step: video:create với flag `translate: vi`.

Reply tính năng nào unblock bạn nhất — Sophia viết hướng dẫn 2-dòng cho bạn.

— Sophia team
```

---

## E5 — Day 6: Trial End Approaching

### Cohort A (Free 7d) — STRONGER nudge

**Subject (EN):** `Your free trial ends tomorrow.`
**Subject (VN):** `Trial miễn phí của bạn kết thúc ngày mai.`

**Body (EN):**
```
[Name],

Tomorrow your trial ends. Here's where you stand:

- Videos shipped: [X]
- Tracking URLs created: [Y]
- Cost (your providers): $[Z]

Three options:

1. **Upgrade to Growth ($60/mo)** → Continue. All features, no caps. → [link]
2. **Stay free, lose access** → Your videos and BYOK keys stay safe in your account. Re-activate anytime.
3. **Reply with a question** → If something's blocking you, tell us.

To upgrade in 1 click: [direct upgrade link]

— Sophia team

P.S. We DON'T auto-charge you. You're in control.
```

**Body (VN):**
```
[Name],

Ngày mai trial kết thúc. Tình trạng hiện tại:

- Video đã ship: [X]
- Tracking URLs đã tạo: [Y]
- Chi phí (provider của bạn): $[Z]

3 lựa chọn:

1. **Upgrade Growth ($60/tháng)** → Tiếp tục. Full features, không giới hạn. → [link]
2. **Ở mức free, mất quyền truy cập** → Videos + BYOK keys của bạn vẫn an toàn. Reactivate bất cứ lúc nào.
3. **Reply hỏi** → Nếu có gì block bạn, kể Sophia nghe.

Upgrade 1 click: [direct upgrade link]

— Sophia team

P.S. Sophia KHÔNG tự động charge. Bạn quyết định.
```

### Cohort B ($1 trial) — GENTLE reminder

**Subject (EN):** `Tomorrow: trial ends. Auto-charge $60 unless you cancel.`
**Subject (VN):** `Ngày mai: trial kết thúc. Tự động charge $60 trừ khi bạn hủy.`

**Body (EN):**
```
[Name],

Tomorrow your $1 trial ends. Per terms, we'll charge $60 for the first month of Growth.

You're at:
- Videos shipped: [X]
- Cost (your providers): $[Z]

If Sophia is working for you → no action needed. You'll be charged automatically.

If not → cancel now → [link to /dashboard/billing/cancel]
  Cancellation takes 30 seconds. No questions, no friction.

Or reply with what's blocking you — we'd rather fix it than lose you.

— Sophia team
```

**Body (VN):**
```
[Name],

Ngày mai trial $1 kết thúc. Theo điều khoản, Sophia charge $60 cho tháng đầu Growth.

Hiện tại:
- Video đã ship: [X]
- Chi phí (provider của bạn): $[Z]

Nếu Sophia phù hợp với bạn → không cần làm gì. Sẽ charge tự động.

Nếu chưa hợp → hủy ngay → [link to /dashboard/billing/cancel]
  Hủy mất 30 giây. Không hỏi, không khó khăn.

Hoặc reply kể Sophia điều gì đang block bạn — Sophia muốn fix hơn là mất bạn.

— Sophia team
```

---

## E6 — Day 8: Conversion or Lock-out

### Cohort A path A1 — Upgraded

**Subject (EN):** `Welcome to Growth. Here's what changes.`
**Subject (VN):** `Chào mừng Growth. Có gì khác.`

**Body (EN):**
```
[Name],

You're on Growth ($60/mo). 3 changes:

→ Quota unlocked. No daily video cap.
→ Priority queue. Your videos render before free-tier requests.
→ Caption translator now active for all 4 languages.

Next billing: [date + 30 days]. Cancel anytime → [link]

Reply with one ambitious goal for the next 30 days — we'll send tactical advice mid-month.

— Sophia team
```

### Cohort A path A2 — Not upgraded (locked)

**Subject (EN):** `Trial ended. Your data is safe.`
**Subject (VN):** `Trial đã kết thúc. Data của bạn an toàn.`

**Body (EN):**
```
[Name],

Your trial ended yesterday. Your account is in read-only:

- Existing videos: still accessible at their URLs
- BYOK keys: still encrypted in your account
- Mission history: viewable, not re-runnable

When you're ready, reactivate in 1 click → [link]

If you decided Sophia isn't for you, reply once with a single sentence why. It's the most useful data we can get.

— Sophia team
```

### Cohort B path B1 — Auto-charged

**Subject (EN):** `Growth active. $60 charged. Next month: [date].`
**Subject (VN):** `Growth active. $60 đã charge. Tháng sau: [date].`

Same body structure as A1.

### Cohort B path B2 — Cancelled

**Subject (EN):** `Cancellation confirmed. Your videos are safe.`
**Subject (VN):** `Đã xác nhận hủy. Videos của bạn an toàn.`

Same body structure as A2, with added line:
> No further charges. Your $1 stays with us as the cost of the trial.
> Không có charge nào nữa. $1 của bạn ở lại với Sophia như chi phí trial.

---

## E7 — Day 14: Re-engagement (lapsed users only)

### Both cohorts (lapsed)

**Subject (EN):** `Quick question — what would bring you back?`
**Subject (VN):** `Câu hỏi nhanh — điều gì sẽ kéo bạn quay lại?`

**Body (EN):**
```
[Name],

Two weeks ago you tried Sophia. You haven't been back.

We're not pitching. Just asking one thing:

What blocked you?
  (a) Too complex
  (b) Quality wasn't there
  (c) Wrong niche / wrong fit for my business
  (d) Just got busy
  (e) Something else (reply with what)

Pick a letter and reply. That's it. Takes 5 seconds.

We use this to fix what's broken. If your answer is (d), no offense taken — life happens.

— Sophia team
```

**Body (VN):**
```
[Name],

2 tuần trước bạn thử Sophia. Bạn chưa quay lại.

Sophia không pitch. Chỉ hỏi 1 điều:

Điều gì block bạn?
  (a) Quá phức tạp
  (b) Chất lượng chưa đạt
  (c) Sai niche / không hợp business của tôi
  (d) Bận quá
  (e) Điều khác (reply kể)

Chọn 1 chữ và reply. Mất 5 giây.

Sophia dùng data này để fix. Nếu đáp án là (d), không offense — đời mà.

— Sophia team
```

---

## Brand Voice Audit Checklist (per email)

Operator review before scheduling:

- [ ] No "10x", "supercharge", "revolutionary", "game-changer"
- [ ] No exclamation marks (except 1 in subject if absolutely needed)
- [ ] Concrete numbers wherever possible ($X cost, [Y] videos, [date+N] day)
- [ ] Subject ≤ 60 chars
- [ ] Body ≤ 250 words (people scan, not read)
- [ ] Single primary CTA per email (no decision fatigue)
- [ ] Reply-to is monitored email (no `noreply@`)
- [ ] EN + VN versions mirrored (same length, same structure, same CTAs)
- [ ] Variable placeholders filled (`[Name]`, `[X]`, `[date]`) — never publish with raw template tokens

---

## Implementation Notes

### Email service provider

Sophia ships emails via `lib/email/` service (existing infrastructure). Operator can swap provider via env var `EMAIL_PROVIDER` (Resend / Postmark / SendGrid).

### Trigger plumbing

| Email | Trigger source |
|-------|---------------|
| E1 | User signup → `signupComplete` event |
| E2 | Setup Wizard → `byok.all_keys_validated` event |
| E3 | Mission → `mission.completed` event (first one only) |
| E4 | Cron daily check `signupDate + 4 days` |
| E5 | Cron daily check `signupDate + 6 days` |
| E6 | Cron daily check `signupDate + 8 days` (branch on subscription state) |
| E7 | Cron daily check `lastActiveDate + 14 days` AND `subscription = lapsed` |

Tracked as code work for Phase 06 prep (Email automation infrastructure — not yet scoped, defer until split test #153 done).

### Locale routing

User locale stored in `user_profiles.settings.locale` per Setup Wizard. Email sender reads this and picks EN/VN template. Fall back to EN if locale undefined.

### A/B aware

E1 and E5/E6 differ per cohort. Cohort tagged at signup time (per split test #153 routing) — email sender reads `user_subscriptions.trial_cohort` ('A_free' | 'B_paid') and picks template.

---

## Unresolved

1. **Email automation infrastructure** — currently no cron-triggered email scheduler. Depends on split test #153 cohort tracking landing first. Bundle scope: ~4-6 hours dev (cron job + template renderer + send queue).
2. **Bounce / unsubscribe handling** — basic unsubscribe link needed per CAN-SPAM. Existing `lib/email/` may support, but defer until verified.
3. **Soft-bounce retry policy** — provider-dependent. Standard 3-attempt over 48h. Document when provider chosen.
4. **Vietnamese vocative** — `[Name]` substitution in VN context may need salutation guidance (anh/chị/em vs just first name). Currently uses first name only — review with operator before Phase 06 launch.
5. **Email analytics** — open rate, click rate, conversion per email/cohort. Need tracking pixel + UTM links. Bundle with split test #153 analytics scope.
6. **Sample data for review** — operator should run E1-E7 through their own inbox before launch to QA rendering across Gmail/Outlook/Apple Mail.
