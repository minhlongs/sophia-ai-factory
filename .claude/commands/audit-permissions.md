---
description: 🔐 Permission Audit — RBAC, Access Control, Privilege Review
argument-hint: [scope: users|roles|resources|full]
---

**Think harder** để audit permissions: <scope>$ARGUMENTS</scope>

**IMPORTANT:** Principle of Least Privilege — chỉ grant minimum permissions cần thiết.

## Permission Audit Framework

### Audit Dimensions

| Dimension | Question | Tool |
|-----------|----------|------|
| **Users** | Who has access? | IAM console, DB query |
| **Roles** | What can they do? | RBAC matrix |
| **Resources** | What can they access? | ACL audit |
| **Actions** | What did they do? | Access logs |

## Audit Commands

### `users` — User Access Review
```bash
# List all users with admin access
psql "$DATABASE_URL" -c "
SELECT u.id, u.email, u.role, u.created_at,
       (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) as active_sessions
FROM users u
WHERE u.role IN ('admin', 'super_admin')
ORDER BY u.created_at;
"

# Find inactive users (> 90 days)
psql "$DATABASE_URL" -c "
SELECT email, role, last_login_at
FROM users
WHERE last_login_at < NOW() - INTERVAL '90 days'
ORDER BY last_login_at;
"

# Users with excessive permissions
psql "$DATABASE_URL" -c "
SELECT u.email, COUNT(DISTINCT p.permission) as permission_count
FROM users u
JOIN user_permissions up ON u.id = up.user_id
JOIN permissions p ON up.permission_id = p.id
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT p.permission) > 10
ORDER BY permission_count DESC;
"
```

### `roles` — Role-Based Access Control Audit
```bash
# RBAC Matrix
psql "$DATABASE_URL" -c "
SELECT r.name as role, p.name as permission, r.description
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.name, p.name;
"

# Check for privilege escalation risks
psql "$DATABASE_URL" -c "
SELECT r.name, COUNT(DISTINCT p.name) as permission_count
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE p.name IN ('create_user', 'delete_user', 'grant_role', 'admin:*')
GROUP BY r.name;
"

# Orphaned permissions (no role has them)
psql "$DATABASE_URL" -c "
SELECT name FROM permissions
WHERE id NOT IN (SELECT permission_id FROM role_permissions);
"
```

### `resources` — Resource Access Audit
```bash
# Who can access sensitive resources?
psql "$DATABASE_URL" -c "
SELECT r.name as resource, u.email, a.permission
FROM resources r
JOIN access_control a ON r.id = a.resource_id
JOIN users u ON a.user_id = u.id
WHERE r.sensitive = true
ORDER BY r.name;
"

# Public resources (should be rare)
psql "$DATABASE_URL" -c "
SELECT name, type, public_access
FROM resources
WHERE public_access = true;
"

# Resources without owner
psql "$DATABASE_URL" -c "
SELECT r.name, r.type
FROM resources r
LEFT JOIN users u ON r.owner_id = u.id
WHERE u.id IS NULL;
"
```

### `full` — Comprehensive Permission Audit
```bash
#!/bin/bash
# Full permission audit script

echo "=== User Access Report ==="
psql "$DATABASE_URL" -c "
SELECT role, COUNT(*) as user_count
FROM users
GROUP BY role;
"

echo "=== Permission Distribution ==="
psql "$DATABASE_URL" -c "
SELECT p.name, COUNT(up.user_id) as user_count
FROM permissions p
LEFT JOIN user_permissions up ON p.id = up.permission_id
GROUP BY p.id, p.name
ORDER BY user_count DESC;
"

echo "=== Admin Actions (Last 7 Days) ==="
psql "$DATABASE_URL" -c "
SELECT u.email, a.action, a.resource, a.timestamp
FROM audit_logs a
JOIN users u ON a.user_id = u.id
WHERE a.timestamp > NOW() - INTERVAL '7 days'
  AND a.action LIKE '%admin%'
ORDER BY a.timestamp DESC
LIMIT 50;
"

echo "=== Privilege Escalation Risks ==="
# Users who can grant roles to others
psql "$DATABASE_URL" -c "
SELECT u.email, r.name as role
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE EXISTS (
  SELECT 1 FROM permissions p
  JOIN role_permissions rp ON p.id = rp.permission_id
  WHERE rp.role_id = r.id
    AND p.name IN ('grant_role', 'admin:users')
);
"
```

