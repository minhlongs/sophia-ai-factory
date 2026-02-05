# Go-Live Deployment Checklist

## Pre-Deployment
- [ ] **Environment Variables**: Configure in Vercel/Production environment
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_APP_URL` (Production URL)
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`
- [ ] **Database Migrations**: Run against production Supabase instance
  - `001_create_sophia_index.sql`
  - `002_api_security.sql`
  - `003_user_integrations.sql`
- [ ] **Telegram Bot**:
  - Create bot via BotFather
  - Run webhook setup script (or call endpoint) once deployed: `GET /api/setup/verify?action=telegram` (need to implement or run script locally pointing to prod)
  - Verify privacy settings in BotFather (allow groups if needed)

## Deployment
- [ ] **Build**: Ensure `npm run build` passes locally
- [ ] **Deploy**: Push to `main` branch
- [ ] **Verify**: Check Vercel deployment logs for errors

## Post-Deployment Verification
- [ ] **Telegram Webhook**: Send `/discover` command to bot
- [ ] **Integrations UI**: Go to `/admin/settings/integrations`, verify UI loads
- [ ] **API Check**: Curl `POST /api/webhooks/telegram` with secret to verify 200 OK (even with empty body)
- [ ] **Supabase RLS**: Verify users cannot access `user_integrations` table of others (via SQL editor test or app usage)

## Rollback Plan
- If Telegram webhook fails, disable bot via BotFather or remove webhook
- If database migration fails, revert `003` migration using `DROP TABLE user_integrations`

## Support
- Monitor server logs for `Telegram webhook error`
- Check `user_integrations` table for new entries
