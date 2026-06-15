# Sophia Vendor Register

Last updated: 2026-05-13

| Vendor | Purpose | Data Category | Secret Location | Owner | Status |
|---|---|---|---|---|---|
| Cloudflare Workers | Production hosting/API runtime | App metadata, request logs | Cloudflare dashboard secrets | Engineering | Active |
| Cloudflare D1 | Application database | Account, usage, billing metadata | Cloudflare dashboard | Engineering | Active |
| Cloudflare R2 | Media/object storage if enabled | Generated assets and exports | Cloudflare dashboard secrets | Engineering | Active |
| Better Auth | Application authentication | User/session metadata | App config and D1 | Engineering | Active |
| NOWPayments | Crypto/USDT checkout | Payment metadata | Cloudflare secrets | Operations | Active |
| PayOS | VietQR/bank transfer checkout | Payment metadata | Cloudflare secrets | Operations | Active |
| OpenRouter | LLM routing | Prompts and generated text | User BYOK or Cloudflare secrets for platform flows | Engineering | Active |
| HeyGen | Avatar video generation | Video inputs/assets | User BYOK or Cloudflare secrets for platform flows | Engineering | Active |
| ElevenLabs | Voice generation | Text/audio | User BYOK or Cloudflare secrets for platform flows | Engineering | Active |
| MuAPI | Optional media generation | Prompt/media metadata | User BYOK or Cloudflare secrets for platform flows | Engineering | Optional |
| Resend | Email delivery | Email addresses and messages | Cloudflare secrets or user BYOK | Operations | Optional |
| Better Stack/PostHog/Sentry | Monitoring/analytics | Logs, events, errors | Provider dashboards | Engineering | Pending confirmation |

## Vendor Review Rules

- Keep customer secrets out of git and docs.
- Rotate provider secrets using `docs/secret-rotation-runbook.md`.
- Review vendor access monthly during launch phase.
- Disable unused providers before public launch.
- Document any new vendor here before production use.
