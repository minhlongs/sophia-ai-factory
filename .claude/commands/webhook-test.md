---
description: 🔗 Webhook Test — Test Webhook Endpoints, Verify Signatures, Debug Payloads
argument-hint: [--url=WEBHOOK_URL] [--event=invoice.paid]
---

**Think harder** để test webhooks: <$ARGUMENTS>

**IMPORTANT:** Webhooks PHẢI verify signature, handle retries, idempotency.

## Webhook Test Script

```bash
#!/bin/bash
# scripts/webhook-test.sh

WEBHOOK_URL="${1:-http://localhost:8000/webhook}"
EVENT="${2:-invoice.paid}"

# Polar.sh webhook payloads
POLAR_WEBHOOKS=(
  "subscription.created"
  "subscription.updated"
  "subscription.cancelled"
  "invoice.paid"
  "invoice.payment_failed"
  "refund.created"
)

# Generate test payload
generate_payload() {
  local event=$1
  cat <<EOF
{
  "type": "$event",
  "data": {
    "id": "test_$(date +%s)",
    "created_at": "$(date -Iseconds)",
    "customer": {
      "id": "cust_test123",
      "email": "test@example.com"
    },
    "amount": 9900,
    "currency": "USD"
  }
}
EOF
}

# Sign payload (HMAC-SHA256)
sign_payload() {
  local payload=$1
  local secret=${WEBHOOK_SECRET:-whsec_test123}
  echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}'
}

# Send webhook
send_webhook() {
  local event=$1
  local payload=$(generate_payload "$event")
  local signature=$(sign_payload "$payload")
  local timestamp=$(date +%s)

  echo "📤 Sending: $event"
  echo "   URL: $WEBHOOK_URL"
  echo "   Timestamp: $timestamp"

  curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Timestamp: $timestamp" \
    -H "X-Webhook-Signature: sha256=$signature" \
    -d "$payload" \
    -w "\n   HTTP Code: %{http_code}\n   Time: %{time_total}s\n"
}

# Test all events
echo "🔗 Webhook Test Suite"
echo "══════════════════════════════════════"

for event in "${POLAR_WEBHOOKS[@]}"; do
  send_webhook "$event"
  echo ""
done
```

## Webhook Signature Verification

```python
# src/core/webhook_verify.py
import hmac
import hashlib
from fastapi import HTTPException, status

def verify_webhook_signature(
    payload: str,
    signature: str,
    secret: str,
    tolerance: int = 300
) -> bool:
    """Verify HMAC-SHA256 webhook signature."""

    # Extract timestamp from signature header
    try:
        timestamp_str, sig_hash = signature.split(',')
        timestamp = int(timestamp_str.split('=')[1])
        expected_sig = sig_hash.split('=')[1]
    except (ValueError, IndexError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature format"
        )

    # Check timestamp tolerance (prevent replay attacks)
    import time
    if abs(time.time() - timestamp) > tolerance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook timestamp expired"
        )

    # Compute expected signature
    signed_payload = f"{timestamp}.{payload}"
    expected = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison
    if not hmac.compare_digest(expected, expected_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature"
        )

    return True
```

## Webhook Inspector (ngrok)

```bash
# === Start ngrok for local testing ===
ngrok http 8000

# === Get ngrok URL ===
curl http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'

# === Forward webhooks to local ===
# Use ngrok URL as webhook endpoint in Polar dashboard
```

## Webhook Debug Log

```typescript
// scripts/webhook-logger.ts
interface WebhookLog {
  id: string;
  event: string;
  received_at: string;
  payload: any;
  signature_valid: boolean;
  processing_time_ms: number;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  retries: number;
}

async function logWebhook(log: WebhookLog) {
  console.log(`📥 Webhook: ${log.event}`);
  console.log(`   ID: ${log.id}`);
  console.log(`   Time: ${log.received_at}`);
  console.log(`   Signature: ${log.signature_valid ? '✅' : '❌'}`);
  console.log(`   Status: ${log.status}`);
  if (log.error) console.log(`   Error: ${log.error}`);
}
```

## Related Commands

- `/api-docs` — API documentation
- `/billing` — Billing webhooks
- `/alert` — Alert on webhook failures
