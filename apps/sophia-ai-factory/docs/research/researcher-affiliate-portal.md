# Research: Affiliate Partner Portal, Dual-Rail Payout & Secure Redemption

## 1. Executive Summary
Architecture for affiliate portal with dual-rail settlements (VietQR / USDT) and secure onboarding. Designed for Cloudflare D1 (SQLite single-writer) + Next.js Server Actions + Better-Auth. Adheres to YAGNI, KISS, DRY. Zero workspace auth leakage.

## 2. Secure Invite Token Lifecycle & Workspace Auth Isolation
- Threat Model: Partner onboarding must not inherit inviter session, tenant role, or internal admin scopes.
- Token Generation: 256-bit entropy (`crypto.getRandomValues(new Uint8Array(32))` -> 64-char hex string).
- Storage: SHA-256 hashed token or high-entropy unguessable token with 14-day TTL.
- Atomic Redemption Query (prevents double-spend/race condition without distributed locks):
```sql
UPDATE affiliate_invites
SET status = 'accepted', accepted_at = ?1, accepted_partner_id = ?2, updated_at = ?1
WHERE invite_token = ?3 AND status = 'pending' AND expires_at > ?1;
```
- Workspace Boundary: Redemption provisions a distinct `affiliate_partners` profile tied to the partner's independent Better-Auth identity (`new_user_id`). Inviter tenant context (`inviter_user_id`) is stored strictly as attribution metadata, never as an auth claim or session cookie.

## 3. Dual-Rail Payout UX & Encrypted Destination Storage
- Rail 1 (Domestic VN): VietQR / NAPAS 247. Bank BIN (6 digits), Account Number (6-20 digits), Account Name (uppercase unaccented Latin). Automated USD->VND conversion (25,450 VND/USD baseline, min payout $50 = 5,000 cents). Exported as NAPAS-compliant CSV or PayOS payload.
- Rail 2 (Web3 Global): USDT TRC20 / ERC20. TRC20 validated via Base58Check (0x41 prefix, 34 chars, double SHA-256 checksum). ERC20 validated via 0x + 40 hex regex + non-zero check. Disbursed via NOWPayments Mass Payout API.
- Destination Encryption: Stored at rest using AES-256-GCM via Web Crypto API (`crypto.subtle`). Format: `base64(iv_12B || ciphertext_with_tag)`. DEK loaded from Cloudflare Worker secret `LOCAL_MODE_DEK`.
- UX Presentation Masking: Never return plaintext across client API. Mask bank: `••••••••5678 (MBBank)`; mask USDT: `TLyV••••••••8f2a`.

## 4. OCC Commission Settlement State Machine
- Lifecycle: `draft` -> `pending_approval` -> `approved` -> `processing` -> `completed` (Exceptions: `failed`, `rejected`, `clawback`).
- Cloudflare D1 Concurrency Constraint: No `SELECT FOR UPDATE` or pessimistic locks. Solution: Optimistic Concurrency Control (OCC) using `version INTEGER NOT NULL DEFAULT 1`.
- Step 1: Payout Approval Transition Query:
```sql
UPDATE affiliate_payouts
SET status = 'approved', approved_by = ?1, approved_at = ?2, version = version + 1, updated_at = ?2
WHERE id = ?3 AND version = ?4 AND status IN ('draft', 'pending_approval');
```
If `meta.changes === 0`, throw `OCC_VERSION_CONFLICT` and prompt refresh.
- Step 2: Atomic Final Settlement (`d1.batch([...])`):
```sql
-- Query 1: Mark payout completed with on-chain tx_hash or bank reference
UPDATE affiliate_payouts SET status = 'completed', tx_hash_or_bank_ref = ?1, version = version + 1, updated_at = ?2 WHERE id = ?3 AND version = ?4 AND status = 'approved';
-- Query 2: Mark linked commissions settled
UPDATE affiliate_commissions SET status = 'settled', settled_at = ?2, version = version + 1, updated_at = ?2 WHERE payout_id = ?3 AND status = 'payable';
-- Query 3: Decrement partner pending balance and increment settled balance
UPDATE affiliate_partners SET pending_payout_cents = MAX(0, pending_payout_cents - ?5), settled_payout_cents = COALESCE(settled_payout_cents, 0) + ?5, updated_at = ?2 WHERE id = ?6;
```

