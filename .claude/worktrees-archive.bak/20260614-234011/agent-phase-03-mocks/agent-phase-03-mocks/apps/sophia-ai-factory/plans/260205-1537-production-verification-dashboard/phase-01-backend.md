# Phase 1: Backend Implementation

## Objective
Create a robust `/api/health` endpoint that checks the connectivity and configuration of all critical services.

## Implementation Steps

1.  **Create API Route**
    - File: `src/app/api/health/route.ts`
    - Method: `GET`

2.  **Implement Service Checks**
    - **Supabase**: Attempt a simple query (e.g., `SELECT 1` or check session/user if available, or just check `supabase.from('...').select().limit(1)` on a public table if exists, or just verify client initialization). *Better approach*: Use `supabase.auth.getSession()` or a lightweight query.
    - **Inngest**: Check if `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are present. (Active connection check might require hitting Inngest API, simple config check is sufficient for v1).
    - **External Services**: Check for presence of API keys in `process.env`:
        - `OPENROUTER_API_KEY`
        - `ELEVENLABS_API_KEY`
        - `HEYGEN_API_KEY`
        - `TELEGRAM_BOT_TOKEN`

3.  **Response Format**
    ```json
    {
      "status": "healthy" | "degraded" | "unhealthy",
      "timestamp": "ISO_STRING",
      "services": {
        "supabase": { "status": "up", "latency": 120 },
        "inngest": { "status": "configured" },
        "openrouter": { "status": "configured" },
        "elevenlabs": { "status": "missing_config" },
        ...
      }
    }
    ```

## Code Files
- `src/app/api/health/route.ts` (New)
