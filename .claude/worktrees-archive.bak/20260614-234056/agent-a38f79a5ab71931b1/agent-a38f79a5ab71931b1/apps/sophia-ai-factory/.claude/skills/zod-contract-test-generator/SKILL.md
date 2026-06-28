---
name: zod-contract-test-generator
description: >
  Given a Next.js API route file that contains exported or inline Zod schemas,
  generates a Vitest contract test file that asserts (a) valid inputs parse correctly,
  (b) invalid inputs fail with expected ZodError shape, (c) inferred TypeScript type
  matches the schema output. Activate when asked to add contract tests for API routes
  that validate input with Zod.
triggers:
  - "contract test"
  - "zod schema test"
  - "API route validation test"
  - "input contract"
  - "schema contract"
allowed-tools:
  - read
  - write
  - bash
---

# Zod Contract Test Generator

## Purpose

Auto-generates Vitest contract tests for API routes that use Zod for input validation.
Tests verify the **schema boundary only** — not HTTP handlers, auth, or DB side-effects.
Route files are never modified.

## When to activate

- User says "add contract tests for <route>"
- A new API route is added with Zod validation
- A Zod schema is changed and regression coverage is needed

## Inputs

| Input | Description | Required |
|---|---|---|
| `routeFilePath` | Absolute path to the Next.js `route.ts` file | Yes |
| `schemaName` | Name of the exported Zod schema (e.g. `CreateMissionSchema`). If omitted, skill discovers all `z.object(…)` assignments in file. | No |
| `outputDir` | Directory for the test file. Defaults to `<route-dir>/__tests__/` | No |

## Outputs

Single file: `<outputDir>/route.contract.test.ts`

## Extraction strategy (ts-morph)

```typescript
// ts-morph is in devDeps — available at build time
import { Project } from 'ts-morph';

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const source = project.addSourceFileAtPath(routeFilePath);

// 1. Collect exported const assignments where RHS starts with z.object / z.array / z.enum
const schemas = source.getVariableDeclarations().filter(decl => {
  const init = decl.getInitializer()?.getText() ?? '';
  return init.startsWith('z.') && (decl.isExported() || /* inline */ true);
});
```

If schemas are not exported from the route file, the skill **duplicates the schema** into
the test file and adds a `// TECH DEBT: schema not exported from route` comment.

## Generated test structure

```typescript
import { z } from 'zod';
// import { SchemaName } from '../route';   ← if exported
// or duplicate schema inline with TECH DEBT comment

describe('contract: <route-path>', () => {
  describe('<SchemaName>', () => {
    it('parses valid payload #1', () => { … });
    it('parses valid payload #2', () => { … });
    it('rejects missing required field — issues[0].code = invalid_type', () => { … });
    it('rejects out-of-range value — issues[0].path = ["fieldName"]', () => { … });
    // TypeScript compile-time assertion (no runtime cost)
    it('inferred type matches expected shape', () => {
      type Inferred = z.infer<typeof SchemaName>;
      const _typeCheck: Inferred = validPayload1; // TS error if shape mismatch
      expect(true).toBe(true); // placeholder so Vitest counts the test
    });
  });
});
```

## Constraints

- ≤ 80 lines per generated file
- Zero `:any` types
- No imports from `next/server`, `@/lib/db/*`, or any auth module — schema tests are pure
- Never modify the source `route.ts`
- Describe block MUST be `describe('contract: <relative-route-path>', …)` for filterability

## Usage examples

```bash
# Manual invocation pattern (in Claude Code session):
# "Use the zod-contract-test-generator skill to add contract tests for
#  src/app/api/v1/missions/route.ts using CreateMissionSchema"

# The skill will:
# 1. Read src/app/api/v1/missions/route.ts
# 2. Extract CreateMissionSchema definition
# 3. Write src/app/api/v1/missions/__tests__/route.contract.test.ts
# 4. Run: npx vitest run src/app/api/v1/missions/__tests__/route.contract.test.ts --no-coverage
```

## Fallback (if ts-morph unavailable)

If `ts-morph` extraction fails, fall back to manual scaffold:
1. Read route file
2. Identify Zod schema by scanning for `z.object({` blocks
3. Copy-paste schema into test file with TECH DEBT comment
4. Proceed with standard test structure

## Ratcheting note

Do NOT bump `vitest.config.ts` coverage thresholds automatically.
Threshold ratcheting is a deliberate human decision per phase plan.
Document coverage delta in PR description instead.
