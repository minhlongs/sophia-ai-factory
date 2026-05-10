# Post-Mortems / Hồ Sơ Sự Cố

Archive of incident write-ups. Filing protocol: see `../postmortem-template.md`.

## Index

| Date | ID | Severity | Title | Duration |
|---|---|---|---|---|
| _(none yet — first incident write-up will appear here)_ | | | | |

---

## Filing Procedure / Quy Trình Lưu Trữ

1. Copy `../postmortem-template.md` → `docs/postmortems/{YYYY-MM-DD}-{slug}.md`
2. Fill all sections (bilingual where applicable)
3. Add a row to the index table above (newest first)
4. Open a PR with the postmortem; tag at least one reviewer
5. Track action items in the issue tracker — close postmortem only after items are filed (not necessarily completed)

## Conventions

- **Severity ordering**: `P0` outage > `P1` degraded > `P2` minor
- **Slug**: short kebab-case, e.g. `stripe-webhook-retries`, `d1-replication-lag`
- **Bilingual**: customer-facing summary in both EN + VN; technical detail can be EN-only

## Why Even Minor Incidents

The discipline of writing post-mortems is the value, not the document. Filing a write-up for a 15-min annoyance builds the reflex needed for the rare 4-hour P0. Bus factor 1 today → contractor onboarding next quarter relies on this archive being complete.
