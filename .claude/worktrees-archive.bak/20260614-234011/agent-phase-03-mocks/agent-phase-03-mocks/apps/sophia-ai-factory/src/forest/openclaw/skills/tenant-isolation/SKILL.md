---
name: tenant-isolation
description: Row-level security enforcement, multi-tenant patterns, API key scoping, audit segregation.
triggers: tenant, isolation, multi-tenant, separate, rls, row-level, scoping
tier: lite
---

# Tenant Isolation Skill

## When to activate
When implementing multi-tenant features, enforcing data isolation, or auditing cross-tenant access.
Activate when task prompt contains: "tenant", "isolation", "multi-tenant", "RLS", "data boundary".

## Isolation Layers

| Layer | Mechanism | Enforcement Point |
|---|---|---|
| Database | D1 WHERE tenant_id = ? | All queries (mandatory) |
| API Keys | Per-tenant encryption | BYOK module |
| Agent Fleet | TenantContext injection | spawnAgentFleet opts |
| Audit Logs | tenant_id column | audit_log table |
| Rate Limits | Per-tenant KV buckets | rateLimitGate |
| MCP Calls | ctx.tenantId injection | mcp-gateway |

## Critical Rules
1. NEVER issue queries without WHERE tenant_id = ?
2. NEVER pass raw tenant data between different tenants
3. ALWAYS verify tenant ownership before returning any resource
4. spawnAgentFleet MUST have tenantId — OpenclawTenantMissingError thrown otherwise
5. audit() MUST include tenantId on every call

## Verification Pattern
```typescript
// Before returning any resource:
if (resource.tenant_id !== ctx.tenantId) {
  throw new Error('Tenant isolation violation');
}
```

## Testing Isolation
- Fuzz test: create 2 tenants, insert data for tenant A, query as tenant B → must return empty
- Audit trail: every cross-tenant attempt should appear in audit_log with action='isolation.violation'
- Rate limits: tenant A's rate limit must NOT affect tenant B's bucket
