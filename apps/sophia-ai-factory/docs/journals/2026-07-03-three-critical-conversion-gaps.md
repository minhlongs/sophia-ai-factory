# Three Critical Conversion Gaps Blocked Every Paying Customer

**Date**: 2026-07-03 21:30
**Severity**: Critical
**Component**: Frontend routing, pricing page, checkout page
**Status**: Resolved

## What Happened

We fixed three "quick wins" that were silently blocking every single potential paying customer from reaching purchase. None of these were new bugs -- they had been in the codebase for weeks, likely since the last major refactor.

1. Landing hero "Get Started" and "Sign Up" CTA buttons both linked to `/auth/login` and `/auth/register` -- routes that do not exist. The real routes are `/login` and `/auth/signup`.
2. The pricing page rendered `StitchPricingPage` with hardcoded $29/$79/$199 prices that have nothing to do with Sophia's actual UNIFIED_TIERS ($199/$399/$799/$4999). The real pricing component (`PricingStitchSection` from `@/forest/components/pricing`) existed in the codebase but was not wired to any route.
3. The checkout page (`/checkout`) rendered a fake credit card form with `setTimeout(resolve, 2000)` simulating payment processing. Sophia does not accept credit cards -- the product uses NOWPayments crypto and PayOS VietQR only.

Every flow that should have converted a visitor to a paying customer instead dead-ended in a 404, showed the wrong prices, or offered a payment method that does not exist.

## The Brutal Truth

This is embarrassing. A non-technical CEO visiting this SaaS product would click "Get Started" and hit a 404. If they found pricing, they'd see $29 tier that doesn't exist. If they somehow made it to checkout, they'd fill in credit card details that Sophia can never charge.

We shipped a broken funnel and nobody noticed for weeks because we were heads-down on architecture, inngest workflows, D1 migrations, and model routing -- building features no customer can reach.

The "fake checkout" is the most humiliating part. `setTimeout(resolve, 2000)` is the kind of placeholder you write on day one of prototyping. It should never survive into a deployable product. It survived because the checkout route existed but nobody ever actually tested the end-to-end purchase flow. We tested components individually, but never walked the full funnel as a human.

## Technical Details

**Bug 1 -- Auth link rot**:
- Hero CTAs: `<Link href="/auth/login">` and `<Link href="/auth/register">`
- Actual routes from the router: `/login` (app router page) and `/auth/signup` (app router page)
- `/auth/login` and `/auth/register` both return 404
- Root cause: a refactor of the auth pages renamed routes but the landing page links were not updated in the same commit

**Bug 2 -- Wrong pricing component**:
- File: `src/land/pricing/StitchPricingPage.tsx` (consumed by `/pricing` route)
- Hardcoded: `BASIC $29`, `PREMIUM $79`, `ENTERPRISE $199`
- Actual tiers from `src/seed/config/tiers.ts`: `BASIC $199`, `PREMIUM $399`, `ENTERPRISE $799`, `MASTER $4999`
- Fix: swap to `PricingStitchSection` from `@/forest/components/pricing/PricingStitchSection`, which consumes `UNIFIED_TIERS`
- The correct component had already been built and was sitting unused in `forest/components/pricing/` -- it just was not imported by any page

**Bug 3 -- Fake checkout**:
- File: `src/land/checkout/StitchCheckoutForm.tsx`
- Payment handler: `setTimeout(() => { resolve({ success: true }); }, 2000)` -- zero real payment integration
- No NOWPayments IPN wiring, no PayOS QR generation
- Fix: replaced page with redirect to `/pricing` and a message explaining available payment methods
- The wire-up to NOWPayments IPN exists elsewhere in the codebase (the payment flow is "protected" per handover rules) but was never connected to `/checkout`

## What We Tried

The fix was straightforward in all three cases -- the hard part was noticing they were broken. The changes:

- `LandingHero.tsx`: changed hrefs from `/auth/login` to `/login` and `/auth/register` to `/auth/signup`
- `pricing/page.tsx`: swapped imported component from `StitchPricingPage` to `PricingStitchSection`
- `checkout/page.tsx`: replaced full checkout form with redirect to `/pricing`

Code review flagged no blocking issues. All 6772 tests pass. Branch `fix/3-critical-conversion-gaps` is clean.

## Root Cause Analysis

Three separate problems, one root: **we do not own the user funnel as a system.**

Components are built in isolation. The pricing component exists in `forest/components/pricing/` but no page imports it. The checkout route exists but nobody wired it to the actual payment integration. The auth pages were renamed without grep'ing for all references. There is no "walk the funnel" step in our QA process.

The testing suite (6772 tests -- impressive number) covers unit and integration tests for individual modules. Zero of them test the full conversion path. The landing page test renders a hero but does not click the CTA and assert the destination route. The pricing test validates tier calculations but not which component renders at `/pricing`.

We optimized for architecture purity (4-layer model, strict boundaries) and test coverage volume, but lost sight of the only thing that matters: does a visitor become a customer?

## Lessons Learned

1. **Test the funnel, not just the modules.** A zero-test E2E spec that clicks landing -> login -> pricing -> checkout and asserts the page renders would have caught all three bugs instantly.
2. **Stale components rot.** `PricingStitchSection` was correct, finished, and unused. An orphaned correct component is indistinguishable from a missing one. Every exported component should have at least one importer or be deleted.
3. **`setTimeout(resolve, 2000)` is a contract: "this is not done."** It was not a lazy placeholder -- it was a signal that the developer who wrote it was blocked and nobody ever revisited. Any mock that calls `setTimeout(resolve, ...)` should fail CI or at minimum log a visible warning in dev.
4. **The handover rules say "Payment Flow" is protected.** It is. But being protected in documentation does not make it connected to the route. The route had no test asserting it uses NOWPayments. Protection rules need the coverage to back them.

## Next Steps

1. **Write a Playwright E2E spec** for the full conversion funnel: landing -> login -> pricing -> checkout (redirect). This is the only guarantee these gaps do not recur.
2. **Audit all remaining orphaned components** in `forest/components/` -- `PricingStitchSection` was not the only one.
3. **Add a CI check** that flags `setTimeout` calls with resolve/reject patterns as CI warnings in production code.
4. **Schedule a funnel walkthrough** before every deploy. A human clicks through the critical paths and reports what breaks. This should take 10 minutes.
