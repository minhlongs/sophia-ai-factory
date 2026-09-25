/**
 * 1-Click Sandboxed Demo Workspace Provisioner
 *
 * Implements:
 * - Automated provisioning of isolated multi-tenant client subaccount (`client_subaccounts`)
 * - 1,000 Demo MCU compute allocation with 14-day expiry (`subaccount_mcu_allocations`)
 * - Signed HMAC-SHA256 magic access token generator and verifier (Web Crypto)
 * - Dynamic preview watermark configuration
 * - Deal stage progression to 'demo_active'
 *
 * Layer: tree/sales (Pure domain logic - imports only @/seed and tree siblings)
 *
 * @module tree/sales/sandbox-provisioner
 */

import type { D1Database } from '@/seed/db/client';
import type { SandboxProvisionResult } from '@/seed/types/enterprise-deal';
import { logger } from '@/seed/utils/logger-utility';
import {
  createSubaccount,
  getSubaccountById,
  slugify,
} from '@/tree/organizations/subaccount-repo';
import {
  getEnterpriseDealById,
  updateEnterpriseDeal,
} from './enterprise-deal-repo';

const DEFAULT_DEMO_MCU = 1000;
const DEFAULT_EXPIRY_DAYS = 14;
const DEFAULT_SECRET = process.env.SANDBOX_HMAC_SECRET || 'sophia-enterprise-demo-secret-key-2026';
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

export interface ProvisionDemoSandboxOptions {
  hostAgencyOrgId?: string;
  demoMcu?: number;
  expiryDays?: number;
  secret?: string;
  baseUrl?: string;
}

/**
 * Creates an HMAC-SHA256 signature using the Web Crypto API.
 */
export async function signHmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(message));
  return Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a signed, URL-safe base64 demo access token with embedded payload and HMAC.
 */