## RLS (Row-Level Security) Audit

```sql
-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';

-- Tables without RLS
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN (
    SELECT tablename FROM pg_policies WHERE schemaname = 'public'
  );

-- RLS bypass check (superusers bypass RLS by default)
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
FROM pg_roles
WHERE rolsuper = true OR rolcreaterole = true;
```

## Access Log Analysis

```sql
-- Failed access attempts (potential abuse)
SELECT user_id, COUNT(*) as failed_attempts, resource
FROM access_logs
WHERE granted = false
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id, resource
HAVING COUNT(*) > 5
ORDER BY failed_attempts DESC;

-- Unusual access patterns
SELECT u.email, al.resource, al.action, al.timestamp
FROM access_logs al
JOIN users u ON al.user_id = u.id
WHERE al.timestamp > NOW() - INTERVAL '1 hour'
  AND al.granted = true
  AND al.action IN ('delete', 'export', 'admin:*')
ORDER BY al.timestamp DESC;
```

## Permission Baselines

### Safe Defaults
```yaml
# Default user permissions
default_permissions:
  - "read:own_profile"
  - "update:own_profile"
  - "read:own_data"
  - "create:own_resources"

# Admin permissions (require approval)
admin_permissions:
  - "admin:users"      # Manage users
  - "admin:roles"      # Manage roles
  - "admin:settings"   # System settings
  - "delete:any"       # Delete any resource

# Super admin (emergency only)
super_admin_permissions:
  - "super:*"          # Full system access
  - "bypass:rls"       # Bypass row-level security
  - "impersonate"      # Impersonate users
```

## Remediation Actions

### 1. Revoke Excessive Permissions
```sql
-- Remove dangerous permission from role
REVOKE permission_name FROM role_name;

-- Remove user from role
DELETE FROM user_roles WHERE user_id = 'user_id' AND role_id = 'role_id';

-- Disable user (soft delete)
UPDATE users SET active = false, deactivated_at = NOW() WHERE id = 'user_id';
```

### 2. Implement Least Privilege
```sql
-- Create restricted role
CREATE ROLE data_viewer;
GRANT SELECT ON TABLE public_data TO data_viewer;
GRANT USAGE ON SCHEMA public TO data_viewer;

-- Assign to users
INSERT INTO user_roles (user_id, role_id)
SELECT id, (SELECT id FROM roles WHERE name = 'data_viewer')
FROM users WHERE email LIKE '%viewer@company.com';
```

### 3. Enable MFA for Admins
```sql
-- Require MFA for admin actions
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;

-- Query users without MFA
SELECT email, role FROM users
WHERE role IN ('admin', 'super_admin')
  AND (mfa_enabled = false OR mfa_enabled IS NULL);
```

## Compliance Reports

### SOC 2 Access Control
```markdown
# Access Control Audit Report

**Period:** 2026-Q1
**Auditor:** AgencyOS Security

## User Access Summary
- Total users: 234
- Active users: 198
- Admin users: 12
- Service accounts: 5

## Access Changes
- New access grants: 45
- Access revocations: 23
- Role changes: 12

## Exceptions
- Users without manager approval: 0
- Stale accounts (> 90 days inactive): 3
- Accounts with excessive permissions: 2

## Remediation
- Stale accounts disabled: 3
- Permissions reviewed and reduced: 2
- MFA enforced for all admins: ✅
```

## Related Commands

- `/security-audit` — Full security audit
- `/secret-detect` — Secret detection
- `/vuln-scan` — Vulnerability scanning
