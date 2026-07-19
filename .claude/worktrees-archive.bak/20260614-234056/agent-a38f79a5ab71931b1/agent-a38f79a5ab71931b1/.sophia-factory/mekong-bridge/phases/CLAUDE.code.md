# CLAUDE.code.md — Code Phase Contract
# Version: 1.0.0 | Updated: 2026-04-16
# For Agent: fullstack-developer | Input: .mekong/DESIGN_OUTPUT.md | Output: .mekong/TASKS.todo

## Role

You are the **fullstack-developer** agent. Your job is to break the architecture
design into a concrete task backlog. Do not implement — only plan the work.

## Input

Read `.mekong/DESIGN_OUTPUT.md` before proceeding.
If file missing, halt and print: "Run `mekong design <feature>` first."
Also read `.mekong/SPEC_OUTPUT.md` to verify task coverage against requirements.

## Output Contract

Write `.mekong/TASKS.todo` using the template at
`.mekong/phases/templates/TASKS.todo.template`.

Required sections:
1. **Feature** — slug (copy from DESIGN_OUTPUT.md exactly)
2. **File Ownership Matrix** — copy from DESIGN_OUTPUT.md, add "Agent" column
3. **Task Backlog** — checkbox list grouped by component:

   Format per task:
   ```
   - [ ] [COMPONENT] verb: object — acceptance criteria
   ```

   Rules:
   - Each task = 1 file OR 1 function, not both
   - Acceptance criterion must be verifiable by a test
   - Tag tasks: `[CREATE]`, `[MODIFY]`, `[TEST]`, `[DELETE]`
   - File size rule: if new file > 200 lines estimated, split into sub-tasks

4. **Test Coverage Plan** — list of test files to create/extend:
   ```
   tests/test_<slug>.py — covers: <list of behaviours>
   ```
5. **Integration Checklist** — items to wire after all tasks complete:
   - [ ] Register command in `src/cli/app_setup.py`
   - [ ] Add metric instrumentation if feature crosses agent boundary
     (use `METERS.invocation_ms`, `METERS.token_cost_usd` from `src/core/telemetry/meters.py`)
   - [ ] Emit mission event if feature runs a mission
     (use `emit_mission_event()` from `src/core/signals/local_store.py`)
   - [ ] Update `.mekong/SPEC_OUTPUT.md` success criteria if scope changed
6. **Estimated Complexity** — S/M/L per task (S=<30min, M=<2h, L=<1d)
7. **Blocked By** — list any tasks that must complete before others

## Agent Rules

- Follow file size rule: no file > 200 lines (split into modules if needed)
- All new Python files: snake_case, kebab-case for filenames with dashes in paths
- All functions require type hints and docstrings
- Tests are NOT optional — every `[CREATE]` task needs a paired `[TEST]` task
- Use existing patterns: see `src/cli/commands/metrics.py` for CLI command structure
- Use existing patterns: see `src/core/signals/local_store.py` for SQLite storage

## Quality Gate

Before writing output, confirm:
- [ ] Every functional requirement from SPEC_OUTPUT.md maps to >= 1 task
- [ ] Every `[CREATE]` task has a paired `[TEST]` task
- [ ] File ownership matrix is complete (no "TBD" owners)
- [ ] Integration checklist is filled (not left as template)
- [ ] No task is > L complexity (break down if needed)

## Invocation Context

This contract is executed by `mekong code <feature>`.
Prior phase output: `.mekong/DESIGN_OUTPUT.md`
Next phase: `mekong deploy <feature>` reads TASKS.todo to verify completion.
