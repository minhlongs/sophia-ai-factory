# Tech Stack & Architecture: Reality Loop v1.2 & Autonomous Commerce Pipeline

## 1. Overview & Positioning
This specification defines the technology stack for two mission-critical extensions to Sophia AI Factory:
1. **Reality Loop v1.2 Telemetry Hardening**: Closing the last deferred event (`creative.edited`) to achieve 13/13 canonical observability coverage.
2. **Autonomous E-Commerce Video Pipeline**: Catalog ingestion (Shopify & WooCommerce) and automated video rendering complying strictly with Sophia's BYOK and No-Code / No-Tech doctrines.

## 2. Architectural Layering (Clean Architecture 4-Layer Boundary)
- **`seed`**: Foundational primitives.
  - `better-auth-session`: User authentication via `getCurrentUser()`.
  - `createServerClient`: Synchronous Cloudflare D1 SQLite client.
  - `Result<T, E>` pattern: Safe error propagation without throwing exceptions.
  - `circuit-breaker`: Resilient HTTP calls to external commerce endpoints.
- **`tree`**: Domain-level telemetry and reusable structures.
  - `emitter-health`: Observability health evaluation over the 13 canonical `performance_events`.
  - `loop-emitters-creative`: Telemetry emitters (`emitCreativeEdited`, `emitCreativeAccepted`, etc.).
  - `tree/byok/`: Encrypted credential storage for customer keys.
- **`forest`**: Reusable background orchestrators.
  - `Inngest`: Distributed job orchestration for catalog synchronization and render pipelines.
  - `quota-enforcer`: MCU quota gating for video rendering jobs.
- **`land`**: Domain workflows and client-facing Server Actions.
  - `land/creative-mission/`: Artifact review, approval, and revision actions.
  - `land/commerce/`: Shopify & WooCommerce catalog sync actions.

## 3. Telemetry Event Topology (13/13 Canonical Emitters)
All multi-agent creative runs emit to `performance_events` in Cloudflare D1:
1. `mission.created` | 2. `mission.abandoned` | 3. `agent.started` | 4. `agent.failed`
5. `approval.requested` | 6. `approval.approved` | 7. `approval.rejected`
8. `creative.accepted` | 9. `creative.rejected` | 10. `creative.edited`
11. `memory.used` | 12. `memory.corrected` | 13. `mission.cost_recorded`

Health threshold: Active emitters lagging >48 hours trigger `degraded` health status on `/api/reality-loop/health`.

## 4. E-Commerce Integration Doctrine (BYOK & No-Tech)
- **Zero Operator Credentials**: Operators provide no Shopify Partner or WooCommerce bridge keys.
- **Customer Self-Service Onboarding**:
  - Shopify: Merchant supplies Custom App Admin API Access Token (`shpat_...`) + Shop Domain (`{shop}.myshopify.com`).
  - WooCommerce: Merchant supplies Store URL + REST API v3 Consumer Key & Secret (`ck_...`, `cs_...`).
- **Catalog Synchronization**: Polled incrementally or triggered via webhooks validated using HMAC-SHA256 with user-configured webhook secrets.
- **Video Campaign Generation**: Products map to structured creative briefs processed through Sophia's certified multimodal AI providers (fal.ai, Replicate, ElevenLabs).
