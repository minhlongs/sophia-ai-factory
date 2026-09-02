# ACCESS OWNERSHIP MATRIX — SOPHIA AI FACTORY

> Baseline SHA: `5dd1f071` | Generated: 2026-09-02
> Every system, credential, and service account mapped to an owner.
> Source of truth: **actual access** (who can log in), not documentation.

---

## Infrastructure Access

| System | URL / Console | Owner (Primary) | Owner (Backup) | Access Type | Notes |
|---|---|---|---|---|---|
| **Cloudflare Workers** | dash.cloudflare.com | Founder | Tech Lead (needs setup) | Personal login | 🔴 CRITICAL: No service account |
| **Cloudflare DNS** | dash.cloudflare.com | Founder | — | Personal login | 🔴 CRITICAL: Domain depends on founder |
| **Cloudflare D1** | dash.cloudflare.com | Founder | Tech Lead (needs setup) | Personal login | Database queries |
| **Cloudflare R2** | dash.cloudflare.com | Founder | Tech Lead (needs setup) | Personal login | Backup storage |
| **GitHub** | github.com/minhlongs/sophia-ai-factory | Founder | Tech Lead (needs invite) | Personal login | Repo admin |
| **Inngest** | app.inngest.com | Founder | Tech Lead (needs invite) | Personal login | Workflow dashboard |
| **Sentry** | sentry.io | Founder | Tech Lead (needs invite) | Personal login | Error monitoring |

---

## API Keys & Secrets (Environment Variables)

| Secret | Where Set | Owner | Rotation Cadence | Notes |
|---|---|---|---|---|
| `CRON_SECRET` | CF Dashboard | Founder | Unknown | 🔴 One-time setup; unknown if rotatable |
| `METRICS_BEARER_TOKEN` | CF Dashboard | Founder | Unknown | API metrics auth |
| `BETTER_AUTH_SECRET` | CF Dashboard | Founder | Unknown | Session signing |
| `OPENAI_API_KEY` | CF Dashboard | Founder | Per OpenAI policy | Platform AI (if used) |
| `NEXTAUTH_SECRET` | CF Dashboard | Founder | Unknown | Legacy session (if still set) |
| `INNGEST_SIGNING_KEY` | CF Dashboard | Founder | Per Inngest policy | Webhook verification |
| `INNGEST_EVENT_KEY` | CF Dashboard | Founder | Per Inngest policy | Event sending |
| `OPENROUTER_API_KEY` | CF Dashboard | Founder | Per OpenRouter | Platform fallback |
| `HEYGEN_API_KEY` | CF Dashboard | Founder | Per HeyGen | Platform fallback |
| `D_ID_API_KEY` | CF Dashboard | Founder | Per D-ID | Platform fallback |
| `ELEVENLABS_API_KEY` | CF Dashboard | Founder | Per ElevenLabs | Platform fallback |
| `TELEGRAM_BOT_TOKEN` | CF Dashboard | Founder | Unknown | @Sophia_Bbot |

---

## Customer-Facing Services

| Service | Owner | Access Type | Notes |
|---|---|---|---|
| **@Sophia_Bbot (Telegram)** | Founder | Bot token in CF | 🔴 CRITICAL: No shared ownership |
| **NOWPayments** | Founder | Personal login | Payment processing |
| **PayOS** | Founder | Personal login | Vietnam domestic backup |
| **Domain: agencyos.network** | Founder | Cloudflare DNS | Domain registration |

---

## Documentation & Knowledge

| Asset | Location | Owner | Access |
|---|---|---|---|
| **This document** | `docs/ceo-handover/` | CEO | Repo access |
| **Handover docs (18)** | `docs/ceo-handover/` | CEO | Repo access |
| **Operations docs** | `docs/operations/` | CEO | Repo access |
| **Source code** | `src/` | Tech Lead | GitHub access |
| **Deploy docs** | `docs/deploy/` | Tech Lead | GitHub access |

---

## Access Transfer Checklist

### Must Transfer Before Founder Absence

- [ ] Cloudflare: Create Tech Lead account with Workers/DNS/D1/R2 access
- [ ] GitHub: Add Tech Lead as repo admin
- [ ] Inngest: Invite Tech Lead
- [ ] Sentry: Invite Tech Lead
- [ ] NOWPayments: Share access or create sub-account
- [ ] Telegram bot: Transfer bot management or create shared access
- [ ] Domain registrar: Transfer or add Tech Lead
- [ ] CF Dashboard secrets: Document all env vars + values (password manager)
- [ ] `CRON_SECRET`: Verify Tech Lead can trigger cron endpoints
- [ ] Document any personal API accounts used for platform

### Founder Personal Accounts (BLOCKING)

| Account | Risk if Founder Unavailable | Mitigation |
|---|---|---|
| Cloudflare personal login | Cannot deploy, manage DNS, query D1 | 🔴 No mitigation — must transfer |
| GitHub personal login | Cannot merge PRs, manage repo | Add Tech Lead as admin |
| NOWPayments personal login | Cannot process refunds, check payments | Transfer or share |
| Telegram bot token | Cannot update webhook, manage bot | Token is in CF env; dashboard access needed |
| Domain registration | Cannot renew, transfer domain | Transfer to shared account |

---

## Gap Summary

| Category | Total Systems | Founder-Only | Shared | Gap |
|---|---|---|---|---|
| Infrastructure | 6 | 6 | 0 | 🔴 CRITICAL |
| API Keys/Secrets | 12 | 12 | 0 | 🔴 CRITICAL |
| Customer Services | 4 | 4 | 0 | 🔴 CRITICAL |
| Documentation | 4 | 0 | 4 | ✅ OK |
| **TOTAL** | **26** | **22** | **4** | **85% founder-dependent** |

---

## Recommendation

The founder's absence would leave **22 of 26 systems** inaccessible. Immediate action:

1. **Create shared/service accounts** for Cloudflare (highest priority)
2. **Add Tech Lead** to all platforms as admin/editor
3. **Export all secrets** to a password manager accessible by Tech Lead
4. **Transfer domain registration** to a shared account
5. **Document all access procedures** in this matrix

**Time to transfer:** Estimated 2–3 days of focused effort.

*Generated by CEO HANDOVER AUDIT, Phase 8.*