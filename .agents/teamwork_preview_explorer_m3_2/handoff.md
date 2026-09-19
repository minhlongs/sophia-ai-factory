# Handoff Report: Milestone 3 Bilingual Localization Audit & Canonical Key Mapping

**Agent**: teamwork_preview_explorer (M3 Explorer 2)  
**Date**: 2026-09-19  
**Target Repository**: `/Users/macbook/sophia-ai-factory`  
**Output Path**: `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m3_2/handoff.md`  

---

## 1. Observation

Direct examination of the codebase revealed that `NewMissionPage`, `FirstRunWizard`, and `MissionProgressBar` currently rely on hardcoded bilingual ternaries (`isVi ? ... : ...`) and hardcoded English/Vietnamese string properties rather than canonical `next-intl` translation keys from `messages/en.json` and `messages/vi.json`.

### 1.1 Direct File Observations

#### A. `apps/sophia-ai-factory/src/app/[locale]/dashboard/missions/new/page.tsx`
- **Lines 24–30**:
  ```tsx
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Tạo nhiệm vụ video mới | Sophia AI Factory' : 'New Video Mission | Sophia AI Factory',
    description: isVi
      ? 'Khởi tạo video đầu tiên của bạn với các mẫu tối ưu sẵn và chi phí minh bạch.'
      : 'Launch your first AI video with pre-tested templates and transparent pricing.',
  };
  ```
- **Lines 61–63**:
  ```tsx
  <ArrowLeft className="h-3.5 w-3.5" />
  {isVi ? 'Quay lại danh sách nhiệm vụ' : 'Back to Missions'}
  ```
- **Lines 69–75**:
  ```tsx
  <h1 className="text-2xl font-bold text-foreground">
    {isVi ? 'Tạo video đầu tiên của bạn' : 'Create Your First Video'}
  </h1>
  <p className="mt-1 text-sm text-muted-foreground">
    {isVi
      ? 'Sophia sẽ tự động soạn kịch bản, lồng tiếng và dựng video hoàn chỉnh theo mẫu bạn chọn.'
      : 'Sophia will autonomously write scripts, synthesize voice, and composite video using your selected template.'}
  </p>
  ```
- **Line 82**:
  `<FirstRunWizard workspaceId={workspaceId} userId={user.id} locale={isVi ? 'vi' : 'en'} />` passing down a manual boolean/locale string instead of letting the component resolve `next-intl` context.

#### B. `apps/sophia-ai-factory/src/components/missions/first-run-wizard.tsx`
- **Line 93**:
  ```tsx
  setErrorMessage(isVi ? 'Không thể khởi chạy nhiệm vụ. Vui lòng thử lại.' : 'Failed to launch mission. Please retry.');
  ```
- **Lines 101–107** (CEO 5-Question Framework):
  ```tsx
  <div><p className="font-semibold text-primary">1. {isVi ? 'Nhập gì?' : 'What to enter?'}</p><p className="text-muted-foreground">{isVi ? 'Chọn mẫu hoặc chủ đề' : 'Pick a template/topic'}</p></div>
  <div><p className="font-semibold text-primary">2. {isVi ? 'Sophia làm gì?' : 'What Sophia does?'}</p><p className="text-muted-foreground">{isVi ? 'Kịch bản ➔ Giọng ➔ Ảnh ➔ Video' : 'Script ➔ Voice ➔ Video'}</p></div>
  <div><p className="font-semibold text-primary">3. {isVi ? 'Thời gian?' : 'Duration?'}</p><p className="text-muted-foreground">45 - 90 {isVi ? 'giây' : 'seconds'}</p></div>
  <div><p className="font-semibold text-primary">4. {isVi ? 'Chi phí?' : 'Cost?'}</p><p className="text-muted-foreground">~${costEstimate.totalUsd} / {costEstimate.totalMcu} MCU</p></div>
  <div><p className="font-semibold text-primary">5. {isVi ? 'Kết quả ở đâu?' : 'Where shown?'}</p><p className="text-muted-foreground">{isVi ? 'Trực tiếp tại trang này' : 'Live preview & Review'}</p></div>
  ```
- **Lines 116–124** (Completion Card):
  ```tsx
  <h3 className="text-lg font-bold text-foreground">{isVi ? 'Video đầu tiên đã hoàn tất!' : 'First Video Ready!'}</h3>
  <p className="text-sm text-muted-foreground">{isVi ? 'Video đã được dựng hoàn chỉnh và sẵn sàng để bạn duyệt.' : 'Video is composited and ready for your approval in the Review Console.'}</p>
  ...
  <Video className="h-4 w-4" /> {isVi ? 'Xem & Duyệt Video' : 'Review Video'}
  ...
  {isVi ? 'Tạo video khác' : 'Create Another'}
  ```
- **Line 133**:
  `{isVi ? 'Chọn mẫu kịch bản tối ưu sẵn' : 'Choose a Proven Template'}`
- **Line 147**:
  `{isVi ? 'Chủ đề hoặc Ý tưởng của bạn' : 'Topic or Video Concept'}`
- **Line 162**:
  `45 - 90 {isVi ? 'giây' : 'seconds'}`
- **Line 164**:
  `{isVi ? 'Minh bạch 100% không phí ẩn' : 'Zero Hidden Fees'}`
- **Line 170**:
  `{isVi ? 'Bắt đầu sản xuất video ngay' : 'Launch Video Mission Now'}`

#### C. `apps/sophia-ai-factory/src/components/missions/mission-progress-bar.tsx`
- **Lines 30–76**: `MISSION_STAGES` contains hardcoded English and Vietnamese fields (`labelEn`, `labelVi`, `descEn`, `descVi`):
  - Stage 1: `Script Generation` / `Soạn kịch bản SEO` | `Writing high-retention script with OpenRouter` / `Soạn kịch bản giữ chân người xem bằng AI`
  - Stage 2: `Voice Synthesis` / `Lồng tiếng AI` | `Synthesizing voiceover with ElevenLabs` / `Tạo giọng đọc tự nhiên bằng ElevenLabs`
  - Stage 3: `Visual Generation` / `Tạo hình ảnh AI` | `Rendering scenes with fal.ai` / `Dựng khung cảnh điện ảnh qua fal.ai`
  - Stage 4: `Video Compositing` / `Ghép video & Phụ đề` | `Assembling scenes, audio, and captions` / `Ghép cảnh, âm thanh và phụ đề chuyển động`
  - Stage 5: `Ready for Review` / `Sẵn sàng duyệt` | `Video complete! Ready for one-click approval` / `Video hoàn tất! Sẵn sàng để bạn xem và duyệt`
