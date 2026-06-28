# 🦞 Sophia AGI Mission — Full Task for CC CLI

## MISSION: Đạt AGI 100/100 cho Sophia AI Factory

Bạn là CC CLI được giao nhiệm vụ đưa Sophia AI Factory lên trạng thái AGI 100/100 — sẵn sàng bàn giao khách non-tech lấy tiền.

## PHASE 1: Client Docs (Non-Tech)

Tạo 5 file docs chi tiết cụ tỉ cho khách KHÔNG BIẾT CODE:

### 1. `docs/getting-started.md`

- Hướng dẫn step-by-step với emoji
- Cách truy cập dashboard
- Cách dùng Setup Wizard (nhập OpenRouter, ElevenLabs, D-ID keys)
- Cách tạo campaign đầu tiên
- Viết cả tiếng Việt + English
- Tone: friendly, no jargon, CEO-level

### 2. `docs/telegram-bot-guide.md`

- Hướng dẫn kết nối @Sophia_Bbot
- Tất cả commands: /campaign, /status, /results
- Cách start/stop campaigns từ điện thoại
- Mỗi step có mô tả rõ ràng

### 3. `docs/pricing-and-tiers.md`

- BASIC ($500): Assets (Landing page + 1 YouTube Channel + 5 Templates)
- PREMIUM ($1,200): 3 YouTube Channels + Unlimited Templates + Weekly Updates
- ENTERPRISE ($3,500): Full Zero Manual pipeline + Unlimited + Custom + API
- So sánh tính năng dạng bảng
- Cách upgrade tier

### 4. `docs/faq.md`

- OpenRouter là gì? Cách lấy API key?
- ElevenLabs là gì? Cách lấy API key?
- Campaign bị stuck? Cách fix?
- Cách export data?
- Bot không phản hồi?
- 20+ câu hỏi thường gặp

### 5. `docs/troubleshooting.md`

- Dashboard không load → kiểm tra URL
- Campaign failed → re-run
- Bot not responding → restart
- Video generation timeout → HeyGen polling
- Mỗi issue có: Triệu chứng → Nguyên nhân → Cách fix

## PHASE 2: Brain Sync (CLAUDE.md + Rules)

### 1. Update `CLAUDE.md`:

- Project identity: "Sophia AI Video Factory — Zero Manual Content Production"
- Tech stack: Next.js 16, Tailwind v4, Supabase, Polar, Inngest, OpenRouter, HeyGen, ElevenLabs
- Architecture: App Router + Server Actions + Supabase RLS + Inngest orchestration
- Tier system: BASIC/PREMIUM/ENTERPRISE (strict uppercase enum)
- The Turnkey Standard: Setup Wizard, Build Full/Unlock via Flags
- API routes: /api/health, /api/webhooks/polar, /api/webhooks/telegram, /api/inngest
- Known gotchas: HeyGen polling 1-3min, Supabase type assertions, API_ENCRYPTION_KEY required
- Quality standard: 100/100 Diamond Standard, all tests must pass
- Giữ lại hook response protocol và claudekit references

### 2. Update `.claude/rules/development-rules.md`:

- Zero `:any` types
- Zod validation on all inputs
- Server Actions for data mutations
- Supabase RLS policies required
- Test before commit

### 3. Create `.claude/rules/sophia-handover-rules.md`:

- Client là non-tech — docs phải simple
- KHÔNG BAO GIỜ break Setup Wizard flow
- KHÔNG BAO GIỜ break Telegram bot
- Mọi thay đổi phải test trước khi commit
- Docs phải song ngữ (Việt + English)

## PHASE 3: Verify & Ship

1. Run `npm run build` — phải pass
2. Run tests — phải 75/75
3. Kiểm tra tất cả docs đã tạo
4. Commit tất cả changes với message: `feat(docs): non-tech client handover docs + brain sync`
5. Push to main

## QUALITY GATE

- ✅ 5 docs files created và đầy đủ nội dung
- ✅ CLAUDE.md updated với Sophia-specific brain
- ✅ 2 rules files updated/created
- ✅ Build passes
- ✅ Tests pass
- ✅ Git committed và pushed

## IMPORTANT RULES

- Viết docs bằng TIẾNG VIỆT + ENGLISH (song ngữ)
- No jargon — khách là CEO non-tech
- Emoji mọi nơi cho dễ đọc
- Step-by-step chi tiết, đừng bỏ bước nào
- Nếu gặp lỗi build/test, FIX NGAY rồi tiếp tục
