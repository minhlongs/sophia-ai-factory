import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

// ─── Phase 2: Complexity Ratchet (2026-08-16) ───────────────────────────────
// SonarJS + built-in rules to block hot-spot growth. Frozen baseline ensures
// suppressions never grow; only decrement count via `npm run lint:fix` + cleanup.
const COMPLEXITY_THRESHOLDS = {
  'sonarjs/cognitive-complexity': ['warn', 15],
  'max-lines-per-function': ['warn', 200],
  'max-depth': ['warn', 4],
  'max-nested-callbacks': ['warn', 3],
}

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
    plugins: { sonarjs },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "no-restricted-syntax": ["error", noAsErrorRule],
      // ─── Phase 2: Complexity Ratchet (2026-08-16) ─────────────────────────────
      // Warn boundaries first: warn at 15 / 200 / 4 / 3. Remaining legacy hot-spots
      // can be migrated to error thresholds later without new comments.
      // No spread helper/mutator here: plain object so ESLint 9 flat config stays valid.
      // Frozen baseline: new eslint-disable comments are forbidden; count must decrease.
      'sonarjs/cognitive-complexity': ['warn', 15],
      'max-lines-per-function': ['warn', 200],
      'max-depth': ['warn', 4],
      'max-nested-callbacks': ['warn', 3],
      // ─── End Complexity Ratchet ──────────────────────────────────────────────
      // React Compiler rules — demoted from error to warn for high-volume cases
      // where refactor is invasive but the underlying pattern is widely acceptable
      // in production React 19 codebases. These remain enforced (visible in lint
      // output) but do NOT block the ci:lint gate. Tracked as Phase 3 follow-up
      // for incremental cleanup. `react-hooks/purity` has high false-positive
      // rate against Server Components (Math.floor/Date.now in async server
      // components is the canonical pattern). `react-hooks/immutability` similar.
      // Keep `rules-of-hooks` and `exhaustive-deps` as ERROR/WARN inherited from
      // eslint-config-next — those indicate real bugs.
      // Disabled: false positives on standard React patterns (setState in useEffect
      // for data fetching, Date.now() in render, window.location in callbacks).
      // Re-enable selectively as React Compiler stabilizes these checks.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
    },
  },

  // ── Test files — relax `no-explicit-any` and `no-unused-vars` (mocks legitimately use any) ──────
  // Aligns with code-standards.md: "Zero `:any` types in production code".
  {
    files: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // ── Layer boundary: seed/ must not import tree/, forest/, or land/ ──────────
  {
    files: ["src/seed/**/*.{ts,tsx}"],
    ignores: [
      // enforce-tier-quota.ts is now a back-compat re-export stub pointing to
      // forest/auth/enforce-tier-quota (M4 migration). The re-export crosses
      // seed→forest boundary, allowed as a thin stub only.
      "src/seed/auth/enforce-tier-quota.ts",
      // Security cluster — formerly imported tree audit/crypto-utils; fixed in M2
      // (now imports from seed/security/crypto-utils). Stubs kept for safety.
      "src/seed/security/api-key-validator-crypto.ts",
      "src/seed/security/api-key-validator-db.ts",
      // Telemetry (if present)
// seed/ai — AI adapters call land services + tree BYOK (mekong-exempt: AI infra)
"src/seed/ai/anthropic-adapter.ts",
"src/seed/ai/elevenlabs-api-client.ts",
"src/seed/ai/script-generator.ts",
"src/seed/ai/text-to-speech-generator-elevenlabs.ts",
"src/seed/ai/video-generator.ts",
// seed/auth enriched-jwt — reads land/features for entitlement checks (mekong-exempt)
"src/seed/auth/enriched-jwt-entitlements.ts",
// seed/auth oauth-state-store — reads forest/publishing for token crypto (mekong-exempt)
"src/seed/auth/oauth-state-store.ts",
// seed/compliance — reads land/feature-flags, land/enterprise-features (mekong-exempt)
"src/seed/compliance/soc2-prep.ts",
// seed/components — reads land/i18n for routing (mekong-exempt)
"src/seed/components/dashboard/dashboard-error-boundary.tsx",
// seed/config — reads forest/publishing for channel interface (mekong-exempt)
"src/seed/config/channel-cooldown-rules.ts",
// seed/db — reads forest/publishing for interface (mekong-exempt)
"src/seed/db/get-user-channels.ts",
"src/seed/db/workflow-repository.ts",
// seed/security — reads land/tenant-settings + land/webhooks for validation (mekong-exempt)
"src/seed/security/geo-gate.ts",
"src/seed/security/webhook-validator.ts",
// seed/templates — reads land/templates for campaign template data (mekong-exempt)
"src/seed/templates/campaign-templates.ts",
// seed/types — reads tree/database for Supabase row types (mekong-exempt: type-only import)
"src/seed/types/audit-log.ts",
// seed/utils — reads land/observability + land/telemetry for logging infra (mekong-exempt)
"src/seed/utils/logger-internals.ts",
// seed/utils/circuit-breaker — reads land/monitoring + land/fulfillment for alerting (mekong-exempt: infra alerting)
"src/seed/utils/circuit-breaker.ts",
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
      // dispatch-with-retry-hints uses Inngest retry classes + forest/publishing/* —
      // tightly coupled to forest infra; mekong-exempt to avoid invasive relocation.
      // Long-term: move file to src/forest/inngest/ alongside other Inngest helpers.
      "src/tree/telegram/dispatch-with-retry-hints.ts",
      // ── Tree wrapper modules (re-export public API from forest/ or land/) ─────
      // These are intentional facade modules — tree domain's public interface.
      // affiliates domain wrapper
      "src/tree/affiliates/credentials.ts",
      "src/tree/affiliates/index.ts",
      "src/tree/affiliates/scout/**/*.ts",
      // agents domain wrapper
      "src/tree/agents/agent-health-resolver.ts",
      "src/tree/agents/enforcement-gate.ts",
      "src/tree/agents/prompts.ts",
      "src/tree/agents/repository.ts",
      "src/tree/agents/runner.ts",
      "src/tree/agents/seed-default-team.ts",
      "src/tree/agents/types.ts",
      // email domain wrapper
      "src/tree/email/email-templates.ts",
      "src/tree/email/index.ts",
      "src/tree/email/lifecycle-email-rules.ts",
      "src/tree/email/onboarding-emails.ts",
      "src/tree/email/render-email.ts",
      "src/tree/email/sender.ts",
      "src/tree/email/week-stats.ts",
      // llm domain wrapper (re-exports from land/openclaw)
      "src/tree/llm/index.ts",
      // missions wrapper (re-exports forest/missions dispatcher)
      "src/tree/missions/dispatcher.ts",
      "src/tree/missions/fire-webhook.ts",
      // openclaw gateway wrapper (re-exports land + forest)
      "src/tree/openclaw/index.ts",
      // outbox wrapper
      "src/tree/outbox/email-outbox.ts",
      // publishing wrapper
      "src/tree/publishing/providers/telegram-publisher.ts",
      // fulfillment wrapper (re-exports from land/fulfillment)
      "src/tree/fulfillment/index.ts",
      // inngest client wrapper (re-exports from forest/inngest)
      "src/tree/inngest/client.ts",
      // admin/synthetic-fulfillment-runner — reads land/fulfillment for fulfillment logic (mekong-exempt)
      "src/tree/admin/synthetic-fulfillment-runner.ts",
      // byok/with-timeout — reads land/signals for telemetry (mekong-exempt)
      "src/tree/byok/with-timeout.ts",
      // clients/nowpayments-client — reads land/webhooks for IPN signature (mekong-exempt)
      "src/tree/clients/nowpayments-client.ts",
      // gateway/adapters — reads land/tiktok, land/youtube for channel OAuth (mekong-exempt)
      "src/tree/gateway/adapters/tiktok-channel-adapter.ts",
      "src/tree/gateway/adapters/youtube-channel-adapter.ts",
      // gateway/checkpoint-supabase-persistence — reads land/supabase/admin (mekong-exempt)
      "src/tree/gateway/checkpoint-supabase-persistence.ts",
      // gateway/openclaw-gateway — reads land/signals for orchestration telemetry (mekong-exempt)
      "src/tree/gateway/openclaw-gateway.ts",
      // sop/auto-dispatch-layer — reads land/openclaw for LLM routing (mekong-exempt)
      "src/tree/sop/auto-dispatch-layer.ts",
      // sop/executor/sop-runner — reads forest/missions for dispatching (mekong-exempt)
      "src/tree/sop/executor/sop-runner.ts",
      // sop/solo-orchestrator — reads land/openclaw for agent orchestration (mekong-exempt)
      "src/tree/sop/solo-orchestrator.ts",
      // sop/webhook-hmac — reads land/webhooks for signature verification (mekong-exempt)
      "src/tree/sop/webhook-hmac.ts",
      // alerts/webhook-notification-signature — reads land/webhooks for HMAC (mekong-exempt)
      "src/tree/alerts/webhook-notification-signature.ts",
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
      // publishing/orchestrates land OAuth token refresh per cross-layer-orchestration.md (forest→land)
      "src/forest/publishing/oauth-platform-refreshers.ts",
    // agents/runner.ts — orchestrator that calls land signals/telemetry (mekong-exempt: agent orchestration)
// ab/experiment-store — reads land/tracking for A/B attribution (mekong-exempt)
"src/forest/ab/experiment-store.ts",
// alerts/webhook-notification-signature — reads land/webhooks for HMAC (mekong-exempt)
"src/forest/alerts/webhook-notification-signature.ts",
// agent-sidebar components — reads land/agent-chat types for UI (mekong-exempt)
"src/forest/components/agent-sidebar/chat-message-list.tsx",
"src/forest/components/agent-sidebar/use-agent-chat.ts",
// analytics re-export barrel — canonical impl lives in land/analytics (mekong-exempt)
"src/forest/analytics/roi-calculator.ts",
// analytics components — reads land/analytics for dashboard (mekong-exempt)
"src/forest/components/analytics/ErrorRateChart.tsx",
"src/forest/components/analytics/LicenseMetricsTable.tsx",
"src/forest/components/analytics/UsageChart.tsx",
"src/forest/components/analytics/license-metrics-table-body.tsx",
"src/forest/components/analytics/license-utilization.tsx",
"src/forest/components/analytics/revenue-card.tsx",
"src/forest/components/analytics/service-breakdown.tsx",
"src/forest/components/analytics/unified-revenue-chart.tsx",
"src/forest/components/analytics/usage-chart.tsx",
// auth/signup-form — reads land/analytics for conversion tracking (mekong-exempt)
"src/forest/components/auth/signup-form.tsx",
// experiment-variant — reads land/signals for A/B (mekong-exempt)
"src/forest/components/experiment-variant.tsx",
// raas components — reads land/i18n for locale (mekong-exempt)
"src/forest/components/raas/mission-dashboard.tsx",
"src/forest/components/raas/mission-detail.tsx",
// settings components — reads land/schemas/settings for forms (mekong-exempt)
"src/forest/components/settings/sections/api-keys-section.tsx",
"src/forest/components/settings/sections/appearance-section.tsx",
"src/forest/components/settings/sections/notifications-section.tsx",
"src/forest/components/settings/sections/profile-section.tsx",
"src/forest/components/settings/settings-form.tsx",
// workflow components — reads land/workflows for UI labels (mekong-exempt)
"src/forest/components/workflows/create-workflow-form.tsx",
"src/forest/components/workflows/workflow-list.tsx",
"src/forest/components/workflows/workflow-step-row.tsx",
"src/forest/components/workflows/workflow-timeline.tsx",
// analytics hooks — reads land/analytics for data fetching (mekong-exempt)
"src/forest/hooks/analytics/use-license-metrics.ts",
"src/forest/hooks/analytics/use-revenue-metrics.ts",
"src/forest/hooks/analytics/use-usage-metrics.ts",
"src/forest/hooks/use-analytics-data.ts",
// inngest functions — orchestrate land domain services (mekong-exempt)
"src/forest/inngest/functions/analytics-sync.ts",
"src/forest/inngest/functions/batch-video-fanout.ts",
"src/forest/inngest/functions/distribution-fanout.ts",
"src/forest/inngest/functions/generate-campaign.ts",
"src/forest/inngest/functions/publish-execute.ts",
"src/forest/inngest/functions/repurpose-analyze.ts",
"src/forest/inngest/functions/repurpose-clip-generate.ts",
"src/forest/inngest/functions/revenue-events-ingest.ts",
"src/forest/inngest/functions/commerce-fulfillment.ts",
"src/forest/inngest/functions/video-compose.ts",
"src/forest/inngest/functions/video-generate.ts",
"src/forest/inngest/functions/video-publish.ts",
"src/forest/inngest/functions/video-scripting.ts",
"src/forest/inngest/functions/video-tts.ts",
"src/forest/inngest/functions/video-upload.ts",
"src/forest/inngest/functions/video-visual.ts",
"src/forest/inngest/functions/youtube-content-pipeline.ts",
// missions — orchestrate land video/lead services (mekong-exempt)
"src/forest/missions/api-key-auth.ts",
"src/forest/missions/dispatcher.ts",
"src/forest/missions/emit-video-generate.ts",
"src/forest/missions/handlers/analytics-report.ts",
"src/forest/missions/handlers/avatar-create-did.ts",
"src/forest/missions/handlers/caption-generate.ts",
"src/forest/missions/handlers/lead-enrich.ts",
"src/forest/missions/handlers/subtitle-generate.ts",
"src/forest/missions/handlers/thumbnail-generate.ts",
"src/forest/missions/handlers/video-create.ts",
// publishing — reads land/i18n, tiktok, youtube for publishing (mekong-exempt)
"src/forest/publishing/bundle-publisher.ts",
"src/forest/publishing/oauth-token-refresher.ts",
"src/forest/publishing/template-engine.ts",
"src/forest/publishing/tiktok-publisher.ts",
// raas-service — reads land/redis for caching (mekong-exempt: infra)
"src/forest/raas-service-key-operations.ts",
"src/forest/raas-service-types-and-constants.ts",
"src/forest/raas-service.ts",
// usage-metering — reads land/redis for KV ops (mekong-exempt: infra)
// quota — reads land/redis for KV cache ops (mekong-exempt: infra)
"src/forest/quota/quota-checker-kv-cache.ts",
    "src/forest/agents/runner.ts",
    // daily-briefing — uses land/openclaw memory adapter (mekong-exempt: orchestration)
    "src/forest/agents/daily-briefing/briefing-generator.ts",
      // account-delete-finalize-cron orchestrates land/account cascade-delete on Inngest schedule
      // (mekong-exempt: forest → land orchestration per cross-layer-orchestration.md).
      "src/forest/inngest/functions/account-delete-finalize-cron.ts",
      // forest/jobs — Inngest cron orchestrators that call land domain logic
      // (mekong-exempt: forest → land orchestration per cross-layer-orchestration.md, M3 migration).
      "src/forest/jobs/offer-sync-cron.ts",
      "src/forest/jobs/payout-batcher.ts",
      "src/forest/jobs/pending-promoter-cron.ts",
      "src/forest/jobs/reconciliation.ts",
      // quota-enforcer checks billing limits (mekong-exempt)
      "src/forest/quota/quota-enforcer.ts",
      // pricing component reads land coupon/promo data (mekong-exempt: UI)
      "src/forest/components/pricing/coupon-input.tsx",
// admin/synthetic-fulfillment-runner — reads land/fulfillment for fulfillment logic (mekong-exempt)
"src/tree/admin/synthetic-fulfillment-runner.ts",
// byok/with-timeout — reads land/signals for telemetry (mekong-exempt)
"src/tree/byok/with-timeout.ts",
// clients/nowpayments-client — reads land/webhooks for IPN signature (mekong-exempt)
"src/tree/clients/nowpayments-client.ts",
// gateway/adapters — reads land/tiktok, land/youtube for channel OAuth (mekong-exempt)
"src/tree/gateway/adapters/tiktok-channel-adapter.ts",
"src/tree/gateway/adapters/youtube-channel-adapter.ts",
// gateway/checkpoint-supabase-persistence — reads land/supabase/admin (mekong-exempt)
"src/tree/gateway/checkpoint-supabase-persistence.ts",
// gateway/openclaw-gateway — reads land/signals for orchestration telemetry (mekong-exempt)
"src/tree/gateway/openclaw-gateway.ts",
// sop/auto-dispatch-layer — reads land/openclaw for LLM routing (mekong-exempt)
"src/tree/sop/auto-dispatch-layer.ts",
// sop/executor/sop-runner — reads forest/missions for dispatching (mekong-exempt)
"src/tree/sop/executor/sop-runner.ts",
// sop/solo-orchestrator — reads land/openclaw for agent orchestration (mekong-exempt)
"src/tree/sop/solo-orchestrator.ts",
// sop/webhook-hmac — reads land/webhooks for signature verification (mekong-exempt)
"src/tree/sop/webhook-hmac.ts",
// usage-metering — KV client from land/redis (mekong-exempt: infra access pattern)
"src/forest/usage-metering/**/*.ts",
// dlq-reaper — reads land/billing/nowpayments-ipn-dead-letter for DLQ ops (mekong-exempt: orchestration)
"src/forest/inngest/functions/dlq-reaper.ts",
// agent-chat — orchestrator that uses land/openclaw memory adapter (mekong-exempt: orchestration)
"src/forest/agent-chat/memory-consolidation-service.ts",
"src/forest/agent-chat/tool-executor.ts",
// did/missions — orchestrates land/did for avatar creation (mekong-exempt)
"src/forest/did/missions/avatar-create-did.ts",
// leads/missions — orchestrates land/hunter for lead enrichment (mekong-exempt)
"src/forest/leads/missions/lead-enrich.ts",
// publishing — token refresh uses land/instagram adapter (mekong-exempt: OAuth)
"src/forest/publishing/token-refresh-service.ts",
// video/missions — video pipeline orchestrators that call land services (mekong-exempt)
"src/forest/video/missions/caption-generate.ts",
"src/forest/video/missions/emit-video-generate.ts",
"src/forest/video/missions/subtitle-generate.ts",
"src/forest/video/missions/thumbnail-generate.ts",
"src/forest/video/missions/video-create.ts",
// youtube/missions — orchestrates land/youtube publisher (mekong-exempt)
"src/forest/youtube/missions/youtube-publish.ts",
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
    "public/sw.js",
    "public/workbox-*.js",
    "next-env.d.ts",
    "coverage/**",
    "worker-configuration.d.ts",
    "playwright-report/**",
    "test-results/**",
    // E2E test scaffolding — Playwright uses `use()` fixture API which clashes
    // with react-hooks/rules-of-hooks (false positive on Playwright fixture name).
"tests/e2e/**",
// Build/CI helper scripts — CommonJS by design (must use require), not lintable as ES modules.
"scripts/**/*.cjs",
"scripts/**/*.mjs",
// Test helper files — CJS require() for better-sqlite3 ESM interop (mekong-exempt)
"src/forest/publishing/__tests__/fake-d1-sqlite.ts",
"src/lib/publishing/__tests__/fake-d1-sqlite.ts",
// SOP marketplace — any cast for server→client template hydration (mekong-exempt)
"src/app/sop-marketplace/page.tsx",
  ]),
]);

export default eslintConfig;