- **Line 107**: `{isVi ? 'Tiến độ sản xuất video' : 'Video Generation Progress'}`
- **Line 120**: `aria-label={isVi ? 'Tiến độ nhiệm vụ' : 'Mission Progress'}`
- **Line 166**: `{isVi ? stage.labelVi : stage.labelEn}`
- **Line 180**: `{isVi ? 'Quá trình xử lý tạm dừng' : 'Execution Interrupted'}`
- **Line 183**: `{errorMessage || (isVi ? 'Lỗi kết nối AI provider. Bấm thử lại an toàn.' : 'AI provider error. Retry safely.')}`
- **Line 194**: `{isVi ? 'Thử lại' : 'Retry'}`

#### D. `apps/sophia-ai-factory/src/land/missions/first-run-template.ts`
- Defined as `Record<TemplateId, FirstRunTemplate>` where each template contains `{ en: string, vi: string }` records for `name`, `description`, `badge`, `defaultTopic`, `suggestedPrompts`, and `callToAction`.
- Verified in `src/land/missions/__tests__/first-run-template.test.ts` (lines 56–67) and `src/__tests__/e2e/multi-track-video-pipeline.e2e.test.ts` (lines 575–611): unit tests assert `template.name.en`, `template.name.vi`, `template.badge.en`, `template.badge.vi` directly.

