# ADR-0009 — Generated Artifacts Are Not Source of Truth

**Status:** Proposed  
**Date:** 2026-06-18  
**Owner:** CTO

## Context

The repository contains generated build artifacts, worktree copies, coverage reports, test result JSONs, repomix output, and historical agent run directories. These are useful for debugging but harmful as canonical documentation.

## Decision

Treat generated artifacts as DELETE candidates after explicit approval. Do not cite them as architecture truth unless they are the only surviving evidence of a shipped behavior.

## Consequences

- `.next/`, `.open-next/`, `coverage/`, `test-results/`, `.claude/worktrees*`, `.agents/`, and `repomix-output.xml` are cleanup candidates.
- Deletion must preserve source and canonical docs.
- Generated reports may be archived before deletion if they contain unique operational evidence.

## Evidence

- [`CATEGORIZATION.md`](CATEGORIZATION.md#L41-L55) — DELETE candidates, business impact, technical impact, migration path, and risk.
- [`.gitignore`](.gitignore#L29-L42) — generated build/test artifacts ignored by default.
- [`TASKS/constitution-tasks.md`](TASKS/constitution-tasks.md#L41-L52) — explicit approval required before deletion.
