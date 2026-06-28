# Payment Gateway Research: Polar.sh & Stripe Connect in Vietnam

## Executive Summary

The "Payments are currently unavailable" error and "created" status are caused by an **incomplete Stripe Connect onboarding process** (`details_submitted_at = null`). Crucially, **Stripe Connect (Express) does not support Vietnam**, which is the fundamental blocker. The proposed "PingPong -> ACB" workaround will likely fail because the initial Stripe onboarding requires selecting a supported country, and Vietnam is not on the list.

## 1. Diagnostics: "Payments Unavailable" & "Created" Status

*   **Status Meaning**:
    *   **Organization Status "Created"**: The organization object exists in Polar's database but has not been activated for payments. This is the default state before successful Stripe onboarding.
    *   **"Payments are currently unavailable"**: This specific error appears when the connected Stripe account lacks the `charges_enabled` or `payouts_enabled` capabilities.
*   **Root Cause**:
    *   **`details_submitted_at = null`**: This is the "smoking gun." It means the user **never completed or successfully submitted** the Stripe onboarding form.
    *   Stripe has no KYC/KYB data to verify, so the account remains in a restricted/incomplete state.

## 2. Payouts to Vietnam (The Core Blocker)

### Stripe Connect Limitations
Polar.sh uses **Stripe Connect Express** accounts to pay creators/maintainers.
*   **Supported Countries**: Stripe Express supports a specific list of countries (e.g., US, UK, EU, Singapore, etc.).
*   **Vietnam Status**: **Vietnam is NOT a supported country for Stripe Express.**
*   **Implication**: When you attempt to onboard, if you select "Vietnam" as your country, Stripe will likely stop you or not offer it as an option. If you select a different country (e.g., US) but cannot provide proof of residence/business (which allows the PingPong bank account to work), KYC will fail.

### The "PingPong -> ACB" Route
*   **Concept**: Use PingPong to get a virtual US/EU bank account to receive funds, then transfer to ACB (Asia Commercial Bank) in Vietnam.
*   **Why it Fails here**: This only solves the *banking* part. It does not solve the **Identity/Entity verification (KYC/KYB)** part. Stripe requires you to verify your identity *in the country you claim to be in*. You cannot say you are in the US (to use the PingPong US account) without a US SSN/EIN and address.

## 3. Polar vs. Direct Stripe Comparison

| Feature | Polar.sh (Merchant of Record) | Direct Stripe Integration |
| :--- | :--- | :--- |
| **Role** | Acts as the reseller/merchant. Handles sales tax/VAT globally. | You are the merchant. You handle tax liability. |
| **Payouts** | via Stripe Connect (Express). | Direct to your bank account. |
| **Vietnam Support** | **No** (Limited by Stripe Connect Express coverage). | **No** (Stripe not available in Vietnam). |
| **Setup Difficulty** | Low (if supported country). | High (Requires LLC via Stripe Atlas). |
| **Fees** | 4% + 40¢ (plus Stripe fees). | Standard Stripe fees. |

## 4. Recommended Solutions

Since a direct Vietnam setup is not supported by the underlying infrastructure:

### Option A: Open Source/Individual Payouts (If Applicable)
If you are an individual maintainer:
1.  Check if Polar supports **PayPal** or other manual payout methods for unsupported regions (rare, usually they strictly strictly use Stripe).
2.  **Wait**: Stripe is expanding, but no ETA for Vietnam.

### Option B: US/Singapore Entity (Robust)
1.  **Form an Entity**: Use **Stripe Atlas** or similar to form a US LLC or Singapore Pte Ltd.
2.  **Stripe Setup**: Open a fully verified Stripe US/SG account.
3.  **Polar Setup**: Connect this US/SG entity to Polar.
4.  **Payout Flow**: Polar -> Stripe (US) -> Mercury/Wise/PingPong -> ACB (Vietnam).

### Option C: Alternative Platforms (Immediate Fix)
If forming a company is too expensive/complex, consider platforms that support **Global Payouts** (via Wise/PayPal/Payoneer) specifically for Vietnam:
*   **Lemon Squeezy**: Acts as MoR, supports payouts to more countries via PayPal/Payoneer (verify Vietnam specifically).
*   **Gumroad**: Supports PayPal payouts to Vietnam.

## Unresolved Questions / Next Steps
*   Does Polar.sh specifically offer a "manual payout" work-around for high-volume open source maintainers in unsupported regions? (Unlikely, but worth asking support).
*   Can the user form a low-cost US LLC to unblock this?

## Sources
*   [Stripe Connect Express Supported Countries](https://stripe.com/global)
*   [Polar.sh Documentation](https://docs.polar.sh)
