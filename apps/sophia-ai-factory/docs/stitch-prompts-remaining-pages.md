# Stitch Prompts — Sophia AI Factory Remaining Pages

**Date:** 2026-07-03
**Design System:** Dark mode, Indigo #6366F1 primary, Inter font, 8px rounding
**Stitch Project:** `2407265268945504587` (Sophia AI Factory — Full UI Redesign)

---

## 1. Checkout Page

```
Desktop High-Fidelity checkout/payment page for Sophia AI Factory — a Next.js 16 SaaS platform for AI video generation with Revenue-as-a-Service model. Clean, Professional, Modern, Focused SaaS aesthetic. Tonal spot accent palette on neutral base. Dark mode. Background: Deep charcoal (#0F0F11). Primary: Indigo (#6366F1). Headline font: Inter 28px/700. Body font: Inter 15px/400. Label font: IBM Plex Sans 13px/500. Roundness: 8px. Comfortable spacing.

Left sidebar dashboard shell (240px, #18181B surface). Top header bar (64px). Main content area padded 32px.

Page heading: "Checkout" 28px/700 left. Breadcrumb "Billing → Checkout" 13px/400 grey above.

Main split layout (2 columns, 24px gap):
- Left (3/5): Order summary panel (#18181B surface, zinc-800 border, 16px padding, 12px rounding). Plan selected: "PREMIUM Annual" 16px/600 white. Price breakdown table: Subscription $948.00/yr, AI Credits 5,000 ($499.00), Total $1,447.00. Each row: label 14px/400 grey, value 14px/600 white right-aligned. Divider line. Grand total in indigo 20px/700.
- Right (2/5): Payment panel (#18181B surface, zinc-800 border, 16px padding, 12px rounding). Heading "Payment Method" 18px/600 white.

Payment options as radio cards (full-width, 52px height each):
- "USDT (TRC-20)" — Tether logo, "Recommended" indigo badge, selected state with indigo border + radio dot.
- "USDC (Solana)" — USDC logo, radio input.
- "BTC" — Bitcoin logo, radio input.
- "NOWPayments Invoice" — NOWPayments logo, "Pay with any crypto" description 12px/400 grey.

After selection: Wallet address panel appears — "Send exactly 1,447.00 USDT to:" monospace address in a copyable input with indigo "Copy" button. QR code placeholder (200x200px, light surface). "Confirm Payment" primary indigo button (full-width, 48px height, rounded-lg). Status guidance: "Send the exact amount. Transaction confirms in 1-3 minutes." 12px/400 grey text below.

Side note card below: "Need help?" 14px/600 with indigo link "Contact support" and "Cancel order" ghost link in grey.
```

---

## 2. Billing/Subscription Page

```
Desktop High-Fidelity billing/subscription management page for Sophia AI Factory SaaS platform. Dark mode. Background #0F0F11. Primary indigo #6366F1. Inter font. 8px rounding. Comfortable spacing.

Left sidebar dashboard shell (240px, #18181B surface). Top header bar (64px). Main content padded 32px.

Page heading: "Billing" 28px/700.

Current plan card (full-width, #18181B surface, indigo left border accent, 20px padding, 12px rounding):
- Plan badge: "PREMIUM" in indigo pill (24px height, 11px/700 uppercase).
- Plan name: "Annual Premium Plan" 20px/700 white.
- Price: "$79/mo" 28px/700 white, "billed annually ($948/yr)" 13px/400 grey.
- Status: "Active" green dot with "Next billing: Aug 15, 2026" 13px/400 grey.
- Actions row: "Change Plan" ghost button, "Cancel Subscription" outlined button in red (#DC2626).

Usage card below (full-width, #18181B, zinc-800 border, 20px padding, 12px rounding):
- Heading: "This Month's Usage" 18px/600 white.
- KPI row (3 cards, 1fr each): "AI Videos Generated" — 47/100, "Campaigns Active" — 8/50, "Storage Used" — 2.4GB/10GB.
- Each KPI: number 24px/700, label 13px/400 grey, progress bar (indigo fill, 4px height, rounded-full).

Split section (2 columns, 16px gap):
- Left: "Payment History" — compact table with columns: Date, Amount, Method (USDT/VISA), Status (Completed/Pending/Failed pill), Invoice. 5 rows, pagination.
- Right: "Payment Methods" — saved methods as compact cards: USDT (TRC-20) with "Default" indigo badge, last used date. "Add Method" ghost button with + icon. "Top Up Credits" card with indigo accent.

Bottom: "Danger Zone" section — red (#DC2626) top border card. "Delete Billing Profile" red outlined button, "This action cannot be undone" 12px/400 grey.
```

---

## 3. Signup/Register Page

```
Desktop High-Fidelity signup page for Sophia AI Factory. Dark mode. Background: #0F0F11. Primary indigo #6366F1. Inter font. Matching the existing login page aesthetic.

Centered card layout (max-width 480px, centered vertically and horizontally). Dark surface #18181B card with subtle zinc-800 border, 20px padding, 12px rounding.

Top: Logo "Sophia" in white 24px/700 with indigo dot, centered. "Create your account" 24px/700 white, centered. "Start building your AI video empire" 14px/400 grey, centered.

Form fields (each with label 13px/500 grey):
- "Full Name" input — 44px height, dark surface #0F0F11, zinc-700 border, focus: indigo ring.
- "Email" input — 44px height, same style.
- "Password" input — with eye toggle icon, strength indicator bar below (4 segments: weak/yellow, medium/amber, strong/green segments).
- "Confirm Password" input — with eye toggle.

Checkbox row: "I agree to the Terms of Service and Privacy Policy" 12px/400 grey with indigo checkbox.

"Create Account" primary button full-width (indigo filled, 48px height, rounded-lg, white text 15px/600).

Divider "or sign up with" with lines.

Social buttons row: "Google" ghost button with Google logo, "Magic Link" ghost button with email icon. Both 44px height, half-width.

Footer: "Already have an account?" grey 13px/400, "Sign in" indigo link.

Bottom: Language toggle (🇻🇳 VI / 🇺🇸 EN) and "© 2026 Sophia AI Factory" 11px/400 grey.
```

---

## Instructions

Copy each prompt above into [stitch.withgoogle.com](https://stitch.withgoogle.com):

1. Paste the prompt text into the generation field
2. Set device to **Desktop**
3. Apply design system **"Sophia AI Factory Indigo Dark"** (asset: `14203260290340580283`)
4. Generate → review → export as HTML → convert to Next.js component
