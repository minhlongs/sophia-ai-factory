# Phase 03 — Fix i18n Keys (Wizard UX Polish)

## Context Links

- Debugger §H4 + uncommitted autofill: [`../reports/debugger-260503-setup-wizard.md`](../reports/debugger-260503-setup-wizard.md)
- Working tree shows: `M apps/sophia-ai-factory/messages/en.json`, `M apps/sophia-ai-factory/messages/vi.json` (autofilled, uncommitted)
- Sophia rule (i18n): `~/.claude/CLAUDE.md` Rule 8 — i18n SYNC PROTOCOL

## Overview

- **Priority:** P2 (UX, NOT blocker but customer-facing)
- **Status:** ✅ complete
- **ETA:** 30m
- **Brief:** Commit autofilled keys + manual VN review for 15 keys to replace English placeholders ("Ai Keys", "Launch", "Title") with proper Vietnamese strings.

## Key Insights

- 15 keys missing in `setupWizard.*` namespace
- `npm run i18n:autofill` produces draft VN strings — must be reviewed (machine translation often awkward)
- Client = non-tech CEO (Sophia handover rule) → strings MUST sound natural Vietnamese
- Bilingual: vi.json + en.json synced (Sophia handover rule)

## Requirements

**Functional:**
- All `t('setupWizard.*')` calls in `apps/sophia-ai-factory/src/app/setup-wizard/**` resolve to non-key strings
- vi.json + en.json have IDENTICAL key paths (no missing keys either side)

**Non-functional:**
- Vietnamese strings sound natural (not literal MT)
- Tone: friendly + clear (CEO audience, not developer)
- No emoji unless original UI uses them

## Architecture

```
apps/sophia-ai-factory/src/app/setup-wizard/
  ├── page.tsx          → uses useTranslations('setupWizard')
  └── layout.tsx        → metadata via getMessages

messages/
  ├── vi.json           → setupWizard: { header: { title }, stepper: {...}, actions: { launch }, ... }
  └── en.json           → setupWizard: { ... same keys ... }
```

## Related Code Files

**Modify:**
- `apps/sophia-ai-factory/messages/vi.json` — manual VN review of 15 autofilled keys
- `apps/sophia-ai-factory/messages/en.json` — verify keys present, polish if needed

**Verify (no edit):**
- `apps/sophia-ai-factory/src/app/setup-wizard/page.tsx`
- `apps/sophia-ai-factory/src/app/setup-wizard/layout.tsx`

## Implementation Steps

1. **Identify all `t('setupWizard.*')` calls:**
   ```bash
   cd apps/sophia-ai-factory
   grep -rohE "t\(['\"]setupWizard\.[^'\"]+['\"]" src/app/setup-wizard | sort -u
   ```
2. **Check key existence in both locales:**
   ```bash
   for key in $(grep -rohE "setupWizard\.[a-zA-Z._]+" src/app/setup-wizard | sort -u); do
     grep -q "\"${key##*.}\"" messages/vi.json || echo "MISSING vi: $key"
     grep -q "\"${key##*.}\"" messages/en.json || echo "MISSING en: $key"
   done
   ```
3. **Manual VN review:** Open vi.json diff, review each autofilled string. Replace machine-translation awkwardness:
   - "Ai Keys" → "Khóa API" (or "Cấu hình khóa API")
   - "Launch" → "Khởi chạy" or "Hoàn tất & Khởi chạy"
   - "Title" → context-dependent (header → "Tiêu đề", page → "Trang chủ")
   - Stepper labels: friendly + concise
4. **EN review:** ensure no key is empty string or contains `TODO`/`FIXME`
5. **Build + visual check:**
   ```bash
   cd apps/sophia-ai-factory
   npm run build
   npm run dev  # spot-check /setup-wizard renders correct strings
   ```
6. **Commit:** `fix(i18n): complete setupWizard VN/EN strings for handover UX`

## Todo List

- [x] Grep all `t('setupWizard.*')` calls (page.tsx + api-keys-step.tsx)
- [x] Diff current vi.json/en.json vs autofill draft
- [x] Manual VN review of 15 keys (natural language — header.title/subtitle, stepper.*, actions.*, alerts.*, footer)
- [x] EN polish (natural English, no placeholder strings)
- [x] Build passes (0 TS errors, 2458 tests pass)
- [ ] Local dev visual check (deferred — user handles browser test)
- [ ] Commit on feature branch (deferred — user handles)

## Success Criteria

- 0 keys missing in vi.json vs t() calls
- 0 keys missing in en.json vs t() calls
- 0 raw keys visible in browser at /setup-wizard
- VN strings reviewed (not raw MT)
- Build passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Awkward VN translation embarrasses client | Med | Med | Manual review by VN-native (or careful self-review) |
| Missed key in nested namespace | Low | Med | Run grep verification script |
| Translation breaks pluralization rules | Low | Low | Test with multiple values if `{count}` placeholder used |

## Security Considerations

- N/A — string literals only, no user input

## Next Steps

- Independent of Phase 02 (separate files) — can run in parallel
- Phase 04 includes i18n key existence check in test suite
