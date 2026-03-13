---
description: 🚦 Rate Limit Check — Test API Rate Limits, Throttle Detection, Quota Validation
argument-hint: [--endpoint=API_URL] [--requests=100] [--window=1m]
---

**Think harder** để test rate limits: <$ARGUMENTS>

**IMPORTANT:** Rate limits PHẢI được document, test, và enforce công bằng.

## Rate Limit Test Script

```bash
#!/bin/bash
# scripts/rate-limit-check.sh

API_URL="${1:-https://api.agencyos.network}"
ENDPOINT="${2:-/api/v1/users}"
MAX_REQUESTS="${3:-100}"
WINDOW="${4:-60}"  # seconds

echo "🚦 Rate Limit Test"
echo "══════════════════════════════════════"
echo "Endpoint: $API_URL$ENDPOINT"
echo "Max Requests: $MAX_REQUESTS"
echo "Window: ${WINDOW}s"
echo ""

# Headers for auth
HEADERS="-H \"Authorization: Bearer $API_TOKEN\""

success=0
failed=0
rate_limited=0

for i in $(seq 1 $MAX_REQUESTS); do
    response=$(curl -s -w "\n%{http_code}" $HEADERS "$API_URL$ENDPOINT")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)

    case $http_code in
        200)
            success=$((success + 1))
            echo "[$i] ✅ HTTP $http_code"
            ;;
        429)
            rate_limited=$((rate_limited + 1))
            retry_after=$(echo "$body" | grep -o '"retry_after":[0-9]*' | cut -d: -f2)
            echo "[$i] 🚫 HTTP 429 - Retry after: ${retry_after}s"

            # Parse retry-after and wait
            if [ -n "$retry_after" ]; then
                sleep "$retry_after"
            else
                sleep 1
            fi
            ;;
        *)
            failed=$((failed + 1))
            echo "[$i] ❌ HTTP $http_code"
            ;;
    esac

    # Small delay to avoid overwhelming
    sleep 0.1
done

echo ""
echo "══════════════════════════════════════"
echo "Results:"
echo "  Successful: $success"
echo "  Rate Limited: $rate_limited"
echo "  Failed: $failed"
echo "  Rate: $(echo "scale=2; $rate_limited * 100 / $MAX_REQUESTS" | bc)%"
```

## Rate Limit Headers

```bash
# === Check Rate Limit Headers ===
curl -i "https://api.agencyos.network/api/v1/users" \
  -H "Authorization: Bearer $TOKEN" | grep -E "(X-RateLimit|Retry-After)"

# Expected headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 95
# X-RateLimit-Reset: 1677686400
# Retry-After: 60
```

## Rate Limit Patterns

```python
# src/core/rate_limiter.py
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import time
from collections import defaultdict

class RateLimiter:
    def __init__(self, requests_per_window: int, window_seconds: int):
        self.limit = requests_per_window
        self.window = window_seconds
        self.requests = defaultdict(list)

    def is_allowed(self, client_id: str) -> tuple[bool, dict]:
        now = time.time()
        window_start = now - self.window

        # Clean old requests
        self.requests[client_id] = [
            ts for ts in self.requests[client_id]
            if ts > window_start
        ]

        # Check limit
        if len(self.requests[client_id]) >= self.limit:
            retry_after = int(self.requests[client_id][0] + self.window - now)
            return False, {
                "limit": self.limit,
                "remaining": 0,
                "reset": int(now + retry_after),
                "retry_after": retry_after
            }

        # Record request
        self.requests[client_id].append(now)
        return True, {
            "limit": self.limit,
            "remaining": self.limit - len(self.requests[client_id]),
            "reset": int(now + self.window)
        }

# Usage in FastAPI
limiter = RateLimiter(requests_per_window=100, window_seconds=60)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_id = request.client.host
    allowed, headers = limiter.is_allowed(client_id)

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded"},
            headers={
                "X-RateLimit-Limit": str(headers["limit"]),
                "X-RateLimit-Remaining": str(headers["remaining"]),
                "X-RateLimit-Reset": str(headers["reset"]),
                "Retry-After": str(headers["retry_after"])
            }
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(headers["limit"])
    response.headers["X-RateLimit-Remaining"] = str(headers["remaining"])
    response.headers["X-RateLimit-Reset"] = str(headers["reset"])
    return response
```

## Tier-based Rate Limits

```yaml
# config/rate_limits.yml
tiers:
  free:
    requests_per_minute: 20
    requests_per_day: 1000
    burst: 5

  growth:
    requests_per_minute: 100
    requests_per_day: 10000
    burst: 20

  premium:
    requests_per_minute: 500
    requests_per_day: 100000
    burst: 50

  enterprise:
    requests_per_minute: 2000
    requests_per_day: unlimited
    burst: 100
```

## Related Commands

- `/api-docs` — API documentation
- `/load-test` — Load testing
- `/stress-test` — Stress testing
