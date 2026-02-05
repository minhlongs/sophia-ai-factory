# Phase 2: Telegram Bot Integration

**Goal**: Bi-directional communication channel for discovery.

## 1. Bot Setup
- [ ] Create Bot via @BotFather
- [ ] Get Token
- [ ] Set Webhook URL: `https://sophia-ai.com/api/webhooks/telegram`

## 2. Webhook Handler (`src/app/api/webhooks/telegram/route.ts`)
Implement command parser:
- `/start`: Check if user exists (link via unique code or email match if possible, for MVP simple ID match or "Enter your Sophia Email" flow).
- `/discover [niche]`:
  - Call `sophiaIndex.getTop50({ category: niche })`
  - Format Top 3 results as buttons/text.
- `/script [product_id]`:
  - Call `intelligence.generateScript(product_id)`
  - Return script text.

## 3. Linking Logic (`src/lib/telegram.ts`)
- Need a way to map Telegram Chat ID <-> Supabase User ID.
- **Migration**: Add `telegram_chat_id` to `auth.users` metadata OR create `user_profiles` table.
- **Preferred**: `user_profiles` table in Supabase.

**Task**: Create `supabase/migrations/004_user_profiles.sql`
```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT UNIQUE,
  settings JSONB DEFAULT '{}'
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- Policies...
```

## 4. Dependencies
- `telegraf` or just `fetch` for sending messages.
- Since it's a webhook, we just parse JSON body and use `fetch` to send replies to Telegram API.
