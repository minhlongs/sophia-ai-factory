# Supabase Migration Audit — sophia-ai-factory
## Date: 2026-03-28

## Summary
**20 files** directly import `@supabase`. NOT 140+ (earlier count included string references).
Middleware already migrated to D1 JWT. Auth login/signup already on D1.

## Categories

### AUTH (13 files) — Use createClient for data access
| File | Blocking? | Notes |
|------|-----------|-------|
| `lib/supabase/admin.ts` | Core | Admin client factory |
| `lib/supabase/client.ts` | Core | Browser client factory |
| `lib/supabase/server.ts` | Core | Server client factory |
| `lib/security/jwt-validator.ts` | Medium | Can use D1 auth-verify |
| `lib/services/template-service.ts` | Medium | Campaign templates |
| `lib/gateway/checkpoint-supabase-persistence.ts` | Low | Gateway checkpoints |
| `lib/inngest/functions/auto-discover-affiliates.ts` | Low | Background job |
| `lib/telegram/handlers/campaign-handler.ts` | Medium | Bot handler |
| `lib/telegram/handlers/email-handler.ts` | Medium | Bot handler |
| `lib/telegram/handlers/results-handler.ts` | Medium | Bot handler |
| `lib/telegram/handlers/status-handler.ts` | Medium | Bot handler |
| `lib/telegram/telegram-bot.ts` | Medium | Bot main |
| `lib/video/video-storage-service.ts` | Low | Video storage → R2 |

### DATA (1 file) — Direct Supabase queries
| File | Blocking? |
|------|-----------|
| `api/admin/usage/reconciliation/route.ts` | Low (admin only) |

### REALTIME (6 files) — Supabase Realtime subscriptions
| File | Blocking? |
|------|-----------|
| `dashboard/components/campaign-list.tsx` | Medium |
| `actions/campaigns.ts` | Medium |
| `actions/templates.ts` | Medium |
| `lib/alerts/supabase-realtime-alert-service.ts` | Low |
| `lib/inngest/functions/generate-campaign.ts` | Low |
| `worker/lib/realtime-alert-dispatcher.ts` | Low |

## Migration Priority

### Phase 1: Core client swap (2h)
Replace `lib/supabase/{admin,client,server}.ts` with D1 client wrappers.
All 13 AUTH files import from these 3 files. Fix 3 → fix 13.

### Phase 2: Realtime → polling (2h)
Replace 6 realtime subscriptions with interval polling or remove.

### Phase 3: Telegram handlers (1h)
4 telegram handlers use Supabase for campaign CRUD → swap to D1.

### Phase 4: Remove @supabase deps (30min)
Remove `@supabase/ssr` and `@supabase/supabase-js` from package.json.

## Total: ~6h (not 12h as estimated earlier)
