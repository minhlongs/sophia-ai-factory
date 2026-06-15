---
description: "⚡⚡ Auto-implement a plan. Entrypoint from /idea pipeline. Accepts plan path, delegates to /ck:cook --auto."
argument-hint: "[plan-path] [--no-test] [--tdd]"
allowed-tools: Read, Bash, Glob, Grep
---

# /cook-auto — Plan Auto-Execution

Thin orchestrator: validate plan path, check preconditions, then delegate to `/ck:cook`.

## Input Validation

1. **Plan path required** — if `$ARGUMENTS` is empty or no `.md` file found, ask user for plan path
2. **Plan file must exist** — `Read` the plan, fail fast if missing
3. **No destructive flags** — reject `--no-test` + `--force` combos

## Pre-Execution Checks

Before calling `/ck:cook`:

1. Read the plan file — confirm it has phases listed
2. Check `./docs/code-standards.md` exists (required by cook workflow)
3. Extract any user flags from `$ARGUMENTS` (e.g., `--no-test`, `--tdd`)
4. If `--auto` NOT in flags, append it (this command IS the auto entrypoint)

## Delegation

```
/ck:cook $ARGUMENTS --auto
```

Pass through ALL user flags. Never silently strip user options.

## Post-Execution

After `/ck:cook` returns:
- If success: remind user of next step (`/mekong deploy <slug>` or manual deploy)
- If blocked: summarize what's needed to unblock

## Integration with /idea

This command is the Step 4 output of `/idea`:

```
/cook-auto ./plans/{date}-{slug}/plan.md
```

Expected plan structure (from `/idea` Step 3):
```
./plans/{date}-{slug}/
├── plan.md          # Overview + phase links
├── phase-01-*.md    # Phase details
└── phase-02-*.md    # ...
```

## Error Handling

| Scenario | Action |
|----------|--------|
| Plan file not found | Show available plans in `./plans/`, ask user to pick |
| Plan has no phases | Warn user, ask if they want to proceed anyway |
| `/ck:cook` blocked on review | Surface the review gate to user |
| Build fails | Stop, report error, suggest `/debug` |
