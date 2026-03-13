---
description: 📚 API Docs — Auto-generate OpenAPI/Swagger Documentation
argument-hint: [--format=openapi|swagger] [--output=docs/]
---

**Think harder** để generate API documentation: <$ARGUMENTS>

**IMPORTANT:** API docs PHẢI auto-gen từ code, keep sync với implementation.

## OpenAPI Generation

```bash
# === FastAPI Auto Docs ===
# FastAPI tự động tạo OpenAPI docs
curl http://localhost:8000/openapi.json > docs/openapi.json
curl http://localhost:8000/docs  # Swagger UI
curl http://localhost:8000/redoc  # ReDoc UI

# === Generate Markdown ===
npx @redocly/cli generate-docs docs/openapi.json -o docs/api-reference.md

# === Validate OpenAPI ===
npx @redocly/cli lint docs/openapi.json
```

## tsoa (TypeScript OpenAPI)

```bash
# === Install ===
npm install -g tsoa

# === tsoa.json ===
{
  "entryFile": "src/main.ts",
  "noImplicitAdditionalProperties": "silently-remove-extras",
  "spec": {
    "outputDirectory": "docs/",
    "specVersion": 3
  },
  "routes": {
    "routesDir": "src/generated/"
  }
}

# === Generate ===
npx tsoa spec
npx tsoa routes
```

## API Doc Template

```markdown
# API Reference

## Authentication

All API requests require Bearer token:
```
Authorization: Bearer <access_token>
```

## Endpoints

### GET /api/v1/users

List all users.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | number | No | Max results (default: 20) |
| offset | number | No | Pagination offset |

**Response:**
```json
{
  "data": [...],
  "total": 100,
  "has_more": true
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `429` - Rate limited

### POST /api/v1/users

Create new user.

**Body:**
```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```
```

## Swagger UI Config

```javascript
// swagger-ui-config.json
{
  "url": "/openapi.json",
  "dom_id": "#swagger-ui",
  "deepLinking": true,
  "presets": [SwaggerUIBundle.presets.apis],
  "layout": "BaseLayout",
  "validatorUrl": null
}
```

## Related Commands

- `/api-mock` — Mock API server
- `/webhook-test` — Webhook testing
- `/rate-limit-check` — Rate limit validation
