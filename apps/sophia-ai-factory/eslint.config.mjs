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

// ─── Mekong 4-Layer Boundary Enforcement (Phase 07 — 2026-05-03) ─────────────
// One-way import direction: land → forest → tree → seed (downward only).
// Upward imports are forbidden. Violations indicate cross-layer coupling.
//
// Exempted files (LOCKED DECISIONS — plan.md §Locked Architectural Decisions):
//   seed/auth cluster  — enriched-jwt et al. import forest types (acceptable, ~4 violations)
//   seed/security cluster — api-key-validator imports tree audit/crypto-utils
//   tree/handover + tree/telegram — import forest email/outbox + land affiliates
//   forest/inngest + forest/quota + forest/components/pricing — import land billing
//
// To add a new exemption: add to the overrides blocks below and document reason.
// ─────────────────────────────────────────────────────────────────────────────

const layerBoundaryMessage =
  "Layer direction is one-way (land → forest → tree → seed). " +
  "Upward imports break layer isolation. Extract shared types to seed/ or rethink dependency direction.";

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

  // ── Layer boundary: seed/ must not import tree/, forest/, or land/ ──────────
  {
    files: ["src/seed/**/*.{ts,tsx}"],
    ignores: [
      // enforce-tier-quota.ts still imports forest/quota/video-quota — Phase 3 follow-up
      // (mekong SOP bridge plans/260512-2001-mekong-sops-gap-bridge — DI conversion deferred per planner scope).
      "src/seed/auth/enforce-tier-quota.ts",
      // Security cluster — api-key-validator imports tree audit/crypto-utils (mekong-exempt)
      "src/seed/security/api-key-validator-crypto.ts",
      "src/seed/security/api-key-validator-db.ts",
      // Telemetry (if present)
      "src/seed/telemetry/llm-trace.ts",
      // Test files (may import mocks from any layer)
      "src/seed/**/*.test.ts",
      "src/seed/**/*.test.tsx",
      "src/seed/**/*.spec.ts",
      "src/seed/**/*.spec.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/tree", "@/tree/*"],
              message: `seed/ cannot import tree/. ${layerBoundaryMessage}`,
            },
            {
              group: ["@/forest", "@/forest/*"],
              message: `seed/ cannot import forest/. ${layerBoundaryMessage}`,
            },
            {
              group: ["@/land", "@/land/*"],
              message: `seed/ cannot import land/. ${layerBoundaryMessage}`,
            },
          ],
        },
      ],
    },
  },

  // ── Layer boundary: tree/ must not import forest/ or land/ ──────────────────
  {
    files: ["src/tree/**/*.{ts,tsx}"],
    ignores: [
      // handover imports forest/email + forest/outbox (mekong-exempt: email delivery)
      "src/tree/handover/auto-handover.ts",
      "src/tree/handover/handover-email-service.ts",
      "src/tree/handover/__tests__/auto-handover.test.ts",
      // telegram imports forest/email + land/affiliates (mekong-exempt: bot ops)
      "src/tree/telegram/telegram-bot.ts",
      "src/tree/telegram/telegram-bot.test.ts",
      "src/tree/telegram/telegram-bot-campaign-fsm.ts",
      "src/tree/telegram/telegram-bot-campaign-fsm-confirm.ts",
      "src/tree/telegram/telegram-bot-campaign-handlers.test.ts",
      "src/tree/telegram/handlers/campaign-handler.ts",
      // Test files
      "src/tree/**/*.test.ts",
      "src/tree/**/*.test.tsx",
      "src/tree/**/*.spec.ts",
      "src/tree/**/*.spec.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/forest", "@/forest/*"],
              message: `tree/ cannot import forest/. ${layerBoundaryMessage}`,
            },
            {
              group: ["@/land", "@/land/*"],
              message: `tree/ cannot import land/. ${layerBoundaryMessage}`,
            },
          ],
        },
      ],
    },
  },

  // ── Layer boundary: forest/ must not import land/ ────────────────────────────
  {
    files: ["src/forest/**/*.{ts,tsx}"],
    ignores: [
      // inngest functions orchestrate land billing/affiliates (mekong-exempt: event handlers)
      "src/forest/inngest/functions/auto-discover-affiliates.ts",
      "src/forest/inngest/functions/conversion-to-ledger.ts",
      "src/forest/inngest/functions/index.ts",
      // quota-enforcer checks billing limits (mekong-exempt)
      "src/forest/quota/quota-enforcer.ts",
      // pricing component reads land coupon/promo data (mekong-exempt: UI)
      "src/forest/components/pricing/coupon-input.tsx",
      // Test files
      "src/forest/**/*.test.ts",
      "src/forest/**/*.test.tsx",
      "src/forest/**/*.spec.ts",
      "src/forest/**/*.spec.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/land", "@/land/*"],
              message: `forest/ cannot import land/. ${layerBoundaryMessage}`,
            },
          ],
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "worker-configuration.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
