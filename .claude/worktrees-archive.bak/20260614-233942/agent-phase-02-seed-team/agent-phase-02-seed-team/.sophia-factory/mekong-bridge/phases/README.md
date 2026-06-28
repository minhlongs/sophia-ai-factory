# Mekong SDLC Scaffold

4-phase agent-driven development loop for solo founders.
Each phase = one CLI command + one `CLAUDE.*.md` agent contract.

## Phases

```
mekong spec new <feature>   → CLAUDE.spec.md   → .mekong/SPEC_OUTPUT.md
mekong design <feature>     → CLAUDE.design.md  → .mekong/DESIGN_OUTPUT.md
mekong code <feature>       → CLAUDE.code.md    → .mekong/TASKS.todo
mekong deploy <feature>     → CLAUDE.deploy.md  → .mekong/DEPLOY_REPORT.md
```

## Skip Policy

**Skipping phases is allowed.** This scaffold is not a gate — it is a guide.

| If you skip... | Risk |
|----------------|------|
| spec | Design may miss requirements; revisit after code phase |
| design | Code may lack coherent architecture; OK for <200 LOC features |
| code | Tasks exist only in your head; OK for solo trivial fixes |
| deploy | Gates not verified; only skip for hotfixes with manual CI check |

Solo velocity > process purity. Document skips in `.mekong/TASKS.todo`.

## File Outputs

All outputs land in `.mekong/` (project root level, not in `phases/`):

```
.mekong/
├── SPEC_OUTPUT.md       ← agent writes here
├── DESIGN_OUTPUT.md     ← agent writes here
├── TASKS.todo           ← agent writes here
└── DEPLOY_REPORT.md     ← agent writes here
```

Outputs are **committed by default**. Add to `.gitignore` per-feature if they
contain sensitive architecture details.

## Agent Contracts

Each `CLAUDE.*.md` file is read by the agent at runtime — not by humans during
normal work. Edit them to adjust agent behaviour across all future features.

| File | Drives | Agent |
|------|--------|-------|
| `CLAUDE.spec.md` | Objectives → Requirements | planner |
| `CLAUDE.design.md` | Requirements → Architecture | architect |
| `CLAUDE.code.md` | Architecture → Task backlog | fullstack-developer |
| `CLAUDE.deploy.md` | Tasks → Ship/Hold verdict | tester |

## Templates

`phases/templates/` holds blank scaffolds. The CLI copies and populates them.
Do not edit templates during a feature — edit the generated output instead.

## Integration with Existing Workflow

This scaffold **extends** `~/.claude/rules/primary-workflow.md` — it does not
replace it. The primary workflow handles orchestration. These phase files handle
project-specific SDLC context.

- `CLAUDE.deploy.md` references gates from `.github/workflows/gates.yml`
- `CLAUDE.spec.md` references `mekong eval-agent` (phase-03 command)
- `CLAUDE.code.md` references `src/core/telemetry/meters.py` metric names
- `CLAUDE.deploy.md` references `mekong metrics` (phase-03 command)

## Per-Feature Folder (Optional)

By default all outputs overwrite the same `.mekong/*.md` files. For long-running
parallel features, use: `MEKONG_FEATURE_DIR=1 mekong spec new <feature>` to
write into `.mekong/features/<feature>/` instead (see `src/cli/sdlc/spec.py`).
