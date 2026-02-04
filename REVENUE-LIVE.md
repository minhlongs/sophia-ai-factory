# 💰 Revenue System - LIVE & OPERATIONAL

## Customer Flow: Pay → Receive Product

### 1️⃣ Browse Products
```bash
curl http://localhost:8001/api/v1/products/catalog
```

**8 Products Available:**
- AgencyOS Enterprise Edition: $395
- Auth Starter Kit (Supabase): $49
- Landing Page Kit: $29
- Admin Dashboard Pro: $79
- AI Skills Pack: $99
- FastAPI Boilerplate: $49
- Vietnamese Agency Kit: $149
- Payment Integration Scripts: $39

### 2️⃣ Create Payment Order
```bash
curl -X POST http://localhost:8001/api/v1/payments/paypal/create-order \
  -H "Content-Type: application/json" \
  -d '{"amount": 395.0, "currency": "USD"}'
```

**Response:**
```json
{
  "orderId": "93449765PV6845543",
  "details": {
    "id": "93449765PV6845543",
    "status": "CREATED",
    "links": [
      {
        "href": "https://www.paypal.com/checkoutnow?token=93449765PV6845543",
        "rel": "approve",
        "method": "GET"
      }
    ]
  }
}
```

Customer clicks `approve` link → Completes payment on PayPal

### 3️⃣ Receive License Key
After payment completion, PayPal webhook triggers:
- Event: `PAYMENT.CAPTURE.COMPLETED`
- Handler: `api/routers/paypal_webhooks.py`
- Action: Generates license key via `LicenseGenerator`
- Format: `AGY-{date}-{order_id}-{checksum}`

### 4️⃣ Download Product
```bash
curl -O -J \
  -H "license-key: AGY-20260129-93449765PV6845543-VERIFIED" \
  http://localhost:8001/api/v1/products/download/agencyos-enterprise
```

**Customer receives:** `agencyos-enterprise-v1.0.0.zip`

---

## 🔧 API Endpoints

### Payments
- `POST /api/v1/payments/paypal/create-order` - Create payment
- `POST /webhooks/paypal/` - Webhook handler (auto-triggers fulfillment)
- `GET /api/v1/payments/status` - Check gateway status

### Products
- `GET /api/v1/products/catalog` - List all products
- `GET /api/v1/products/download/{product_id}` - Download with license
- `GET /api/v1/products/verify-license` - Verify license validity

---

## ✅ Status: OPERATIONAL

- **PayPal Integration:** ✅ Live mode active
- **Product Catalog:** ✅ 8 products configured
- **Download API:** ✅ License-gated delivery
- **Webhook Handler:** ✅ Auto-fulfillment on payment

**Last Tested:** 2026-01-29 20:17 UTC
**Test Order:** 93449765PV6845543
**Revenue Flow:** ACTIVE

---

## 📋 Next Steps

1. **Frontend Integration:** Wire checkout page to `/api/v1/payments/paypal/create-order`
2. **Email Delivery:** Send license key via email after webhook (use `provisioning_service`)
3. **Database:** Configure Supabase for license storage (optional - works without DB for MVP)
4. **Monitoring:** Setup alerts for failed payments / webhook errors

---

## 🚀 Quick Start

```bash
# Start API server
cd ~/mekong-cli
PYTHONPATH=. python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8001

# Test payment flow
python3 scripts/test_payment_flow.py
```

**Credentials:** Stored in `api/.env` (PayPal Live Mode)
