import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Regression guard for Phase 13→22 toError() migration: flag any bare `as Error`
// cast in production code. Only `to-error.ts` is exempted (its JSDoc mentions
// `as Error` in prose). Union casts (TSUnionType) are not matched by design.
const noAsErrorRule = {
  selector: "TSAsExpression[typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='Error']",
  message: "Avoid `as Error` casts — use `toError()` from '@/lib/utils/to-error' instead. Bare casts hide non-Error throws (strings, plain objects, undefined).",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
      "src/lib/utils/to-error.ts",
    ],
    rules: {
      "no-restricted-syntax": ["error", noAsErrorRule],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
]);

export default eslintConfig;
