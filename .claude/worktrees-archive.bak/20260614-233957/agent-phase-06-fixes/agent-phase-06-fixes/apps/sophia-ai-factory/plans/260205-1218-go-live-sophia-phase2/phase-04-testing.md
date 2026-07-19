# Phase 4: Testing & Verification

**Goal**: Ensure E2E reliability.

## 1. Payment Flow
- [ ] Simulate Polar purchase (Sandbox).
- [ ] Verify Webhook receives event.
- [ ] Verify User Tier upgrades to `ENTERPRISE` (or relevant tier).
- [ ] Verify UI reflects new tier.

## 2. Telegram Flow
- [ ] Send `/start` -> Bot asks for Email.
- [ ] User replies Email -> Bot sends OTP (mock or real) OR Bot says "Go to Settings > Telegram to link".
- [ ] Send `/discover health` -> Returns Top products.
- [ ] Click "Generate Script" -> Returns script.

## 3. Security Check
- [ ] Verify User A cannot access User B's keys (RLS check).
- [ ] Verify Anon cannot access `user_integrations`.
- [ ] Verify API routes require Authentication.

## 4. Deployment
- [ ] Final `npm run build` check.
- [ ] Environment variable audit.
- [ ] DNS propagation check.
