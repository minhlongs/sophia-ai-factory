# Orchestration Protocol

## Delegation Context (MANDATORY)

When spawning subagents via Task tool, **ALWAYS** include in prompt:

1. **Work Context Path**: The git root of the PRIMARY files being worked on
2. **Reports Path**: `{work_context}/plans/reports/` for that project
3. **Plans Path**: `{work_context}/plans/` for that project

**Example:**
```
Task prompt: "Fix parser bug.
Work context: /path/to/project-b
Reports: /path/to/project-b/plans/reports/
Plans: /path/to/project-b/plans/"
```

**Rule:** If CWD differs from work context (editing files in different project), use the **work context paths**, not CWD paths.

---

#### File Ownership (CRITICAL)

Before any implementation phase begins, the pipeline MUST:

1. **Define ownership per phase** — each phase in `.orchestrate/latest/plan.md` gets a `## File Ownership` section listing exact files that phase may modify
2. **Check for overlap** — if two phases claim the same file, STOP and resolve before execution
3. **Verify at execution start** — implementation agent must confirm no overlap with uncompleted phases before writing code

Format in plan:
```markdown
## Phase: Implement Feature X
## File Ownership
- apps/sophia-ai-factory/src/forest/inngest/functions/feature-x.ts
- apps/sophia-ai-factory/src/land/feature-x/handler.ts
```

If a phase needs a file owned by another phase, it must wait or use the defined interface (never modify the other phase's file directly).

#### Sequential Chaining
Chain subagents when tasks have dependencies or require outputs from previous steps:
- **Planning → Implementation → Simplification → Testing → Review**: Use for feature development (tests verify simplified code)
- **Research → Design → Code → Documentation**: Use for new system components
- Each agent completes fully before the next begins
- Pass context and outputs between agents in the chain

#### Parallel Execution
Spawn multiple subagents simultaneously for independent tasks:
- **Code + Tests + Docs**: When implementing separate, non-conflicting components
- **Multiple Feature Branches**: Different agents working on isolated features
- **Cross-platform Development**: iOS and Android specific implementations
- **Careful Coordination**: Ensure no file conflicts or shared resource contention
- **Merge Strategy**: Plan integration points before parallel execution begins