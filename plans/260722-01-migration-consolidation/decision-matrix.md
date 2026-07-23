# 260722-01 — Migration Consolidation Decision Matrix

## Rules
- Applied migration names in D1 state are **source of truth** (see `0118_d1_migrations_baseline.sql`).
- All in-flight migrations must remain **single path**: `apps/sophia-ai-factory/migrations/*.sql`.
- Do not renumber applied migrations.
- `scripts/apply-migrations.sh` verifies SQL by **basename**; all future changes must update that registry if they rename a migration that has post-flight verification.
- New duplicate basenames must **not** be added. Any new schema change should use the next available sequential identifier.

## Decision Matrix — Current Duplicate Groups

### Group 0004
- Files: `0004-user-profiles.sql`, `0004_error_log.sql`, `0004_migrate_users_to_user.sql`
- D1 state: `0004-user-profiles.sql` applied; `0004_error_log` applied; `0004_migrate_users_to_user` present in baseline as inserted via baseline.
- Decision: `KEEP canonical` path for user-related schema. Keep both applied migrations names alongside `0004-error-log.sql` and `0004-migrate-users-to-user.sql` when possible, or demote to baseline-only when merged into canonical.
- Action: Add canonical files with clear naming, mark original as **SHIM_TO_BASELINE** (one-time baseline runner applied only against stale DB state).
- Verification update: required because new canonical name disables verification SQL lookup.

### Group 0005
- Files: `0005-signals-events.sql`, `0005_migrate_users_to_user.sql`
- D1 state: both `0005-signals-events` and `0005_migrate_users_to_user` referenced only via baseline/backfill paths.
- Decision: `MERGE` signals feature change into existing `0005-signals-events.sql`. Migration rename depends on baseline status.
- Action: If `0005_migrate_users_to_user` is already present in canonical `0005`-path, remove the filing.
- Verification update: required.

### Group 0031
- Files: `0031-affiliate-offers-catalog.sql`, `0031-video-pipeline-jobs.sql`
- D1 state: both applied.
- Decision: Merge catalog+video scheduling into `0031` via one-time reconcile, then renumber video pipeline into a higher next order (`0036` or nearest open slot).
- Action: Create new `003X-video-pipeline-jobs.sql` canonical; mark `0031-video-pipeline-jobs.sql` as SHIM_TO_BASELINE.
- Verification update: required.

### Group 0032
- Files: `0032-seed-affiliate-catalog.sql`, `0032-voices.sql`
- D1 state: both applied.
- Decision: Move seed data into `0032-seed-affiliate-catalog.sql`. Move voices to `003X-voices.sql`.
- Action: add remediation script for mixed state.
- Verification update: required.

### Group 0033
- Files: `0033-video-templates.sql`, `0033-video-usage-monthly.sql`
- D1 state: both applied.
- Decision: Keep templates; deprecate usage-monthly into canonical successor.
- Action: reconcile via new `003X` file.
- Verification update: required.

### Group 0034
- Files: `0034-tenant-storage-usage.sql`, `0034-video-onboarding-events.sql`
- D1 state: both applied.
- Decision: keep tenant-storage; move onboarding events to canonical successor.
- Action: create `003X-video-onboarding-events.sql`; baseline SHIM for old.
- Verification update: required.

### Group 0100
- Files: `0100-onboarding-automation.sql`, `0100-telegram-pairing-unique-paired-by.sql`
- D1 state: both applied.
- Decision: keep canonical on one path. Move `telegram-pairing-unique-paired-by` to `010X` or earlier open slot.
- Action: rename duplicate to unique canonical slot; baseline indicate full backup migration sequence.

### Group 0118
- Files: `0118_d1_migrations_baseline.sql`, `0118_d1_migrations_baseline_full.sql`
- D1 state: both applied.
- Decision:
  - SHIM_TO_BASELINE both; keep `0118_d1_migrations_baseline_full.sql` for remote backfills.
  - Do **not** delete until baseline is fully superseded.
- Action: Mark canonical file as baseline-only for operations; whitelist in `apply-migrations.sh`.

### Group 0178
- Files: `0178_idempotency_keys.sql`, `0178_referral_rewards_table.sql`
- D1 state: both applied.
- Decision: keep `referral_rewards_table.sql` as `0178`; rename `idempotency_keys` to open slot (`0123` or next free).

### Group 0179
- Files: `0179_batch_jobs_idempotency_unique.sql`, `0179_referral_rewards_table.sql`
- D1 state: both present.
- Decision: keep batch/jobs idempotency on `0179`; mark rewards as baseline-only SHIM.
- Action: add pip commands from baseline.

### Group 0212
- Files: `0212_create_creator_profiles.sql`, `0212_user_beta_invites.sql`
- D1 state: both applied.
- Decision: preserve creator profiles under `0212`. Move beta invites to next open or keep as **baseline-only**.
- Action: pipeline apply check rewrite if ID renamed.

### Group 0213
- Files: `0213_create_sop_listings.sql`, `0213_user_streaks.sql`
- D1 state: both applied.
- Decision: keep SOP marketplace expansion; move streaks to open slot.
- Action: promote canonical `0213` for `sop_listings` only.

### Group 0214
- Files: `0214_create_sop_installs.sql`, `0214_ipn_dead_letter_queue.sql`
- D1 state: both applied.
- Decision: keep installs on `0214`; move `ipn_dead_letter_queue` to a new shell `020X-ipn-dlq.sql`.
- Action: update verification keys.

### Group 0215
- Files: `0215-ceo-campaigns.sql`, `0215_create_sop_reviews.sql`
- D1 state: both applied.
- Decision: keep campaigns on `0215`; keep SOP reviews as `0215-create-sop-reviews.sql`.
- Action: rename file conforming to canonical style.

## Global Effects
- `apply-migrations.sh`: must be patched to reference any new canonical migration basenames that replace previous duplicate names.
- `e2e-bootstrap-d1.sh`: must remain aware of both old and new basenames, or require full baseline rerun before the new canonical filenames are mandatory.
- `audit-migrations.sh` (when created): add validation for duplicate-prefix directories and script cross-check.
- CI gate: once cleanup finishes, add test that scans for duplicate-prefix migration filenames before approval.