export async function generateSandboxToken(
  payload: { dealId: string; subaccountId: string; expiresAt: number },
  secret: string = DEFAULT_SECRET
): Promise<string> {
  const serialized = JSON.stringify(payload);
  const base64Payload = btoa(serialized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = await signHmacSha256(base64Payload, secret);
  return `${base64Payload}.${signature}`;
}

/**
 * Verifies and decodes a signed demo access token.
 */
export async function verifySandboxToken(
  token: string,
  secret: string = DEFAULT_SECRET
): Promise<{
  valid: boolean;
  expired: boolean;
  payload?: { dealId: string; subaccountId: string; expiresAt: number };
}> {
  try {
    const [base64Payload, signature] = token.split('.');
    if (!base64Payload || !signature) {
      return { valid: false, expired: false };
    }

    const expectedSig = await signHmacSha256(base64Payload, secret);
    if (signature !== expectedSig) {
      return { valid: false, expired: false };
    }

    // Decode URL-safe base64
    let str = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const decoded = atob(str);
    const payload = JSON.parse(decoded) as { dealId: string; subaccountId: string; expiresAt: number };

    const isExpired = Date.now() > payload.expiresAt;
    return { valid: !isExpired, expired: isExpired, payload };
  } catch (err) {
    logger.warn('[sandbox-provisioner] Token verification failed', { error: String(err) });
    return { valid: false, expired: false };
  }
}

/**
 * Resolves or creates an enterprise host organization in D1 to own demo subaccounts.
 */
async function resolveHostAgencyOrg(db: D1Database, preferredOrgId?: string): Promise<string> {
  if (preferredOrgId) return preferredOrgId;

  // 1. Look for existing host enterprise organization
  const existingOrg = await db
    .prepare("SELECT id FROM organizations WHERE id = 'org_enterprise_sales' OR name LIKE '%Enterprise%' LIMIT 1")
    .first<{ id: string }>();

  if (existingOrg?.id) {
    return existingOrg.id;
  }

  // 2. Fallback to first available organization
  const anyOrg = await db
    .prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1')
    .first<{ id: string }>();

  if (anyOrg?.id) {
    return anyOrg.id;
  }

  // 3. Create default enterprise host organization if table is empty
  const defaultOrgId = 'org_enterprise_sales';
  const now = new Date().toISOString();
  await db
    .prepare(`
      INSERT OR IGNORE INTO organizations (id, name, slug, created_at, updated_at)
      VALUES (?, 'Sophia Enterprise Sales Fleet', 'enterprise-sales', ?, ?)
    `)
    .bind(defaultOrgId, now, now)
    .run();

  return defaultOrgId;
}

/**
 * 1-Click activation of an isolated, 1,000 MCU sandboxed demo workspace for a deal.
 */
export async function provisionDemoSandbox(
  db: D1Database,
  dealId: string,
  options: ProvisionDemoSandboxOptions = {}
): Promise<SandboxProvisionResult> {
  const deal = await getEnterpriseDealById(db, dealId);
  if (!deal) {
    throw new Error(`Enterprise deal not found: ${dealId}`);
  }

  const demoMcu = options.demoMcu ?? DEFAULT_DEMO_MCU;
  const expiryDays = options.expiryDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
  const secret = options.secret ?? DEFAULT_SECRET;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  const agencyOrgId = await resolveHostAgencyOrg(db, options.hostAgencyOrgId);

  // If already provisioned, reuse or re-activate
  if (deal.sandboxSubaccountId) {
    const existingSubaccount = await getSubaccountById(db, deal.sandboxSubaccountId);
    if (existingSubaccount) {
      const token = await generateSandboxToken(
        { dealId, subaccountId: existingSubaccount.id, expiresAt },
        secret
      );
      const demoMagicUrl = `${baseUrl}/sandbox/${token}`;

      await updateEnterpriseDeal(db, dealId, {
        sandboxStatus: 'active',
        sandboxToken: token,
        sandboxExpiresAt: expiresAt,
        dealStage: deal.dealStage === 'new_lead' || deal.dealStage === 'qualified' ? 'demo_active' : deal.dealStage,
      });

      return {
        dealId,
        subaccountId: existingSubaccount.id,
        subaccountName: existingSubaccount.name,
        slug: existingSubaccount.slug,
        allocatedMcu: demoMcu,
        expiresAt,
        sandboxToken: token,
        demoMagicUrl,
        watermarkEnabled: true,
      };
    }
  }

  // Generate unique subaccount slug
  const baseSlug = slugify(deal.companyName);
  const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  const subaccountSlug = `demo-${baseSlug.slice(0, 20)}-${randomSuffix}`;
  const subaccountName = `${deal.companyName} Sandbox Demo`;

  // Create isolated subaccount via existing subaccount repo
  const subaccount = await createSubaccount(db, {
    agencyOrgId,
    name: subaccountName,
    slug: subaccountSlug,
    initialMcu: demoMcu,
    branding: {
      logoUrl: undefined,
      primaryColor: '#0f172a',
      accentColor: '#10b981',
    },
  });

  // Generate HMAC demo token
  const sandboxToken = await generateSandboxToken(
    { dealId, subaccountId: subaccount.id, expiresAt },
    secret
  );
  const demoMagicUrl = `${baseUrl}/sandbox/${sandboxToken}`;

  // Update deal record with sandbox linkage and progress stage to demo_active
  await updateEnterpriseDeal(db, dealId, {
    sandboxSubaccountId: subaccount.id,
    sandboxStatus: 'active',
    sandboxToken,
    sandboxExpiresAt: expiresAt,
    dealStage: deal.dealStage === 'new_lead' || deal.dealStage === 'qualified' || deal.dealStage === 'demo_prepared'
      ? 'demo_active'
      : deal.dealStage,
    metadata: {
      ...deal.metadata,
      demoProvisionedAt: Date.now(),
      demoMcuAllocated: demoMcu,
      watermarkEnforced: true,
    },
  });

  logger.info('[sandbox-provisioner] Successfully provisioned demo workspace', {
    dealId,
    subaccountId: subaccount.id,
    slug: subaccountSlug,
    allocatedMcu: demoMcu,
  });

  return {
    dealId,
    subaccountId: subaccount.id,
    subaccountName,
    slug: subaccountSlug,
    allocatedMcu: demoMcu,
    expiresAt,
    sandboxToken,
    demoMagicUrl,
    watermarkEnabled: true,
  };
}
