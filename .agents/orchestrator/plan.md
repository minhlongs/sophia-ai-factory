# Execution Plan

## Objectives
1. Gather codebase context (especially current files and tests).
2. Decompose tasks R1-R7.
3. Spawn Explorer to investigate details of R1-R7 (translation keys, tests, database schema, N+1 query batching, route placeholders, action binding).
4. Spawn Worker(s) to apply fixes.
5. Spawn Reviewer(s) to verify correctness and no regressions.
6. Verify and ship.

## Phases
- Phase 0: Context Discovery and Setup
- Phase 1: Implementation of R1 to R7 (Translation, Database, Testing, Routing)
- Phase 2: Verification and Validation