## 5. Real-Time Commission Ledger UX & Bilingual i18n
- Ledger UX Components:
  1. `AffiliateKpiCards`: Available balance, pending 14-day hold, lifetime earnings, conversion rate.
  2. `DualRailPayoutDrawer`: Rail selector tab (VietQR vs USDT TRC20), masked account display, balance validator.
  3. `CommissionLedgerTable`: Paginated event stream (Date, Order Ref, Rate %, Gross, Commission, 14-Day Hold Countdown, Status Badge).
- Formatting Standards:
  - Currency: USD (`$1,250.00`) via `en-US` formatting vs VND (`31.812.500 ₫`) via `vi-VN` formatting.
  - Dates: `dd/MM/yyyy` for Vietnamese locale, `MM/dd/yyyy` for English locale.
  - Zero jargon in Vietnamese UI: "Hoa hồng khả dụng" (Available), "Đang giữ đối soát 14 ngày" (14-day Hold), "Rút tiền VietQR" (VietQR Payout), "Rút tiền USDT" (USDT Payout).

## 6. Trade-Off Matrix
| Dimension | Option A: Dual-Rail + OCC in D1 (Recommended) | Option B: Single Rail (USDT Only) | Option C: External Affiliate SaaS (Rewardful/Tolt) |
| :--- | :--- | :--- | :--- |
| Performance | High (<15ms edge read, batch write) | High (<15ms edge read) | Medium (Network egress to third-party API) |
| Complexity | Low-Medium (Native D1 tables + Web Crypto) | Low (Single crypto rail) | High (Webhook synchronization, webhook drift) |
| Maintenance | Low (Zero external SaaS dependency) | Low (Single crypto provider) | High (SaaS API upgrades, credential rot) |
| Cost | Zero marginal cost (D1 included in CF plan) | Zero SaaS cost, network gas fees | $49-$299/mo fixed platform subscription |

## 7. Adoption Risk & Architectural Fit
- Maturity: SQLite OCC pattern proven since Kung-Robinson (1981); AES-256-GCM is FIPS/NIST standard; VietQR EMVCo deployed nationwide across 54+ VN banks.
- Breaking Changes: Native D1 migrations preserve backward compatibility. Additive schema evolution (`version` column).
- Architectural Fit: 100% native to Sophia AI Factory Cloudflare Pages/Workers + D1 edge runtime; zero Node.js native binary dependencies.

## 8. Ranked Concrete Recommendations
1. Rank 1 (Implement Now): Deploy Migration 0452 schema with OCC `version` columns in `affiliate_payouts` and `affiliate_commissions`. Enforce AES-256-GCM destination encryption via `encryptSecret()`.
2. Rank 2 (Immediate Follow-up): Build Stitch UI `DualRailPayoutDrawer` with Zod client/server validation for VietQR (BIN + Account) and TRC20 (Base58Check).
3. Rank 3 (Operational Phase): Automate VietQR CSV batch exporter and NOWPayments API trigger in Cloudflare Cron Worker (`payout-batcher.ts`).

## 9. Research Limitations & Unresolved Questions
- Limitations: Researched manual/batch CSV export for VietQR; direct automated bank host-to-host API integration (e.g. VietinBank/MBBank Open API) requires enterprise banking corporate contract.
- Unresolved Questions:
  1. What is the SLA and treasury float required for NOWPayments USDT wallet balance replenishment?
  2. Should VietQR payouts above 50,000,000 VND require secondary admin MFA approval before status transition to `approved`?

## 10. Credibility & Reference Sources
- State Bank of Vietnam & NAPAS: [Circular 39/2014/TT-NHNN & Circular 16/2020/TT-NHNN](https://sbv.gov.vn) (VietQR / NAPAS 247 Interbank Transfer Standard)
- EMVCo: [EMVCo QR Code Specification for Payment Systems: Merchant-Presented Mode v1.0](https://www.emvco.com/emv-technologies/qrcodes/)
- NIST: [SP 800-38D Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- TRON DAO: [TIP-20 Token Standard Specification](https://github.com/tronprotocol/tips/blob/master/tip-20.md)
- Ethereum Foundation: [EIP-55 Mixed-case Checksum Address Encoding](https://eips.ethereum.org/EIPS/eip-55)
- Kung, H.T. & Robinson, J.T. (1981): [On Optimistic Methods for Concurrency Control](https://dl.acm.org/doi/10.1145/319628.319667) ACM TODS
- Cloudflare: [Cloudflare D1 Documentation & Concurrency Model](https://developers.cloudflare.com/d1/)