#### E. i18n Key Validator (`scripts/validate-i18n-keys.mjs`)
- **Lines 40–50**: Detects namespace via regex `/(?:useTranslations|getTranslations)\(['"`]([a-zA-Z_.-]+)['"`]\)/` or comment `// i18n-namespace: <ns>`.
- **Lines 66–74**: Extracts static keys `\bt\(['"`]([a-zA-Z0-9_.]+)['"`]\)` and constructs full path `${namespace}.${key}`.
- **Lines 76–90 & 174–192**: Dynamic template literals `t(`prefix.${variable}`)` require that the static prefix before `${` exists as an object path in `vi.json`.
- **Lines 162–167**: Every static key MUST exist in `messages/vi.json` (`getNestedValue(translations.vi, key) !== undefined`).

---

## 2. Logic Chain

1. **Namespace Coherence**:
   - In `apps/sophia-ai-factory/src/forest/components/missions/`, all mission-related components (`mission-control-header.tsx`, `agent-team-panel.tsx`, `task-feed.tsx`, `agent-team-configurator.tsx`) use `useTranslations('dashboard.missions.control')`.
   - In `messages/en.json` (line 995) and `messages/vi.json` (line 995), `"dashboard": { "missions": { ... } }` is the canonical block containing general mission keys and `"control": { ... }`.
   - Adding `"wizard": { ... }` inside `"dashboard": { "missions": { ... } }` maintains 100% architectural symmetry. Both `dashboard.missions.wizard` and `creativeStudio.wizard` are valid in `validate-i18n-keys.mjs`; `dashboard.missions.wizard` is recommended as canonical, and `creativeStudio.wizard` is provided as an exact alternative.

2. **Template Type Stability vs. UI Localization**:
   - Existing unit tests (`first-run-template.test.ts`) and E2E tests (`multi-track-video-pipeline.e2e.test.ts`) strictly assert that `FIRST_RUN_TEMPLATES[id].name.en` and `FIRST_RUN_TEMPLATES[id].name.vi` exist.
   - Removing `.en` and `.vi` from `first-run-template.ts` would cause regression failures across 10+ test assertions.
   - Therefore, `first-run-template.ts` should retain its typed `LocalizedString` properties, while `messages/en.json` and `messages/vi.json` provide the canonical centralized keys for template copy (`dashboard.missions.wizard.templates.*`). The UI components can access these via `t(`templates.${t.id}.name`)` or fall back to `t.name[locale]`.

3. **No-Jargon Compliance (CMO Persona)**:
   - In `AGENTS.md`, rule mandates: *"Customer-facing docs and UI copy must be bilingual Vietnamese + English. CMO: Must not use jargon in client-facing content."*
   - Audit of current copy revealed technical jargon in Vietnamese:
     - `"Soạn kịch bản SEO"` → replace with natural Vietnamese: `"Soạn kịch bản thu hút người xem"`
     - `"Lỗi kết nối AI provider"` → replace with: `"Lỗi kết nối dịch vụ AI. Thử lại an toàn."`
     - `"Bio"` → `"tiểu sử"`
     - `"Viral Shorts"` → `"Video ngắn lan tỏa"`
     - `"Affiliate"` → `"Tiếp thị liên kết"`
     - `"Zero hidden fees"` → `"Minh bạch 100%, không phí ẩn"`

---

## 3. Enumeration & Key Mapping Specification

Total strings audited: **45 distinct strings / ternaries**.

### Table of All Audited Strings

| # | File & Location | Current Expression / Ternary | Canonical next-intl Key | English Copy (`en.json`) | Vietnamese Copy (`vi.json`) |
|---|---|---|---|---|---|
| 1 | `new/page.tsx:26` | `isVi ? 'Tạo nhiệm vụ video mới...' : 'New Video Mission...'` | `metaTitle` | `"New Video Mission \| Sophia AI Factory"` | `"Tạo nhiệm vụ video mới \| Sophia AI Factory"` |
| 2 | `new/page.tsx:27` | `isVi ? 'Khởi tạo video đầu tiên...' : 'Launch your first...'` | `metaDescription` | `"Launch your first AI video with pre-tested templates and transparent pricing."` | `"Khởi tạo video đầu tiên của bạn với các mẫu tối ưu sẵn và chi phí minh bạch."` |
| 3 | `new/page.tsx:62` | `isVi ? 'Quay lại danh sách nhiệm vụ' : 'Back to Missions'` | `backToMissions` | `"Back to Missions"` | `"Quay lại danh sách nhiệm vụ"` |
| 4 | `new/page.tsx:69` | `isVi ? 'Tạo video đầu tiên của bạn' : 'Create Your First Video'` | `pageTitle` | `"Create Your First Video"` | `"Tạo video đầu tiên của bạn"` |
| 5 | `new/page.tsx:72` | `isVi ? 'Sophia sẽ tự động soạn...' : 'Sophia will autonomously...'` | `pageSubtitle` | `"Sophia will autonomously write scripts, synthesize voice, and composite video using your selected template."` | `"Sophia sẽ tự động soạn kịch bản, lồng tiếng và dựng video hoàn chỉnh theo mẫu bạn chọn."` |
| 6 | `first-run-wizard.tsx:102` | `isVi ? 'Nhập gì?' : 'What to enter?'` | `guide.q1_label` | `"1. What to enter?"` | `"1. Nhập gì?"` |
| 7 | `first-run-wizard.tsx:102` | `isVi ? 'Chọn mẫu hoặc chủ đề' : 'Pick a template/topic'` | `guide.q1_desc` | `"Pick a template or topic"` | `"Chọn mẫu hoặc chủ đề"` |
| 8 | `first-run-wizard.tsx:103` | `isVi ? 'Sophia làm gì?' : 'What Sophia does?'` | `guide.q2_label` | `"2. What Sophia does?"` | `"2. Sophia làm gì?"` |
| 9 | `first-run-wizard.tsx:103` | `isVi ? 'Kịch bản ➔ Giọng ➔ Ảnh ➔ Video' : 'Script ➔ Voice ➔ Video'` | `guide.q2_desc` | `"Script ➔ Voice ➔ Video"` | `"Kịch bản ➔ Giọng đọc ➔ Video hoàn chỉnh"` |
| 10 | `first-run-wizard.tsx:104` | `isVi ? 'Thời gian?' : 'Duration?'` | `guide.q3_label` | `"3. Duration?"` | `"3. Thời gian?"` |
| 11 | `first-run-wizard.tsx:104` | `45 - 90 {isVi ? 'giây' : 'seconds'}` | `guide.q3_desc` | `"45 - 90 seconds"` | `"45 - 90 giây"` |
| 12 | `first-run-wizard.tsx:105` | `isVi ? 'Chi phí?' : 'Cost?'` | `guide.q4_label` | `"4. Cost?"` | `"4. Chi phí?"` |
| 13 | `first-run-wizard.tsx:105` | `~${costEstimate.totalUsd} / {costEstimate.totalMcu} MCU` | `guide.q4_desc` | `"~${usd} / {mcu} MCU"` | `"~${usd} USD / {mcu} MCU"` |
| 14 | `first-run-wizard.tsx:106` | `isVi ? 'Kết quả ở đâu?' : 'Where shown?'` | `guide.q5_label` | `"5. Where shown?"` | `"5. Kết quả ở đâu?"` |
| 15 | `first-run-wizard.tsx:106` | `isVi ? 'Trực tiếp tại trang này' : 'Live preview & Review'` | `guide.q5_desc` | `"Live preview & Review"` | `"Trực tiếp tại trang này"` |
| 16 | `first-run-wizard.tsx:133` | `isVi ? 'Chọn mẫu kịch bản tối ưu sẵn' : 'Choose a Proven Template'` | `templateSelectLabel` | `"Choose a Proven Template"` | `"Chọn mẫu kịch bản tối ưu sẵn"` |
| 17 | `first-run-wizard.tsx:147` | `isVi ? 'Chủ đề hoặc Ý tưởng của bạn' : 'Topic or Video Concept'` | `topicLabel` | `"Topic or Video Concept"` | `"Chủ đề hoặc ý tưởng video của bạn"` |
| 18 | `first-run-wizard.tsx:148` | `selectedTemplate.defaultTopic[locale]` | `topicPlaceholder` | `"Enter topic or select from suggestions below"` | `"Nhập chủ đề hoặc chọn gợi ý bên dưới"` |
| 19 | `first-run-wizard.tsx:161` | `~${costEstimate.totalUsd} USD ({costEstimate.totalMcu} MCU)` | `costEstimate` | `"~${usd} USD ({mcu} MCU)"` | `"~${usd} USD ({mcu} MCU)"` |
| 20 | `first-run-wizard.tsx:162` | `45 - 90 {isVi ? 'giây' : 'seconds'}` | `durationEstimate` | `"45 - 90 seconds"` | `"45 - 90 giây"` |
| 21 | `first-run-wizard.tsx:164` | `isVi ? 'Minh bạch 100% không phí ẩn' : 'Zero Hidden Fees'` | `zeroHiddenFees` | `"Zero Hidden Fees"` | `"Minh bạch 100%, không phí ẩn"` |
| 22 | `first-run-wizard.tsx:170` | `isVi ? 'Bắt đầu sản xuất video ngay' : 'Launch Video Mission Now'` | `launchButton` | `"Launch Video Mission Now"` | `"Bắt đầu sản xuất video ngay"` |
| 23 | `first-run-wizard.tsx:93` | `isVi ? 'Không thể khởi chạy nhiệm vụ...' : 'Failed to launch...'` | `launchError` | `"Failed to launch mission. Please retry."` | `"Không thể khởi chạy nhiệm vụ. Vui lòng thử lại."` |
| 24 | `first-run-wizard.tsx:116` | `isVi ? 'Video đầu tiên đã hoàn tất!' : 'First Video Ready!'` | `successTitle` | `"First Video Ready!"` | `"Video đầu tiên đã hoàn tất!"` |
| 25 | `first-run-wizard.tsx:117` | `isVi ? 'Video đã được dựng...' : 'Video is composited...'` | `successDescription` | `"Video is composited and ready for your approval in the Review Console."` | `"Video đã được dựng hoàn chỉnh và sẵn sàng để bạn duyệt trong bảng kiểm duyệt."` |
| 26 | `first-run-wizard.tsx:120` | `isVi ? 'Xem & Duyệt Video' : 'Review Video'` | `reviewButton` | `"Review Video"` | `"Xem & Duyệt Video"` |
| 27 | `first-run-wizard.tsx:123` | `isVi ? 'Tạo video khác' : 'Create Another'` | `createAnotherButton` | `"Create Another"` | `"Tạo video khác"` |
| 28 | `mission-progress-bar.tsx:107` | `isVi ? 'Tiến độ sản xuất video' : 'Video Generation Progress'` | `progressTitle` | `"Video Generation Progress"` | `"Tiến độ sản xuất video"` |
| 29 | `mission-progress-bar.tsx:120` | `isVi ? 'Tiến độ nhiệm vụ' : 'Mission Progress'` | `progressAriaLabel` | `"Mission Progress"` | `"Tiến độ nhiệm vụ"` |
| 30 | `mission-progress-bar.tsx:34` | `labelEn: 'Script Generation'`, `labelVi: 'Soạn kịch bản SEO'` | `stages.script_generation.label` | `"Script Generation"` | `"Soạn kịch bản thu hút"` |
| 31 | `mission-progress-bar.tsx:36` | `descEn: 'Writing high-retention...'`, `descVi: 'Soạn kịch bản...'` | `stages.script_generation.desc` | `"Writing high-retention script with OpenRouter"` | `"Soạn kịch bản giữ chân người xem bằng trí tuệ nhân tạo"` |
| 32 | `mission-progress-bar.tsx:43` | `labelEn: 'Voice Synthesis'`, `labelVi: 'Lồng tiếng AI'` | `stages.voice_synthesis.label` | `"Voice Synthesis"` | `"Lồng tiếng AI"` |
| 33 | `mission-progress-bar.tsx:45` | `descEn: 'Synthesizing voiceover...'`, `descVi: 'Tạo giọng đọc...'` | `stages.voice_synthesis.desc` | `"Synthesizing voiceover with ElevenLabs"` | `"Tạo giọng đọc truyền cảm tự nhiên bằng ElevenLabs"` |
| 34 | `mission-progress-bar.tsx:52` | `labelEn: 'Visual Generation'`, `labelVi: 'Tạo hình ảnh AI'` | `stages.visual_generation.label` | `"Visual Generation"` | `"Tạo hình ảnh AI"` |
| 35 | `mission-progress-bar.tsx:54` | `descEn: 'Rendering scenes...'`, `descVi: 'Dựng khung cảnh...'` | `stages.visual_generation.desc` | `"Rendering scenes with fal.ai"` | `"Dựng khung cảnh điện ảnh sống động qua fal.ai"` |
| 36 | `mission-progress-bar.tsx:61` | `labelEn: 'Video Compositing'`, `labelVi: 'Ghép video & Phụ đề'` | `stages.video_compositing.label` | `"Video Compositing"` | `"Ghép video & Phụ đề"` |
| 37 | `mission-progress-bar.tsx:63` | `descEn: 'Assembling scenes...'`, `descVi: 'Ghép cảnh...'` | `stages.video_compositing.desc` | `"Assembling scenes, audio, and captions"` | `"Ghép cảnh, hòa âm và phụ đề chuyển động"` |
| 38 | `mission-progress-bar.tsx:70` | `labelEn: 'Ready for Review'`, `labelVi: 'Sẵn sàng duyệt'` | `stages.ready_for_review.label` | `"Ready for Review"` | `"Sẵn sàng duyệt"` |
| 39 | `mission-progress-bar.tsx:72` | `descEn: 'Video complete!...'`, `descVi: 'Video hoàn tất!...'` | `stages.ready_for_review.desc` | `"Video complete! Ready for one-click approval"` | `"Video hoàn tất! Sẵn sàng để bạn xem và duyệt ngay"` |
| 40 | `mission-progress-bar.tsx:180` | `isVi ? 'Quá trình xử lý tạm dừng' : 'Execution Interrupted'` | `interruptedTitle` | `"Execution Interrupted"` | `"Quá trình xử lý tạm dừng"` |
| 41 | `mission-progress-bar.tsx:183` | `isVi ? 'Lỗi kết nối AI provider...' : 'AI provider error...'` | `errorFallback` | `"AI provider error. Retry safely."` | `"Lỗi kết nối dịch vụ AI. Thử lại an toàn."` |
| 42 | `mission-progress-bar.tsx:194` | `isVi ? 'Thử lại' : 'Retry'` | `retryButton` | `"Retry"` | `"Thử lại"` |
| 43 | `first-run-template.ts:33` | `viral_shorts_explainer` metadata | `templates.viral_shorts_explainer.*` | See JSON below | See JSON below |
| 44 | `first-run-template.ts:78` | `affiliate_product_showcase` metadata | `templates.affiliate_product_showcase.*` | See JSON below | See JSON below |
| 45 | `first-run-template.ts:123` | `daily_news_wisdom` metadata | `templates.daily_news_wisdom.*` | See JSON below | See JSON below |

---

## 4. Canonical JSON Structures

### 4.1 Primary Recommendation: Under `dashboard.missions.wizard`

#### Insertion for `apps/sophia-ai-factory/messages/en.json` (inside `"dashboard": { "missions": { ... } }`):
```json
      "wizard": {
        "metaTitle": "New Video Mission | Sophia AI Factory",
        "metaDescription": "Launch your first AI video with pre-tested templates and transparent pricing.",
        "backToMissions": "Back to Missions",
        "pageTitle": "Create Your First Video",
        "pageSubtitle": "Sophia will autonomously write scripts, synthesize voice, and composite video using your selected template.",
        "guide": {
          "q1_label": "1. What to enter?",
          "q1_desc": "Pick a template or topic",
          "q2_label": "2. What Sophia does?",
          "q2_desc": "Script ➔ Voice ➔ Video",
          "q3_label": "3. Duration?",
          "q3_desc": "45 - 90 seconds",
          "q4_label": "4. Cost?",
          "q4_desc": "~${usd} / {mcu} MCU",
          "q5_label": "5. Where shown?",
          "q5_desc": "Live preview & Review"
        },
        "templateSelectLabel": "Choose a Proven Template",
        "topicLabel": "Topic or Video Concept",
        "topicPlaceholder": "Enter topic or select from suggestions below",
        "costEstimate": "~${usd} USD ({mcu} MCU)",
        "durationEstimate": "45 - 90 seconds",
        "zeroHiddenFees": "Zero Hidden Fees",
        "launchButton": "Launch Video Mission Now",
        "launching": "Launching mission...",
        "launchError": "Failed to launch mission. Please retry.",
        "successTitle": "First Video Ready!",
        "successDescription": "Video is composited and ready for your approval in the Review Console.",
        "reviewButton": "Review Video",
        "createAnotherButton": "Create Another",
        "progressTitle": "Video Generation Progress",
        "progressAriaLabel": "Mission Progress",
        "interruptedTitle": "Execution Interrupted",
        "errorFallback": "AI provider error. Retry safely.",
        "retryButton": "Retry",
        "stages": {
          "script_generation": {
            "label": "Script Generation",
            "desc": "Writing high-retention script with OpenRouter"
          },
          "voice_synthesis": {
            "label": "Voice Synthesis",
            "desc": "Synthesizing voiceover with ElevenLabs"
          },
          "visual_generation": {
            "label": "Visual Generation",
            "desc": "Rendering scenes with fal.ai"
          },
          "video_compositing": {
            "label": "Video Compositing",
            "desc": "Assembling scenes, audio, and captions"
          },
          "ready_for_review": {
            "label": "Ready for Review",
            "desc": "Video complete! Ready for one-click approval"
          }
        },
        "templates": {
          "viral_shorts_explainer": {
            "name": "Viral Shorts Explainer",
            "description": "60-second high-retention video with dynamic voiceover and fast-paced visual storytelling.",
            "badge": "High Retention (60s)",
            "defaultTopic": "5 Psychological Tricks That Make People Instantly Like You",
            "prompt0": "3 Morning Habits of High-Performing Founders",
            "prompt1": "How AI Automation is Transforming Video Creation in 2026",
            "prompt2": "The 80/20 Rule for Scaling Personal Productivity",
            "callToAction": "Follow for daily high-value growth insights"
          },
          "affiliate_product_showcase": {
            "name": "Affiliate Product Showcase",
            "description": "30-second TikTok format focused on problem-solution and conversion-driven CTA overlay.",
            "badge": "High Conversion (30s)",
            "defaultTopic": "Ergonomic Desk Gadget That Fixed My Posture in 7 Days",
            "prompt0": "The Minimalist Tech Gear Every Remote Worker Needs",
            "prompt1": "Ultra-Fast Wireless Charger Review in 30 Seconds",
            "prompt2": "Budget Productivity Monitor Setup Under $200",
            "callToAction": "Tap the link in bio to grab yours today with special discount"
          },
          "daily_news_wisdom": {
            "name": "Daily News & Wisdom",
            "description": "45-second YouTube Shorts format with automated visuals and bite-sized wisdom.",
            "badge": "Daily Evergreen (45s)",
            "defaultTopic": "The Power of Compounding: 1% Better Every Single Day",
            "prompt0": "Why Warren Buffett Reads 500 Pages Every Day",
            "prompt1": "The 2-Minute Rule to Beat Procrastination Forever",
            "prompt2": "Top 3 AI Breakthroughs This Week in 45 Seconds",
            "callToAction": "Save this video and share with someone who needs it"
          }
        }
      }
```

#### Insertion for `apps/sophia-ai-factory/messages/vi.json` (inside `"dashboard": { "missions": { ... } }`):
```json
      "wizard": {
        "metaTitle": "Tạo nhiệm vụ video mới | Sophia AI Factory",
        "metaDescription": "Khởi tạo video đầu tiên của bạn với các mẫu tối ưu sẵn và chi phí minh bạch.",
        "backToMissions": "Quay lại danh sách nhiệm vụ",
        "pageTitle": "Tạo video đầu tiên của bạn",
        "pageSubtitle": "Sophia sẽ tự động soạn kịch bản, lồng tiếng và dựng video hoàn chỉnh theo mẫu bạn chọn.",
        "guide": {
          "q1_label": "1. Nhập gì?",
          "q1_desc": "Chọn mẫu hoặc chủ đề",
          "q2_label": "2. Sophia làm gì?",
          "q2_desc": "Kịch bản ➔ Giọng đọc ➔ Video hoàn chỉnh",
          "q3_label": "3. Thời gian?",
          "q3_desc": "45 - 90 giây",
          "q4_label": "4. Chi phí?",
          "q4_desc": "~${usd} USD / {mcu} MCU",
          "q5_label": "5. Kết quả ở đâu?",
          "q5_desc": "Trực tiếp tại trang này"
        },
        "templateSelectLabel": "Chọn mẫu kịch bản tối ưu sẵn",
        "topicLabel": "Chủ đề hoặc ý tưởng video của bạn",
        "topicPlaceholder": "Nhập chủ đề hoặc chọn gợi ý bên dưới",
        "costEstimate": "~${usd} USD ({mcu} MCU)",
        "durationEstimate": "45 - 90 giây",
        "zeroHiddenFees": "Minh bạch 100%, không phí ẩn",
        "launchButton": "Bắt đầu sản xuất video ngay",
        "launching": "Đang khởi chạy nhiệm vụ...",
        "launchError": "Không thể khởi chạy nhiệm vụ. Vui lòng thử lại.",
        "successTitle": "Video đầu tiên đã hoàn tất!",
        "successDescription": "Video đã được dựng hoàn chỉnh và sẵn sàng để bạn duyệt trong bảng kiểm duyệt.",
        "reviewButton": "Xem & Duyệt Video",
        "createAnotherButton": "Tạo video khác",
        "progressTitle": "Tiến độ sản xuất video",
        "progressAriaLabel": "Tiến độ nhiệm vụ",
        "interruptedTitle": "Quá trình xử lý tạm dừng",
        "errorFallback": "Lỗi kết nối dịch vụ AI. Thử lại an toàn.",
        "retryButton": "Thử lại",
        "stages": {
          "script_generation": {
            "label": "Soạn kịch bản thu hút",
            "desc": "Soạn kịch bản giữ chân người xem bằng trí tuệ nhân tạo"
          },
          "voice_synthesis": {
            "label": "Lồng tiếng AI",
            "desc": "Tạo giọng đọc truyền cảm tự nhiên bằng ElevenLabs"
          },
          "visual_generation": {
            "label": "Tạo hình ảnh AI",
            "desc": "Dựng khung cảnh điện ảnh sống động qua fal.ai"
          },
          "video_compositing": {
            "label": "Ghép video & Phụ đề",
            "desc": "Ghép cảnh, hòa âm và phụ đề chuyển động"
          },
          "ready_for_review": {
            "label": "Sẵn sàng duyệt",
            "desc": "Video hoàn tất! Sẵn sàng để bạn xem và duyệt ngay"
          }
        },
        "templates": {
          "viral_shorts_explainer": {
            "name": "Video giải thích lan tỏa ngắn",
            "description": "Video 60 giây giữ chân cao với giọng đọc sống động và hình ảnh chuyển cảnh hấp dẫn.",
            "badge": "Giữ chân cao (60s)",
            "defaultTopic": "5 Mẹo tâm lý giúp bạn tạo thiện cảm tức thì",
            "prompt0": "3 Thói quen buổi sáng của các nhà sáng lập hàng đầu",
            "prompt1": "Tự động hóa AI đang thay đổi ngành sáng tạo video năm 2026 ra sao",
            "prompt2": "Nguyên lý 80/20 trong tối ưu hiệu suất cá nhân",
            "callToAction": "Bấm theo dõi để nhận kiến thức giá trị mỗi ngày"
          },
          "affiliate_product_showcase": {
            "name": "Giới thiệu sản phẩm tiếp thị liên kết",
            "description": "Video 30 giây chuẩn định dạng TikTok tập trung giải quyết vấn đề và kích thích mua hàng.",
            "badge": "Chuyển đổi cao (30s)",
            "defaultTopic": "Thiết bị công thái học giúp cải thiện tư thế sau 7 ngày",
            "prompt0": "Phụ kiện công nghệ tối giản mọi người làm việc từ xa đều cần",
            "prompt1": "Đánh giá sạc không dây siêu tốc trong 30 giây",
            "prompt2": "Góc làm việc hai màn hình tiết kiệm dưới 200 đô",
            "callToAction": "Nhấn vào liên kết ở tiểu sử để nhận ưu đãi hôm nay"
          },
          "daily_news_wisdom": {
            "name": "Tin tức & Tri thức mỗi ngày",
            "description": "Video 45 giây định dạng YouTube Shorts với hình ảnh tự động và bài học súc tích.",
            "badge": "Nội dung thường xanh (45s)",
            "defaultTopic": "Sức mạnh của lãi kép: Tốt hơn 1% mỗi ngày",
            "prompt0": "Tại sao Warren Buffett đọc 500 trang sách mỗi ngày",
            "prompt1": "Quy tắc 2 phút để đánh bại sự trì hoãn vĩnh viễn",
            "prompt2": "Top 3 đột phá AI nổi bật tuần này trong 45 giây",
            "callToAction": "Lưu video này và chia sẻ cho người bạn quan tâm"
          }
        }
      }
```

---

### 4.2 Alternative Schema: Under `creativeStudio.wizard`

If the orchestrator chooses `creativeStudio.wizard` instead of `dashboard.missions.wizard`, the exact same object is placed under `"creativeStudio": { "wizard": { ... } }` in both `messages/en.json` and `messages/vi.json`. Components would then import `useTranslations('creativeStudio.wizard')`.

---

## 5. Code Refactoring Implementation Guide

### 5.1 `apps/sophia-ai-factory/src/app/[locale]/dashboard/missions/new/page.tsx`
```tsx
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { ensureCustomerOrg } from '@/tree/handover/handover-account-setup';
import { FirstRunWizard } from '@/components/missions/first-run-wizard';
import { Link } from '@/navigation';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.missions.wizard');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function NewMissionPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations('dashboard.missions.wizard');

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const d1 = await getD1();
  let workspaceId = '';

  if (d1) {
    workspaceId = (await resolveOrgId(user.id, d1)) || '';
    if (!workspaceId) {
      workspaceId = await ensureCustomerOrg(d1, user.id, user.email || user.id);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      {/* Back to Missions List */}
      <div className="mb-6">
        <Link
          href="/dashboard/missions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('backToMissions')}
        </Link>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t('pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pageSubtitle')}
        </p>
      </div>

      {/* First Run Wizard Component */}
      <FirstRunWizard
        workspaceId={workspaceId}
        userId={user.id}
        locale={locale as 'vi' | 'en'}
      />
    </div>
  );
}
```

### 5.2 `apps/sophia-ai-factory/src/components/missions/first-run-wizard.tsx`
```tsx
'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Clock, Coins, CheckCircle2, ArrowRight, Video } from 'lucide-react';
import { Link } from '@/navigation';
import {
  getFirstRunTemplates,
  type FirstRunTemplate,
} from '@/land/missions/first-run-template';
import { estimateTemplateCost } from '@/land/missions/cost-estimator';
import { MissionProgressBar, type MissionStageId } from './mission-progress-bar';
import { createMission, startMissionExecution } from '@/land/creative-mission/actions';

export interface FirstRunWizardProps {
  workspaceId: string;
  userId: string;
  locale?: 'vi' | 'en';
}

export function FirstRunWizard({ workspaceId, locale = 'vi' }: FirstRunWizardProps) {
  const t = useTranslations('dashboard.missions.wizard');
  const templates = getFirstRunTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<FirstRunTemplate>(templates[0]);
  const [topic, setTopic] = useState<string>(selectedTemplate.defaultTopic[locale]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [currentStage, setCurrentStage] = useState<MissionStageId>('SCRIPT_GENERATION');
  const [missionId, setMissionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const costEstimate = estimateTemplateCost(selectedTemplate.id);

  const handleSelectTemplate = (tmpl: FirstRunTemplate) => {
    setSelectedTemplate(tmpl);
    setTopic(tmpl.defaultTopic[locale]);
  };

  const handleLaunch = async () => {
    setStatus('running');
    setCurrentStage('SCRIPT_GENERATION');
    setErrorMessage('');

    try {
      const now = Math.floor(Date.now() / 1000);
      const createRes = await createMission({
        workspaceId,
        title: topic || selectedTemplate.name[locale],
        objective: `Generate autonomous ${selectedTemplate.durationSeconds}s video for ${selectedTemplate.targetPlatform}. Topic: ${topic}`,
        audience: 'General interest mobile viewers',
        geography: locale === 'vi' ? 'Vietnam' : 'Global',
        timeframeStart: now,
        timeframeEnd: now + 3600,
        budgetCents: Math.round(costEstimate.totalUsd * 100),
        autonomyLevel: 1,
        channels: [selectedTemplate.targetPlatform],
        monetizationGoals: ['ad_revenue', 'affiliate_commissions'],
        constraints: {},
        successMetrics: { views: 1000, engagement_rate: 0.05 },
      });

      if (!createRes.ok) {
        setStatus('failed');
        setErrorMessage(createRes.error.message);
        return;
      }

      const newId = createRes.value.missionId;
      setMissionId(newId);

      await startMissionExecution({
        missionId: newId,
        agentId: 'agent_director',
        autonomyLevel: 1,
      });

      setTimeout(() => setCurrentStage('VOICE_SYNTHESIS'), 1200);
      setTimeout(() => setCurrentStage('VISUAL_GENERATION'), 2400);
      setTimeout(() => setCurrentStage('VIDEO_COMPOSITING'), 3600);
      setTimeout(() => {
        setCurrentStage('READY_FOR_REVIEW');
        setStatus('completed');
      }, 4800);
    } catch {
      setStatus('failed');
      setErrorMessage(t('launchError'));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 5 Questions CEO Guide */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <p className="font-semibold text-primary">{t('guide.q1_label')}</p>
            <p className="text-muted-foreground">{t('guide.q1_desc')}</p>
          </div>
          <div>
            <p className="font-semibold text-primary">{t('guide.q2_label')}</p>
            <p className="text-muted-foreground">{t('guide.q2_desc')}</p>
          </div>
          <div>
            <p className="font-semibold text-primary">{t('guide.q3_label')}</p>
            <p className="text-muted-foreground">{t('guide.q3_desc')}</p>
          </div>
          <div>
            <p className="font-semibold text-primary">{t('guide.q4_label')}</p>
            <p className="text-muted-foreground">
              {t('guide.q4_desc', { usd: costEstimate.totalUsd, mcu: costEstimate.totalMcu })}
            </p>
          </div>
          <div>
            <p className="font-semibold text-primary">{t('guide.q5_label')}</p>
            <p className="text-muted-foreground">{t('guide.q5_desc')}</p>
          </div>
        </div>
      </div>

      {status !== 'idle' ? (
        <div className="space-y-4">
          <MissionProgressBar currentStage={currentStage} status={status} errorMessage={errorMessage} onRetry={handleLaunch} locale={locale} />
          {status === 'completed' && (
            <div className="rounded-xl border border-primary/30 bg-card p-6 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h3 className="text-lg font-bold text-foreground">{t('successTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('successDescription')}</p>
              <div className="flex justify-center gap-3 pt-2">
                <Link href={`/dashboard/missions/${missionId}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <Video className="h-4 w-4" /> {t('reviewButton')}
                </Link>
                <button type="button" onClick={() => setStatus('idle')} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                  {t('createAnotherButton')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
          {/* Template Selection */}
          <div>
            <label className="text-sm font-semibold text-foreground">{t('templateSelectLabel')}</label>
            <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`text-left rounded-lg p-3.5 border transition ${
                    selectedTemplate.id === tmpl.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {tmpl.badge[locale]}
                  </span>
                  <h4 className="mt-1 font-semibold text-sm text-foreground">{tmpl.name[locale]}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{tmpl.description[locale]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Topic Input with sample pills */}
          <div>
            <label className="text-sm font-semibold text-foreground">{t('topicLabel')}</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={selectedTemplate.defaultTopic[locale] || t('topicPlaceholder')}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedTemplate.suggestedPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTopic(p[locale])}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
                >
                  + {p[locale]}
                </button>
              ))}
            </div>
          </div>

          {/* Transparent Preflight Cost & Latency */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3.5 border border-border/60 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Coins className="h-4 w-4 text-primary" /> {t('costEstimate', { usd: costEstimate.totalUsd, mcu: costEstimate.totalMcu })}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" /> {t('durationEstimate')}
              </span>
            </div>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
              ✓ {t('zeroHiddenFees')}
            </span>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={handleLaunch}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-[0.99]"
          >
            <Sparkles className="h-4 w-4" />
            {t('launchButton')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
```

### 5.3 `apps/sophia-ai-factory/src/components/missions/mission-progress-bar.tsx`
```tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export type MissionStageId =
  | 'SCRIPT_GENERATION'
  | 'VOICE_SYNTHESIS'
  | 'VISUAL_GENERATION'
  | 'VIDEO_COMPOSITING'
  | 'READY_FOR_REVIEW';

export type StageKey =
  | 'script_generation'
  | 'voice_synthesis'
  | 'visual_generation'
  | 'video_compositing'
  | 'ready_for_review';

export interface StageDefinition {
  id: MissionStageId;
  stageKey: StageKey;
  stepNumber: number;
  percent: number;
}

export const MISSION_STAGES: StageDefinition[] = [
  { id: 'SCRIPT_GENERATION', stageKey: 'script_generation', stepNumber: 1, percent: 20 },
  { id: 'VOICE_SYNTHESIS', stageKey: 'voice_synthesis', stepNumber: 2, percent: 40 },
  { id: 'VISUAL_GENERATION', stageKey: 'visual_generation', stepNumber: 3, percent: 65 },
  { id: 'VIDEO_COMPOSITING', stageKey: 'video_compositing', stepNumber: 4, percent: 90 },
  { id: 'READY_FOR_REVIEW', stageKey: 'ready_for_review', stepNumber: 5, percent: 100 },
];

export interface MissionProgressBarProps {
  currentStage: MissionStageId;
  status: 'idle' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  onRetry?: () => void;
  locale?: 'vi' | 'en';
  customPercent?: number;
}

export function MissionProgressBar({
  currentStage,
  status,
  errorMessage,
  onRetry,
  customPercent,
}: MissionProgressBarProps) {
  const t = useTranslations('dashboard.missions.wizard');
  const currentIndex = MISSION_STAGES.findIndex((s) => s.id === currentStage);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentDef = MISSION_STAGES[activeIndex] ?? MISSION_STAGES[0];
  const percent = status === 'completed' ? 100 : (customPercent ?? currentDef.percent);

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header & Percentage */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('progressTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">{t(`stages.${currentDef.stageKey}.desc`)}</p>
        </div>
        <span className="text-lg font-bold text-primary">{percent}%</span>
      </div>

      {/* Progress Bar Container */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('progressAriaLabel')}
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full transition-all duration-500 ease-out ${
            status === 'failed' ? 'bg-destructive' : 'bg-primary'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 5 Stages Flow Indicator */}
      <div className="grid grid-cols-5 gap-1.5 pt-1">
        {MISSION_STAGES.map((stage, idx) => {
          const isPast = idx < activeIndex || status === 'completed';
          const isCurrent = idx === activeIndex && status !== 'completed';
          const isFailed = isCurrent && status === 'failed';

          return (
            <div key={stage.id} className="flex flex-col items-center text-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  isFailed
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : isPast
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                    ? 'border-primary bg-primary/20 text-primary ring-2 ring-primary/30'
                    : 'border-border bg-muted/40 text-muted-foreground'
                }`}
              >
                {isFailed ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : isPast ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isCurrent && status === 'running' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  stage.stepNumber
                )}
              </div>
              <span
                className={`mt-1.5 line-clamp-1 text-[10px] font-medium ${
                  isFailed ? 'text-destructive' : isCurrent || isPast ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {t(`stages.${stage.stageKey}.label`)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error State with Meaningful Feedback & Retry Path */}
      {status === 'failed' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <h4 className="text-xs font-semibold text-destructive">
                {t('interruptedTitle')}
              </h4>
              <p className="text-[11px] text-foreground/80 mt-0.5">
                {errorMessage || t('errorFallback')}
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 active:scale-95"
            >
              <RefreshCw className="h-3 w-3" />
              {t('retryButton')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 6. Caveats

1. **Test Assertions on `FIRST_RUN_TEMPLATES`**:
   - `apps/sophia-ai-factory/src/land/missions/__tests__/first-run-template.test.ts` and `apps/sophia-ai-factory/src/__tests__/e2e/multi-track-video-pipeline.e2e.test.ts` assert direct properties (`template.name.en`, `template.name.vi`, `template.badge.en`, `template.badge.vi`, etc.).
   - `FIRST_RUN_TEMPLATES` in `first-run-template.ts` must maintain backward compatibility by keeping these bilingual object fields in code. The UI components must be the only layer switching to `t()` keys.
2. **Dynamic Key Resolution in `scripts/validate-i18n-keys.mjs`**:
   - `validate-i18n-keys.mjs` handles dynamic template literal keys like `t(\`stages.\${currentDef.stageKey}.desc\`)` by verifying that the static prefix `stages.` is an object in `messages/vi.json`.
   - In the proposed schema, `stages` is an object under `dashboard.missions.wizard`, which satisfies rule A in `validate-i18n-keys.mjs` line 189 (`if (literalRemainder === '') continue`).
3. **Sandbox Restriction**:
   - Unsandboxed shell commands prompt the user and will time out in subagents. The validator logic was thoroughly verified by inspecting its AST parser regexes directly against the proposed JSON and TypeScript code.

---

## 7. Conclusion

The audit identified 45 user-facing strings and ternaries that can be eliminated in favor of clean, idiomatic `next-intl` translation keys. Placing these keys under `dashboard.missions.wizard` preserves architectural harmony with existing components (`src/forest/components/missions/` using `dashboard.missions.control`), removes hardcoded ternaries, eliminates technical jargon in Vietnamese copy, and complies with `validate-i18n-keys.mjs` validation gates.

---

## 8. Verification Method

To verify the implementation independently once applied:

1. **JSON Syntax & Structure Check**:
   - Verify `apps/sophia-ai-factory/messages/en.json` and `apps/sophia-ai-factory/messages/vi.json` are valid JSON:
     ```bash
     node -e "JSON.parse(fs.readFileSync('messages/en.json', 'utf8')); JSON.parse(fs.readFileSync('messages/vi.json', 'utf8')); console.log('Valid JSON')"
     ```
2. **i18n Key Validator Gate**:
   - Run the project's standard validator:
     ```bash
     npm run i18n:validate
     ```
   - Must output: `✅ All translation keys found!` with 0 missing static keys and 0 unresolved dynamic prefixes.
3. **TypeScript Typecheck**:
   - Run typecheck in `apps/sophia-ai-factory`:
     ```bash
     npm run type-check
     ```
   - Must pass with 0 errors.
4. **Unit and E2E Tests**:
   - Run the template unit tests:
     ```bash
     npx vitest run src/land/missions/__tests__/first-run-template.test.ts
     ```
   - Run the E2E pipeline test:
     ```bash
     npx vitest run src/__tests__/e2e/multi-track-video-pipeline.e2e.test.ts
     ```
   - All tests must pass 100%.
