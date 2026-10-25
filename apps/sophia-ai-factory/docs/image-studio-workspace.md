# Image Studio Workspace

Implementation note for the image generation workspace at
`/{locale}/dashboard/image-studio`.

## What it is

A workspace for the image generation job type that already existed in the
backend but had no user-facing surface. The route covers the bounded loop:
brief → submit → accepted/queued/running → review artifact → revise or start
another generation → download.

## Verified baseline

- Branch `feat/open-core-25-steps-binh-phap-accuracy`, HEAD `c87365d0c`.
- Working tree carried 8 pre-existing modified files unrelated to this change
  (blueprint docs and `.mekong/company.json`). None were touched, stashed, or
  reverted by this work.
- Repository identity confirmed as `github.com/minhlongs/sophia-ai-factory`.

## Contract mapped before implementation

| Concern | Reality found in the repo |
|---|---|
| Submission | `generateImageAction` in `src/app/actions/image-generate-action.ts`, a `'use server'` action: auth → Zod → tier gate → `executeImageGeneration`. Returns `{success, jobId}`. |
| List | `GET /api/v1/creative-studio/images` → `{images: MediaJobRow[]}`, newest first, scoped to `user_id`. |
| Status | `GET /api/v1/creative-studio/images/[id]/status` → `{id, status, resultUrl, thumbnailUrl}`. Ownership enforced in the query; polls MuAPI only while in flight. |
| Status enum | `pending \| processing \| completed \| failed` (`src/tree/clients/muapi-media-types.ts`). |
| Persistence | D1 table `media_jobs` (migration `0139_creative_media_jobs.sql`). |
| Tier gate | Two duplicated maps per model host (MuAPI, fal). |
| Asset storage | fal path writes to the shared R2 bucket and falls back to the provider CDN URL. |
| Design tokens | `src/app/globals.css` — the design authority for this repo. |
| i18n | `next-intl`, `messages/{vi,en}.json`, a `creativeStudio` namespace already existed; a new `imageStudio` namespace was added. |

## What was added

New modules:

- `src/tree/creative-studio/image-job-queries.ts` — shared D1 read layer.
  Both the API route and the workspace page use it, so ownership filtering and
  row mapping exist once.
- `src/tree/creative-studio/image-job-status.ts` — status vocabulary and the
  stage mapping the UI dispatches on.
- `src/tree/creative-studio/image-job-view-model.ts` — pure row → view model.
- `src/app/[locale]/dashboard/image-studio/` — server page plus
  `image-studio-view`, `image-brief-panel`, `image-preview-panel`,
  `image-history-strip`, `use-image-studio-state`.

Changed modules:

- `src/app/api/v1/creative-studio/images/route.ts` now delegates to the shared
  query layer instead of repeating the row mapping.
- `src/app/api/v1/creative-studio/images/generate/config.ts` and
  `src/app/actions/image-generate-action.ts` now import the tier maps from one
  place instead of each holding a copy.
- New `src/seed/config/tiers/image-model-access.ts` — single source of truth for
  tier → model access. It lives in `seed` because `seed` may not import `tree`,
  and the model list it needs was pulled up to
  `src/seed/config/tiers/supported-image-models.ts`.
  `@/tree/clients/muapi-media-client` re-exports the same value through
  `SUPPORTED_MODELS.image`, so its public shape is unchanged.

## Behaviour decisions worth knowing

- No progress percentage and no finish time is ever shown, because the backend
  publishes neither. In-flight jobs show indeterminate progress.
- An unrecognised status renders as an unrecognised state, never as a finished
  artifact. `imageJobStage('unknown')` maps to `failed` so it cannot be
  mistaken for success, while the copy distinguishes it from a real failure.
- "Generation succeeded" and "preview could not load" are separate states with
  separate copy.
- Failed jobs stay in the history strip so a later failure cannot erase the
  memory of an earlier success.
- Duplicate submission is guarded in three places: the submit button is
  disabled, the form does not double-submit, and `useImageStudioState` holds an
  `inFlightRef` that short-circuits a second call for as long as a request is
  outstanding. The server action itself has no idempotency key, so the client
  guard is protection, not a guarantee — see Risks.
- A late response cannot repoint the preview: the poll effect is keyed by job
  id and cancels its timer on cleanup, and `refreshJobs` only replaces the list
  wholesale without disturbing the selection.

## Verification

Commands run and their outcomes:

- `npm run i18n:validate` → 0 missing keys, 0 unresolved prefixes.
- `npx tsc --noEmit` → clean.
- `npm run lint` → 0 errors. My files carry no warnings except the deliberate
  `@next/next/no-img-element` suppression, explained at the tag: result URLs may
  come from fal's CDN or R2, and `next/image`'s configured `remotePatterns`
  only permit `*.r2.dev`, so optimisation would silently break provider URLs.
- `bash scripts/check-layer-boundaries.sh` → clean.
- Focused vitest run (`src/tree/creative-studio`,
  `src/app/[locale]/dashboard/image-studio`,
  `src/app/api/v1/creative-studio`) → 50 passed / 6 files.
- The full-suite figures recorded here earlier (18511 passed / 34 skipped /
  10 todo across 1942 files) were a run of an earlier tree and are not a
  current measurement. The repository holds 1811 test files today. A full-suite
  number is not re-stated in this document until it is re-run and captured,
  because a number copied from here rather than measured is exactly the kind of
  claim this document exists to avoid.

## The workspace is not yet reachable from the sidebar

The workspace route and all its modules are committed, but **no nav entry
points at it**. `src/forest/dashboard/dashboard-nav-modules.ts` has no
`image_studio` key at HEAD, so a customer cannot reach `/{locale}/dashboard/
image-studio` from the UI today — only by typing the URL. Both nav suites
(`dashboard-sidebar-nav.test.tsx` at 14 modules, and the independent challenger
suite with its own hardcoded list) still assert the original 14 and pass, which
is consistent with this record rather than contradicting it.

Adding the entry is a one-line change plus the matching count bump in both
suites, and is deliberately left out of this slice: it changes the sidebar every
customer sees, which is a wider blast radius than an unreferenced route. An
earlier draft of this document claimed the entry and the two test updates had
already landed here; that was wrong and has been corrected.

## Build

`npm run build` **passes on this machine, exit 0.** An earlier revision of this
document reported it as unverified after five attempts were killed during
compilation; that diagnosis was wrong. The termination was the session's
process ceiling and not a defect in this change, and the same command now
completes without any source modification — only a stale Turbopack cache and
the root build lock were cleared.

`SENTRY_AUTH_TOKEN` is unset on this machine, so the build skips source map
upload and logs that it is doing so. This is expected and is not a failure: it
is listed as optional in `.claude/rules/sophia-no-tech-doctrine.md`.

## Not verified:
- No real provider job ran. MuAPI and fal paths were never invoked against a
  live key. Every generated image in tests is a fixture row with a
  `https://cdn.test/...` URL.
- The UI was not exercised at 375/768/1440 px in a browser. No Playwright
  project can reach the authenticated dashboard route (it needs a live session
  and D1 data), so responsive inspection and screenshots are unverified rather
  than claimed. The route has no Playwright coverage at all today.
- Visual and responsive correctness is asserted only through the component
  tests above and through the a11y structure built into the markup (labels,
  `aria-current` on selection, `aria-pressed` on ratio buttons, `sr-only`
  region headings, `motion-reduce` on the spinner).

## Rollback

Revert the commits on this branch. No migration is added, so there is no schema
step to undo. The three changed server files are additive re-points of imports:
`src/tree/clients/muapi-media-types.ts` re-points `SUPPORTED_MODELS.image` to
the seed constant whose value is the same five strings, and the two tier maps
are re-declared locally in `image-generate-action.ts` and
`images/generate/config.ts` if you revert past
`src/seed/config/tiers/image-model-access.ts`. Deleting the
`src/app/[locale]/dashboard/image-studio/` directory and the
`src/tree/creative-studio/` query modules removes the rest; the only other
cleanup is the `imageStudio` / `sidebar.image_studio` keys in
`messages/{vi,en}.json`. There is no nav entry to revert, because none was
added.

## Risks

- No server idempotency on image generation. A retry after a transport failure
  creates a second, billable job rather than resolving the first. The client
  guard prevents an obvious double click but not a client-side retry. Closing
  this needs an idempotency key on the action and route, which is a backend
  change beyond this slice.
- `media_jobs` has no `cost_classification` write on the MuAPI path, so the
  workspace shows no cost. Per the honesty rule it shows nothing rather than
  inventing a number.
- The workspace reads tier from `getUserTier` and renders the model list
  client-side from that value. The tier gate is re-applied authoritatively in
  the action; a locked model in the list is a hint, not a permission.
