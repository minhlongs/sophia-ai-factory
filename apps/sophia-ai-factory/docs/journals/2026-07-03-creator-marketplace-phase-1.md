# Creator Marketplace Phase 1: Red-Team Caught What We Missed

**Date**: 2026-07-03
**Severity**: Medium
**Component**: Creator Marketplace (sop-marketplace, SOP pipeline)
**Status**: Resolved

## What Happened

We delivered Phase 1 of the Creator Marketplace: lower creator gate (application-based instead of MASTER-only), payout UI with wallet management, stitch redesign with Saigon Factory theme, and SEO/analytics. 28 files changed, +1853/-427, 6772 tests passing, 0 TS errors, 0 i18n gaps.

## The Brutal Truth

This felt like two steps forward, one step back the whole way. The part that stings most: despite a proper plan and phased implementation, the red-team review flagged 14 issues -- and a handful of those were genuine "how did nobody catch this" bugs that would have shipped to production. The isBetaInviteApproved query not existing, a layer violation in the payout route, the [id] gate missing so anyone could access any creator's payout settings, and a self-publish vulnerability where no invite check existed on the admin approval flow. These are the kind of bugs that erode trust with both creators and the non-tech CEO client.

The code review at the end also caught missed scope items -- the apply page was broken, the admin queue was missing, and there were hardcoded English strings where i18n keys should have been. The process caught them, but the fact that they survived initial implementation means our review loops are doing the heavy lifting that better design would have prevented.

## Technical Details

- **Missing isBetaInviteApproved()**: The beta invite gate read the table but never checked `approved_at IS NOT NULL`. Any pending invite would pass.
- **Layer violation**: Payout API route imported directly from `land/` -- should have gone through `forest/` or server action.
- **Missing [id] gate**: `PayoutSettingsPage` had no `params.id` ownership check. Creator A could read/write Creator B's wallet address.
- **Self-publish vuln**: Admin approval endpoint lacked invite existence check. A creator with `access` set could publish without ever applying.
- **Red-team**: 14 findings total, all accepted and applied before implementation began.
- **Code review**: 6 additional fixes applied after implementation.
- **Existing dashboard overlap**: The creator marketplace shares components with the existing dashboard -- we had to refactor rather than duplicate, which added coordination cost.

## What We Tried

- **Brainstorm -> Plan -> Red-team -> Implement -> Code review**: The process worked, but the gate quality was uneven. Red-team was excellent (pre-catch). Code review was good (post-catch). The design phase between plan and red-team was where gaps lived.
- **Parallel implementation tracks**: Admin review queue, apply page, payout UI, stitch redesign, and SEO/analytics ran in parallel. The integration points (shared types, DB schema, routing) caused three merge conflicts that had to be resolved manually. Worth it for speed, but the cost was real.

## Root Cause Analysis

Three root causes:

1. **Assumption creep**: We assumed the beta invite flow worked like MASTER access. It didn't. The lowercase "access" field, missing approval timestamp, and lack of invite validation were all different from the MASTER gate but we treated them as equivalent.

2. **Process gaps between layers**: The payout feature touched seed (DB schema), tree (helpers), forest (quota gate?), land (routes), and land/sop-marketplace (pipeline). With parallel tracks, nobody owned the full cross-layer contract. The layer violation and missing [id] gate were both symptoms of split ownership.

3. **Existing infrastructure blind spot**: The existing dashboard already had marketplace features. We designed in isolation, then had to retrofit. The stitch redesign, in particular, had to account for a dead non-locale route that middleware was already redirecting -- meaning we initially put work into a file that was never reached.

## Lessons Learned

- **Parallel tracks need a single cross-layer owner**: Or at least a shared contract file that every track signs off on. The red-team review served as this retroactively, but it should have been a design document before coding started.
- **Rule of thumb**: Any feature that compares "is allowed" needs to check (1) does the record exist, (2) is the approval timestamp set, and (3) does the current user own it. We missed two of three on the beta invite gate.
- **Dead routes**: Run middleware-aware route discovery before designing. The old non-locale route was already dead -- we wasted time until the code review flagged it.
- **Review before you need it**: 14 red-team findings + 6 code review fixes = 20 things caught before production. Every finding that would have been a production incident justifies the process cost.

## Next Steps

- **Phase 2 scope already drafted**: Creator profile pages, content moderation, and SOP search/filter.
- **Monkey-patch the existing dashboard**: The dashboard marketplace needs the same stitch redesign for visual consistency. Currently pending as a separate ticket.
- **Add ownership assertions to all admin routes**: Create a reusable `assertOwnership(userId, resourceId)` helper in `land/sop-marketplace/` to prevent future [id] gate misses.
- **Audit all "is allowed" checks repo-wide**: There are similar gates in the billing and telegram flows. Apply the same checklist: record exists, timestamp set, current user owns it.
